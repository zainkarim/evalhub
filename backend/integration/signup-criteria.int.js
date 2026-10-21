// Observation sign-up rules and AC-managed evaluation criteria.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
let mySection;    // a section Professor C teaches that has no assessment yet
let spareSection; // a second section Professor C teaches, created here, never signed up for
let otherSection; // a section someone else teaches

before(async () => {
  ctx = await startIntegration();
  [mySection] = await ctx.sql(
    `SELECT id, course_id, term_id FROM course_sections
      WHERE teacher_id = 3 AND id NOT IN (SELECT section_id FROM assessments)
      ORDER BY id LIMIT 1`,
  );
  [otherSection] = await ctx.sql(
    `SELECT id FROM course_sections
      WHERE teacher_id IS NOT NULL AND teacher_id <> 3 AND id NOT IN (SELECT section_id FROM assessments)
      ORDER BY id LIMIT 1`,
  );
  assert.ok(mySection && otherSection, 'seed data should include free sections for these tests');
  [spareSection] = await ctx.sql(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id)
     VALUES ($1, $2, 'T99', 3) RETURNING id, course_id`,
    [mySection.course_id, mySection.term_id],
  );
});
after(async () => { await ctx?.close(); });

describe('sign-up', () => {
  test('a professor signs up for a section they teach and gets a readable course code', async () => {
    const res = await ctx.api('POST', '/assessments/sign-up', { as: USERS.faculty, body: { sectionId: mySection.id } });
    assert.equal(res.status, 201);
    assert.equal(res.body.teacherId, 3);
    assert.match(res.body.sectionCode, /^[A-Z]+\d{4}\.\w+$/);
  });

  test('signing up for the same section again: 409 naming the section', async () => {
    const res = await ctx.api('POST', '/assessments/sign-up', { as: USERS.faculty, body: { sectionId: mySection.id } });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /already has an observation assessment/);
  });

  test('a section the professor does not teach: 409', async () => {
    const res = await ctx.api('POST', '/assessments/sign-up', { as: USERS.faculty, body: { sectionId: otherSection.id } });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /not the instructor/);
  });

  // Uses the professor's own free section, so only the course check can fail.
  test('a courseId that does not match the section: 409 naming the real course', async () => {
    const res = await ctx.api('POST', '/assessments/sign-up', {
      as: USERS.faculty,
      body: { sectionId: spareSection.id, courseId: spareSection.course_id + 100000 },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /not the course you specified/);
    assert.equal(res.body.error.details.actualCourseId, spareSection.course_id);
    const rows = await ctx.sql('SELECT 1 FROM assessments WHERE section_id = $1', [spareSection.id]);
    assert.equal(rows.length, 0);
  });

  test('faculty cannot sign up on behalf of another teacher', async () => {
    const res = await ctx.api('POST', '/assessments/sign-up', { as: USERS.faculty, body: { sectionId: otherSection.id, teacherId: 1 } });
    assert.equal(res.status, 403);
  });

  test('an unknown section: 404', async () => {
    const res = await ctx.api('POST', '/assessments/sign-up', { as: USERS.faculty, body: { sectionId: 999999 } });
    assert.equal(res.status, 404);
  });

  test('the new sign-up shows up in the professor\'s own list', async () => {
    const res = await ctx.api('GET', '/assessments/mine', { as: USERS.faculty });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((a) => a.sectionId === mySection.id));
  });
});

describe('evaluation criteria', () => {
  test('any signed-in user can read the active criteria (observers need them)', async () => {
    const res = await ctx.api('GET', '/criteria', { as: USERS.faculty });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });

  test('faculty cannot create criteria', async () => {
    const res = await ctx.api('POST', '/criteria', { as: USERS.faculty, body: { name: 'Pacing' } });
    assert.equal(res.status, 403);
  });

  test('the AC can create, edit, and deactivate a criterion', async () => {
    const created = await ctx.api('POST', '/criteria', { as: USERS.ac, body: { name: 'Pacing', maxScore: 5 } });
    assert.equal(created.status, 201);

    const edited = await ctx.api('PATCH', `/criteria/${created.body.id}`, { as: USERS.ac, body: { description: 'Moves at a reasonable pace' } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.description, 'Moves at a reasonable pace');

    const deactivated = await ctx.api('PATCH', `/criteria/${created.body.id}`, { as: USERS.ac, body: { isActive: false } });
    assert.equal(deactivated.body.isActive, false);

    const active = await ctx.api('GET', '/criteria', { as: USERS.faculty });
    assert.ok(!active.body.data.some((c) => c.id === created.body.id));
  });

  test('a duplicate criterion name: 409', async () => {
    const res = await ctx.api('POST', '/criteria', { as: USERS.ac, body: { name: 'Instructional clarity' } });
    assert.equal(res.status, 409);
  });
});

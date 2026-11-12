// Department Head and Annual Review Committee: view-only access to completed
// observations (requirements §3, §4.3 step 10, §4.6).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
let completedId;
let inProgressId;

// Observee: teacher 3. Observer: teacher 1.
async function makeObservation(status) {
  const [section] = await ctx.sql(
    `SELECT cs.id, cs.term_id FROM course_sections cs
      WHERE cs.id NOT IN (SELECT section_id FROM assessments)
      ORDER BY cs.id LIMIT 1`,
  );
  const signed = status === 'completed' ? 'now()' : 'NULL';
  const [assessment] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id, status)
     VALUES (3, $1, $2, $3) RETURNING id`,
    [section.id, section.term_id, status],
  );
  const [observation] = await ctx.sql(
    `INSERT INTO observations (assessment_id, observee_id, observer_id, attempt_no, status,
                               scheduled_date, observer_signed_off_at, observee_signed_off_at)
     VALUES ($1, 3, 1, 1, $2, CURRENT_DATE - 1, ${signed}, ${signed}) RETURNING id`,
    [assessment.id, status],
  );
  return observation.id;
}

const VIEW_ONLY = [['Department Head', USERS.deptHead, 'dept_head'], ['Annual Review Committee', USERS.review, 'annual_review']];

before(async () => {
  ctx = await startIntegration();
  completedId = await makeObservation('completed');
  inProgressId = await makeObservation('approved');
  await ctx.sql(
    `INSERT INTO observation_responses (observation_id, criterion_id, score) VALUES ($1, 1, 4)`,
    [completedId],
  );
});
after(async () => { await ctx?.close(); });

for (const [label, email, role] of VIEW_ONLY) {
  describe(`${label} (${role})`, () => {
    test('can log in, with no teacher profile', async () => {
      const res = await ctx.login(email);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, role);
      assert.equal(res.body.user.teacherId, null);
    });

    test('lists completed observations only', async () => {
      const res = await ctx.api('GET', '/observations?pageSize=100', { as: email });
      assert.equal(res.status, 200);
      const ids = res.body.data.map((o) => o.id);
      assert.ok(ids.includes(completedId));
      assert.ok(!ids.includes(inProgressId));
      assert.ok(res.body.data.every((o) => o.status === 'completed'));
    });

    test('can open a completed observation and its responses', async () => {
      assert.equal((await ctx.api('GET', `/observations/${completedId}`, { as: email })).status, 200);
      const res = await ctx.api('GET', `/observations/${completedId}/responses`, { as: email });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    test('an in-progress observation is not found', async () => {
      assert.equal((await ctx.api('GET', `/observations/${inProgressId}`, { as: email })).status, 404);
      assert.equal((await ctx.api('GET', `/observations/${inProgressId}/responses`, { as: email })).status, 404);
    });

    test('cannot write to an observation', async () => {
      const body = { responses: [{ criterionId: 1, score: 5 }] };
      assert.equal((await ctx.api('POST', `/observations/${completedId}/responses`, { as: email, body })).status, 403);
      assert.equal((await ctx.api('POST', `/observations/${inProgressId}/sign-off`, { as: email })).status, 403);
    });

    test('can read terms and criteria but not change them', async () => {
      assert.equal((await ctx.api('GET', '/terms', { as: email })).status, 200);
      assert.equal((await ctx.api('GET', '/criteria', { as: email })).status, 200);
      const criterion = { name: 'Pacing', maxScore: 5 };
      assert.equal((await ctx.api('POST', '/criteria', { as: email, body: criterion })).status, 403);
    });

    test('is kept out of sign-ups, professors, courses, sections and scheduling', async () => {
      for (const path of ['/assessments', '/teachers', '/teachers/3', '/courses', '/sections']) {
        assert.equal((await ctx.api('GET', path, { as: email })).status, 403, `GET ${path}`);
      }
      assert.equal((await ctx.api('POST', '/assessments', { as: email, body: {} })).status, 403);
      assert.equal((await ctx.api('POST', '/time-options/offers/1/respond', { as: email, body: {} })).status, 403);
    });
  });
}

describe('GET /observations/:id shape', () => {
  test('returns the nested list shape plus the flat ids', async () => {
    const res = await ctx.api('GET', `/observations/${completedId}`, { as: USERS.faculty });
    assert.equal(res.status, 200);
    const o = res.body;
    assert.equal(o.id, completedId);
    assert.equal(o.observeeId, 3);
    assert.equal(o.observerId, 1);
    assert.equal(o.observee.id, 3);
    assert.equal(o.observer.id, 1);
    assert.ok(o.observer.lastName);
    assert.ok(o.section.course.courseNumber);
    assert.ok(o.section.term.season);
    assert.ok(o.observerSignedOffAt && o.observeeSignedOffAt);
  });
});

describe('registering a view-only account', () => {
  test('admin can create one without a teacher profile', async () => {
    const body = { email: 'second.reviewer@example.edu', password: 'Long-enough-pass-1', role: 'annual_review' };
    const res = await ctx.api('POST', '/auth/register', { as: USERS.admin, body });
    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'annual_review');
    assert.equal(res.body.teacherId, null);
  });

  test('linking it to a teacher profile is refused', async () => {
    const body = { email: 'linked.head@example.edu', password: 'Long-enough-pass-1', role: 'dept_head', teacherId: 5 };
    assert.equal((await ctx.api('POST', '/auth/register', { as: USERS.admin, body })).status, 400);
  });

  test('the database also refuses a linked view-only account', async () => {
    await assert.rejects(
      ctx.sql(`UPDATE users SET teacher_id = 5 WHERE email = $1`, [USERS.deptHead]),
      /users_view_only_no_teacher/,
    );
  });
});

// GET /time-options/incoming: the observer's inbox (IncomingRequest.jsx and
// the nav counter read it). It was mock-only, so on the real backend an
// observer never saw a request.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
let assessmentId;
let options;
before(async () => {
  ctx = await startIntegration();
  // A sign-up for Sofia Alvarez (teacher 3) with two future dates, both
  // offered to teacher 1 (professor.a@). 06:00 avoids every seeded class.
  const [section] = await ctx.sql(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id)
     SELECT course_id, term_id, 'IN1', 3 FROM course_sections WHERE teacher_id = 3 ORDER BY id LIMIT 1
     RETURNING id, term_id`,
  );
  [{ id: assessmentId }] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id) VALUES (3, $1, $2) RETURNING id`,
    [section.id, section.term_id],
  );
  options = await ctx.sql(
    `INSERT INTO assessment_time_options (assessment_id, proposed_date, start_time, end_time)
     VALUES ($1, CURRENT_DATE + 5, '06:00', '06:30'), ($1, CURRENT_DATE + 6, '06:00', '06:30')
     RETURNING id`,
    [assessmentId],
  );
  for (const o of options) {
    await ctx.sql(`INSERT INTO time_option_offers (option_id, teacher_id, status) VALUES ($1, 1, 'pending')`, [o.id]);
  }
});
after(async () => { await ctx?.close(); });

const inbox = async (as) => {
  const res = await ctx.api('GET', '/time-options/incoming', { as });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
};

test('the observer sees one pending request with who asked, the class and both dates', async () => {
  const data = await inbox(USERS.profA);
  assert.equal(data.length, 1);
  const [req] = data;
  assert.equal(req.assessmentId, assessmentId);
  assert.equal(req.status, 'pending');
  assert.equal(req.observee.id, 3);
  assert.ok(req.section.course.courseNumber, 'section carries its course');
  assert.ok(req.section.term, 'section carries its term');
  assert.deepEqual(req.options.map((o) => o.id).sort(), options.map((o) => o.id).sort());
  assert.ok(req.options.every((o) => o.isConfirmed === false));
});

test('nobody else sees it, and an account without a teacher profile gets an empty list', async () => {
  assert.equal((await inbox(USERS.profD)).length, 0);
  assert.equal((await inbox(USERS.admin)).length, 0);
});

test('after the observer confirms a date the request shows as confirmed', async () => {
  const res = await ctx.api('POST', `/time-options/${options[1].id}/confirm`, { as: USERS.profA });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [req] = await inbox(USERS.profA);
  assert.equal(req.status, 'confirmed');
  assert.equal(req.options.find((o) => o.isConfirmed).id, options[1].id);
});

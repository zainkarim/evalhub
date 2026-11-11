import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

async function check(label, participating, eligible, ratePercent) {
  const res = await ctx.api(
    'GET', '/teachers/report?termId=10', { as: USERS.ac },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.assessmentParticipation, {
    participating, eligible, ratePercent,
  });
  console.log(`${label}: ${JSON.stringify(res.body.assessmentParticipation)}`);
}

test('participation counts distinct eligible active faculty', async () => {
  await check('Seed: one of ten participates', 1, 10, 10);

  // A second section for Professor C must not count them twice.
  const [section] = await ctx.sql(
    `INSERT INTO course_sections
       (course_id, term_id, section_number, teacher_id)
     VALUES (1, 10, 'PARTICIPATION', 3) RETURNING id`,
  );
  const [extra] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id)
     VALUES (3, $1, 10) RETURNING id`,
    [section.id],
  );
  await check('Two sign-ups, same professor', 1, 10, 10);

  await ctx.sql(
    `UPDATE assessments SET status = 'cancelled'
      WHERE id = ANY($1::int[])`,
    [[1, extra.id]],
  );
  await check('Cancelled sign-ups excluded', 0, 10, 0);

  await ctx.sql(
    `UPDATE assessments SET status = 'not_eligible'
      WHERE id = ANY($1::int[])`,
    [[1, extra.id]],
  );
  await check('Ineligible sign-ups excluded', 0, 10, 0);

  await ctx.sql(
    "UPDATE assessments SET status = 'postponed' WHERE id = $1",
    [extra.id],
  );
  await check('Postponed sign-up counts', 1, 10, 10);

  await ctx.sql('UPDATE teachers SET is_active = FALSE WHERE id = 3');
  await check('Inactive participant excluded from both counts', 0, 9, 0);
  await ctx.sql('UPDATE teachers SET is_active = TRUE WHERE id = 3');

  // A recent completed observation makes C not due in Fall 2026.
  // Assessment 2 already belongs to C in Spring 2026.
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date,
        observer_signed_off_at, observee_signed_off_at)
     VALUES (2, 3, 2, 1, 'completed', '2026-02-02',
             '2026-02-02T18:00:00Z', '2026-02-02T18:00:00Z')`,
  );
  await check('Not-due participant excluded from both counts', 0, 9, 0);

  await ctx.sql('UPDATE teachers SET is_active = FALSE');
  await check('Empty population returns null rate', 0, 0, null);
});

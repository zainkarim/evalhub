import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

async function check(label, submitted, expected, ratePercent) {
  const res = await ctx.api(
    'GET', '/teachers/report?termId=10', { as: USERS.ac },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.surveyCompletion, {
    submitted, expected, ratePercent,
  });
  console.log(`${label}: ${JSON.stringify(res.body.surveyCompletion)}`);
}

test('survey completion counts observee responses for completed observations', async () => {
  await check('No completed observations', 0, 0, null);

  // Seed assessment 1: Professor C, Fall 2026.
  const [observation] = await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date)
     VALUES (1, 3, 1, 1, 'approved', '2026-10-01')
     RETURNING id`,
  );
  await check('Unfinished observation excluded', 0, 0, null);

  await ctx.sql(
    `UPDATE observations
        SET status = 'completed',
            observer_signed_off_at = '2026-10-01T18:00:00Z',
            observee_signed_off_at = '2026-10-01T18:00:00Z'
      WHERE id = $1`,
    [observation.id],
  );
  await ctx.sql(
    "UPDATE assessments SET status = 'completed' WHERE id = 1",
  );
  await check('Completed, no survey submitted', 0, 1, 0);

  await ctx.sql(
    `INSERT INTO process_feedback (observation_id, respondent_id, rating)
     VALUES ($1, 1, 4)`,
    [observation.id],
  );
  await check('Observer response does not satisfy observee survey', 0, 1, 0);

  await ctx.sql(
    `INSERT INTO process_feedback (observation_id, respondent_id, rating)
     VALUES ($1, 3, 5)`,
    [observation.id],
  );
  await check('Observee response completes survey', 1, 1, 100);

  // A completed observation in another term must not affect Fall 2026.
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date,
        observer_signed_off_at, observee_signed_off_at)
     VALUES (2, 3, 1, 1, 'completed', '2026-02-02',
             '2026-02-02T18:00:00Z', '2026-02-02T18:00:00Z')`,
  );
  await check('Other-term observation excluded', 1, 1, 100);
});

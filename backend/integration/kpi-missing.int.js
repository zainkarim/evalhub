import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

async function check(label, expected) {
  const res = await ctx.api(
    'GET', '/teachers/report?termId=10', { as: USERS.ac },
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.counts.missingObservations, expected);
  console.log(
    `${label}: expected=${expected}, actual=${res.body.counts.missingObservations}`,
  );
}

test('missing observations count unfinished sign-ups once', async () => {
  // Seed: assessment 1 is Fall 2026, with no observation.
  // Assessment 2 belongs to Spring 2026 and must not count.
  await check('Seed: sign-up without observation', 1);
  await ctx.sql('UPDATE teachers SET is_active = FALSE WHERE id = 3');
  await check('Inactive professor excluded', 0);

  await ctx.sql('UPDATE teachers SET is_active = TRUE WHERE id = 3');
  await check('Reactivated professor included again', 1);

  const [observation] = await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date)
     VALUES (1, 3, 1, 1, 'approved', '2026-10-01')
     RETURNING id`,
  );
  await check('Scheduled but unfinished', 1);

  await ctx.sql(
    "UPDATE observations SET status = 'postponed' WHERE id = $1",
    [observation.id],
  );
  await ctx.sql(
    "UPDATE assessments SET status = 'postponed' WHERE id = 1",
  );
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no, status)
     VALUES (1, 3, 1, 2, 'proposed')`,
  );
  await check('Two attempts still count one missing sign-up', 1);

  await ctx.sql(
    "UPDATE assessments SET status = 'cancelled' WHERE id = 1",
  );
  await check('Cancelled sign-up excluded', 0);

  await ctx.sql(
    "UPDATE assessments SET status = 'not_eligible' WHERE id = 1",
  );
  await check('Ineligible sign-up excluded', 0);

  // An assessment label alone is not proof of a completed observation.
  await ctx.sql(
    "UPDATE assessments SET status = 'completed' WHERE id = 1",
  );
  await check('Completed assessment label, unfinished observations', 1);

  await ctx.sql(
    `UPDATE observations
        SET status = 'completed',
            scheduled_date = '2026-10-01',
            observer_signed_off_at = '2026-10-01T18:00:00Z',
            observee_signed_off_at = '2026-10-01T18:00:00Z'
      WHERE assessment_id = 1 AND attempt_no = 2`,
  );
  await check('Completed observation clears the sign-up', 0);
});

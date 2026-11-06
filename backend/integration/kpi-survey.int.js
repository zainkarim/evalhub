import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

async function checkUnavailable(label) {
  const res = await ctx.api(
    'GET', '/teachers/report?termId=10', { as: USERS.ac },
  );
  assert.equal(res.status, 200);

  const survey = res.body.surveyCompletion;
  assert.equal(survey.status, 'unavailable');
  assert.equal(survey.submitted, null);
  assert.equal(survey.expected, null);
  assert.equal(survey.ratePercent, null);
  assert.ok(typeof survey.reason === 'string' && survey.reason.length > 0);

  console.log(`${label}: ${JSON.stringify(survey)}`);
}

test('survey completion stays unavailable until submissions are supported', async () => {
  await checkUnavailable('No completed observations');

  // Completing an observation must not produce a false measured 0%.
  const [observation] = await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date,
        observer_signed_off_at, observee_signed_off_at)
     VALUES (1, 3, 1, 1, 'completed', '2026-10-01',
             '2026-10-01T18:00:00Z', '2026-10-01T18:00:00Z')
     RETURNING id`,
  );
  await ctx.sql(
    "UPDATE assessments SET status = 'completed' WHERE id = 1",
  );
  await checkUnavailable('Completed observation without feedback');

  // Manually seeded feedback does not establish a working submission flow.
  await ctx.sql(
    `INSERT INTO process_feedback (observation_id, respondent_id, rating)
     VALUES ($1, 3, 5)`,
    [observation.id],
  );
  await checkUnavailable('Manually seeded feedback');
});

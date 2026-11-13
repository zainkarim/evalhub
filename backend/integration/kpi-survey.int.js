import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;

before(async () => {
  ctx = await startIntegration();
});

after(async () => {
  await ctx?.close();
});

async function check(expected, submitted, ratePercent) {
  const res = await ctx.api(
    'GET', '/teachers/report?termId=10', { as: USERS.ac },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.surveyCompletion, {
    submitted,
    expected,
    ratePercent,
  });
}

const surveyBody = {
  rating: 5,
  feedback: 'The process was helpful.',
  suggestions: 'Make scheduling easier.',
};

test('one term survey covers all completed observations for the observee', async () => {
  // No completed observations yet.
  await check(0, 0, null);

  const [first] = await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date, observer_signed_off_at, observee_signed_off_at)
     VALUES (1, 3, 1, 1, 'completed', '2026-10-01',
             '2026-10-01T18:00:00Z', '2026-10-01T18:00:00Z')
     RETURNING id`,
  );

  await ctx.sql(
    "UPDATE assessments SET status = 'completed' WHERE id = 1",
  );

  await check(1, 0, 0);

  // Old feedback is not a term survey.
  await ctx.sql(
    `INSERT INTO process_feedback
       (observation_id, respondent_id, rating)
     VALUES ($1, 3, 5)`,
    [first.id],
  );

  await check(1, 0, 0);

  // Add another observation for the same observee.
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date, observer_signed_off_at, observee_signed_off_at)
     VALUES (1, 3, 1, 2, 'completed', '2026-10-02',
             '2026-10-02T18:00:00Z', '2026-10-02T18:00:00Z')`,
  );

  await check(2, 0, 0);

  // Open the survey.
  await ctx.sql(
    `UPDATE terms
     SET observation_deadline = CURRENT_DATE - 1,
         feedback_deadline = CURRENT_DATE + 7
     WHERE id = 10`,
  );

  const submit = await ctx.api('POST', '/surveys', {
    as: USERS.faculty,
    body: surveyBody,
  });

  assert.equal(submit.status, 201);

  // One survey covers both completed observations.
  await check(2, 2, 100);

  // A second survey is not allowed.
  const duplicate = await ctx.api('POST', '/surveys', {
    as: USERS.faculty,
    body: surveyBody,
  });

  assert.equal(duplicate.status, 409);
  await check(2, 2, 100);

  // Inactive observees should not count.
  await ctx.sql(
    'UPDATE teachers SET is_active = FALSE WHERE id = 3',
  );

  await check(0, 0, null);
});

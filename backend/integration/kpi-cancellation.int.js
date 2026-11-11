import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

async function check(label, participating, missing) {
  const res = await ctx.api('GET', '/teachers/report?termId=10', {
    as: USERS.ac,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.assessmentParticipation, {
    participating,
    eligible: 10,
    ratePercent: participating * 10,
  });
  assert.equal(res.body.counts.missingObservations, missing);
  console.log(`${label}: participating=${participating}, missing=${missing}`);
}

async function cancel(id, reason) {
  const res = await ctx.api('POST', `/assessments/${id}/cancel`, {
    as: USERS.ac,
    body: { reason },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'postponed');

  const [attempt] = await ctx.sql(
    `SELECT reason FROM cancellation_attempts
      WHERE assessment_id = $1 ORDER BY id DESC LIMIT 1`,
    [id],
  );
  assert.equal(attempt.reason, reason);
}

test('KPI exclusions use cancellation reasons from the real endpoint', async () => {
  await check('Seed sign-up counts', 1, 1);

  await cancel(1, 'other');
  await check('Ordinary postponement still counts', 1, 1);

  await cancel(1, 'not_eligible');
  await check('Ineligible sign-up excluded despite postponed status', 0, 0);

  // Another qualifying sign-up for the same professor must still count.
  const [section] = await ctx.sql(
    `INSERT INTO course_sections
       (course_id, term_id, section_number, teacher_id)
     VALUES (1, 10, 'KPI-CANCEL', 3) RETURNING id`,
  );
  const signup = await ctx.api('POST', '/assessments/sign-up', {
    as: USERS.faculty,
    body: { sectionId: section.id },
  });
  assert.equal(signup.status, 201);
  await check('Another qualifying sign-up still counts', 1, 1);

  await cancel(signup.body.id, 'left_department');
  await check('Left-department sign-up excluded despite postponed status', 0, 0);
});

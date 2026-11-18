import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

// #72 review fixes: empty pools, postponed attempts, utilization cap, unset
// deadline, and which course an unmatched professor is shown with.
// Fixture: a sign-up for Professor C (teacher 3) in Fall 2026 (term 10) for a
// course in a department nobody belongs to, so its observer pool is always empty.
let ctx;
let assessmentId;
const TERM = 10;

before(async () => {
  ctx = await startIntegration();
  const [course] = await ctx.sql(
    `INSERT INTO courses (subject, school, course_number, title)
     VALUES ('ZZZ', 'ECS', '9999', 'Empty pool course') RETURNING id`,
  );
  const [section] = await ctx.sql(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id)
     VALUES ($1, $2, 'KPI111', 3) RETURNING id`,
    [course.id, TERM],
  );
  const [assessment] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id, status)
     VALUES (3, $1, $2, 'signed_up') RETURNING id`,
    [section.id, TERM],
  );
  assessmentId = assessment.id;
});
after(async () => { await ctx?.close(); });

const report = async () => {
  const res = await ctx.api('GET', `/teachers/report?termId=${TERM}`, { as: USERS.ac });
  assert.equal(res.status, 200);
  return res.body;
};
const setStatus = (status) =>
  ctx.sql('UPDATE assessments SET status = $2 WHERE id = $1', [assessmentId, status]);

test('an empty pool is saved as a 0/0 list, once, and shows under unmatched faculty', async () => {
  const before = await report();

  for (let i = 0; i < 2; i += 1) {
    const res = await ctx.api('POST', `/assessments/${assessmentId}/candidates`, { as: USERS.ac });
    assert.equal(res.status, 200);
    assert.equal(res.body.poolSize, 0);
  }
  const lists = await ctx.sql(
    'SELECT pool_size, list_size FROM candidate_lists WHERE assessment_id = $1',
    [assessmentId],
  );
  assert.deepEqual(lists, [{ pool_size: 0, list_size: 0 }], 'one empty list, not one per click');

  const after = await report();
  assert.equal(after.listSufficiency.generated, before.listSufficiency.generated + 1);
  const entry = after.unmatchedFaculty.find((u) => u.assessmentId === assessmentId);
  assert.ok(entry, 'the empty pool is listed');
  assert.equal(entry.teacherId, 3);
  // Looked up by assessment id: Professor C has another sign-up in this term.
  assert.equal(entry.course, 'ZZZ 9999');
  assert.equal(entry.section, 'KPI111');
});

test('sign-ups that are no longer waiting or are closed leave the list KPIs', async () => {
  const withList = await report();

  await setStatus('postponed');
  const postponed = await report();
  assert.ok(!postponed.unmatchedFaculty.some((u) => u.assessmentId === assessmentId),
    'a postponed sign-up is no longer unmatched');
  assert.equal(postponed.listSufficiency.generated, withList.listSufficiency.generated);

  await setStatus('cancelled');
  const cancelled = await report();
  assert.equal(cancelled.listSufficiency.generated, withList.listSufficiency.generated - 1,
    'a cancelled sign-up is not a generated list');

  await setStatus('signed_up');
});

test('observations on a postponed sign-up do not count as observer load', async () => {
  const baseline = (await report()).averageObservationsPerObserver.totalObservations;

  await setStatus('postponed');
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observer_id, observee_id, attempt_no, status, scheduled_date)
     VALUES ($1, 2, 3, 1, 'approved', '2026-12-01')`,
    [assessmentId],
  );
  assert.equal((await report()).averageObservationsPerObserver.totalObservations, baseline);

  await setStatus('signed_up');
  assert.equal((await report()).averageObservationsPerObserver.totalObservations, baseline + 1);
});

test('observer utilization never goes above 100%', async () => {
  // Two more observers who did not sign up themselves, so they are outside the pool.
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observer_id, observee_id, attempt_no, status, scheduled_date)
     VALUES ($1, 4, 3, 2, 'approved', '2026-12-02'), ($1, 5, 3, 3, 'approved', '2026-12-03')`,
    [assessmentId],
  );
  const { observerUtilization } = await report();
  assert.ok(observerUtilization.activeObservers <= observerUtilization.poolSize);
  assert.ok(observerUtilization.ratePercent <= 100);
});

test('a term with no observation deadline uses its end date for outstanding observations', async () => {
  const [term] = await ctx.sql(
    'SELECT start_date, end_date, observation_deadline FROM terms WHERE id = $1', [TERM],
  );
  try {
    await ctx.sql('UPDATE terms SET observation_deadline = NULL WHERE id = $1', [TERM]);
    let body = await report();
    assert.ok(!body.outstandingObservations.some((o) => o.assessmentId === assessmentId),
      'the term has not ended yet');

    await ctx.sql(
      `UPDATE terms SET start_date = current_date - 100, end_date = current_date - 2 WHERE id = $1`, [TERM],
    );
    body = await report();
    assert.ok(body.outstandingObservations.some((o) => o.assessmentId === assessmentId),
      'the term ended and no deadline is set, so the open sign-up is outstanding');
  } finally {
    await ctx.sql(
      'UPDATE terms SET start_date = $2, end_date = $3, observation_deadline = $4 WHERE id = $1',
      [TERM, term.start_date, term.end_date, term.observation_deadline],
    );
  }
});

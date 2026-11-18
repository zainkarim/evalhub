import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

async function makeAssessment(termId, sectionNumber) {
  const [section] = await ctx.sql(
    `INSERT INTO course_sections
       (course_id, term_id, section_number, teacher_id)
     VALUES (1, $1, $2, 1) RETURNING id`,
    [termId, sectionNumber],
  );
  const [assessment] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id)
     VALUES (1, $1, $2) RETURNING id`,
    [section.id, termId],
  );
  return assessment.id;
}

async function checkReport(label, outstanding, completedInTerm) {
  const res = await ctx.api(
    'GET', '/teachers/report?termId=10', { as: USERS.ac },
  );
  assert.equal(res.status, 200);

  const professor = res.body.data.find((row) => row.id === 1);
  assert.equal(professor.dueStatus, 'overdue');
  assert.equal(professor.hasCompletedInTerm, completedInTerm);
  assert.equal(res.body.counts.overdueOutstanding, outstanding);
  assert.equal(res.body.counts.overdue, 1);

  console.log(
    `${label}: expected outstanding=${outstanding}, ` +
    `actual=${res.body.counts.overdueOutstanding}; ` +
    `historical overdue=${res.body.counts.overdue}`,
  );
}

test('outstanding overdue clears only after a completed observation', async () => {
  // Professor A is an associate professor.
  // Last observed Fall 2023 -> due Fall 2025 -> overdue Fall 2026.
  const previous = await makeAssessment(1, 'OVERDUE-OLD');
  await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date,
        observer_signed_off_at, observee_signed_off_at)
     VALUES ($1, 1, 2, 1, 'completed', '2023-10-02',
             '2023-10-02T18:00:00Z', '2023-10-02T18:00:00Z')`,
    [previous],
  );
  await ctx.sql(
    "UPDATE assessments SET status = 'completed' WHERE id = $1",
    [previous],
  );

  await checkReport('No current observation', 1, false);

  const current = await makeAssessment(10, 'OVERDUE-NOW');
  const [observation] = await ctx.sql(
    `INSERT INTO observations
       (assessment_id, observee_id, observer_id, attempt_no,
        status, scheduled_date)
     VALUES ($1, 1, 2, 1, 'approved', '2026-10-01')
     RETURNING id`,
    [current],
  );
  await ctx.sql(
    "UPDATE assessments SET status = 'approved' WHERE id = $1",
    [current],
  );

  await checkReport('Scheduled but unfinished', 1, false);

  // An assessment label alone must not clear the KPI.
  await ctx.sql(
    "UPDATE assessments SET status = 'completed' WHERE id = $1",
    [current],
  );
  await checkReport('Assessment completed, observation unfinished', 1, false);

  await ctx.sql(
    `UPDATE observations
        SET status = 'completed',
            observer_signed_off_at = '2026-10-01T18:00:00Z',
            observee_signed_off_at = '2026-10-01T18:00:00Z'
      WHERE id = $1`,
    [observation.id],
  );
  await checkReport('Observation completed with both signatures', 0, true);
});

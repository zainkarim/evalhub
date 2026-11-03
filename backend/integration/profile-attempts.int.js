import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

// #96: AC cancels a sign-up, then the professor's profile shows the attempt
// (number, reason, who requested it) under signUp.attempts.
describe('signUp.attempts on the teacher profile', () => {
  let ctx;
  let assessmentId;
  let termId;

  before(async () => {
    ctx = await startIntegration();
    const [section] = await ctx.sql(
      `SELECT cs.id, cs.term_id FROM course_sections cs
        WHERE cs.id NOT IN (SELECT section_id FROM assessments)
        ORDER BY cs.id LIMIT 1`,
    );
    const [assessment] = await ctx.sql(
      `INSERT INTO assessments (teacher_id, section_id, due_term_id, status)
       VALUES (3, $1, $2, 'approved') RETURNING id`,
      [section.id, section.term_id],
    );
    assessmentId = assessment.id;
    termId = section.term_id;
  });

  after(async () => {
    await ctx?.close();
  });

  const profile = async () => {
    const res = await ctx.api('GET', `/teachers/3/profile?termId=${termId}`, { as: USERS.ac });
    assert.equal(res.status, 200);
    return res.body.signUp;
  };

  test('cancelling a sign-up shows up as attempt 1 with reason and requester', async () => {
    const res = await ctx.api('POST', `/assessments/${assessmentId}/cancel`, {
      as: USERS.ac,
      body: { reason: 'other', notes: 'integration test' },
    });
    assert.ok(res.status >= 200 && res.status < 300, `cancel failed: ${res.status}`);

    const signUp = await profile();
    assert.equal(signUp.assessmentId, assessmentId);
    assert.equal(signUp.attempts.length, 1);
    const [attempt] = signUp.attempts;
    assert.equal(attempt.attemptNo, 1);
    assert.equal(attempt.type, 'postponed');
    assert.equal(attempt.reason, 'other');
    assert.equal(attempt.by.name, 'Professor B');
    assert.equal(attempt.by.role, 'ac_member');
  });

  test('a not_completed observation is an attempt with the observer and no actor', async () => {
    await ctx.sql(
      `INSERT INTO observations (assessment_id, observer_id, observee_id, attempt_no, status)
       VALUES ($1, 2, 3, 1, 'not_completed')`,
      [assessmentId],
    );

    const { attempts } = await profile();
    const closed = attempts.find((a) => a.type === 'not_completed');
    assert.ok(closed, 'not_completed attempt missing');
    assert.equal(closed.by, null);
    assert.equal(closed.observer.id, 2);
    assert.equal(closed.observer.lastName, 'B');
    assert.deepEqual(attempts.map((a) => a.attemptNo), [1, 2]);
  });

  test('the attempt count on the summary and the report matches the history', async () => {
    const res = await ctx.api('GET', `/teachers/3/profile?termId=${termId}`, { as: USERS.ac });
    assert.equal(res.body.summary.attempts, res.body.signUp.attempts.length);

    const report = await ctx.api('GET', `/teachers/report?termId=${termId}`, { as: USERS.ac });
    const row = report.body.data.find((r) => r.id === 3);
    assert.equal(row.attempts, res.body.signUp.attempts.length);
  });
});

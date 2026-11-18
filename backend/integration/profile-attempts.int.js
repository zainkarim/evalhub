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
    assert.equal(attempt.notes, 'integration test', 'the written reason is returned, not just the code');
    // Expected name comes from the table, so a seed rename (#101/#115) can't break this.
    const [ac] = await ctx.sql('SELECT first_name, last_name FROM teachers WHERE id = 2');
    assert.equal(attempt.by.name, `${ac.first_name} ${ac.last_name}`);
    assert.equal(attempt.by.role, 'ac_member');
  });

  test('a not_completed observation is an attempt with the observer and no actor', async () => {
    await ctx.sql(
      `INSERT INTO observations (assessment_id, observer_id, observee_id, attempt_no, status, ac_notes)
       VALUES ($1, 2, 3, 1, 'not_completed', 'committee only')`,
      [assessmentId],
    );

    const { attempts } = await profile();
    // 'not_completed' is reported as the frontend's 'did_not_happen' label.
    const closed = attempts.find((a) => a.type === 'did_not_happen');
    assert.ok(closed, 'did_not_happen attempt missing');
    // by is an object with null fields: AttemptHistory.jsx reads entry.by.name.
    assert.deepEqual(closed.by, { name: null, role: null });
    // The committee's private ac_notes must not reach the professor's profile.
    assert.equal(closed.reason, null);
    assert.equal(closed.notes, null);
    assert.equal(closed.observer.id, 2);
    const [observer] = await ctx.sql('SELECT last_name FROM teachers WHERE id = 2');
    assert.equal(closed.observer.lastName, observer.last_name);
    assert.deepEqual(attempts.map((a) => a.attemptNo), [1, 2]);
  });

  test('the attempt count on the summary and the report matches the history', async () => {
    const res = await ctx.api('GET', `/teachers/3/profile?termId=${termId}`, { as: USERS.ac });
    assert.equal(res.body.summary.attempts, res.body.signUp.attempts.length);

    const report = await ctx.api('GET', `/teachers/report?termId=${termId}`, { as: USERS.ac });
    const row = report.body.data.find((r) => r.id === 3);
    assert.equal(row.attempts, res.body.signUp.attempts.length);
  });

  test('postponing a scheduled attempt is one entry with the observer, the date and the reason', async () => {
    const [option] = await ctx.sql(
      `INSERT INTO assessment_time_options (assessment_id, proposed_date, start_time, end_time)
       VALUES ($1, CURRENT_DATE - 3, '06:00', '06:30') RETURNING id, proposed_date`,
      [assessmentId],
    );
    await ctx.sql(
      `INSERT INTO time_option_offers (option_id, teacher_id, status) VALUES ($1, 1, 'accepted')`,
      [option.id],
    );
    const finalized = await ctx.api('POST', `/assessments/${assessmentId}/time-options/${option.id}/finalize`, {
      as: USERS.faculty, body: { teacherId: 1 },
    });
    assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
    const [scheduled] = await ctx.sql(
      `SELECT id FROM observations WHERE assessment_id = $1 AND status = 'approved'`,
      [assessmentId],
    );
    const postponed = await ctx.api('POST', `/observations/${scheduled.id}/postpone`, {
      as: USERS.profA, body: { reason: 'Observer out sick' },
    });
    assert.equal(postponed.status, 200, JSON.stringify(postponed.body));

    const res = await ctx.api('GET', `/teachers/3/profile?termId=${termId}`, { as: USERS.ac });
    const { attempts } = res.body.signUp;
    assert.equal(attempts.length, 3, 'the postponement and the attempt it closed are one entry');
    const last = attempts.at(-1);
    assert.equal(last.type, 'postponed');
    assert.equal(last.notes, 'Observer out sick');
    assert.equal(last.observer.id, 1);
    assert.equal(last.date, option.proposed_date);
    assert.ok(last.by.name, 'who postponed it is recorded');

    assert.equal(res.body.summary.attempts, 3);
    const report = await ctx.api('GET', `/teachers/report?termId=${termId}`, { as: USERS.ac });
    assert.equal(report.body.data.find((r) => r.id === 3).attempts, 3);
  });
});

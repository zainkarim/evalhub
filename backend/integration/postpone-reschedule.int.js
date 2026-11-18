// #134: a sign-up postponed after its date was confirmed can be rescheduled in
// the same semester, with the same observer or a different one, and nothing
// about the postponed attempt is lost.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';
import { observerCommitmentsSql } from '../src/lib/observerCapacity.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

// Observee: Professor C (teacher 3, faculty@). Observers: teacher 1 (profA@),
// teacher 4 (profD@). Past dates at 06:00 so nothing conflicts with a class.
async function makeAssessment() {
  const [section] = await ctx.sql(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id)
     SELECT course_id, term_id, 'P1', 3 FROM course_sections WHERE teacher_id = 3 ORDER BY id LIMIT 1
     RETURNING id, term_id`,
  );
  const [assessment] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id) VALUES (3, $1, $2) RETURNING id`,
    [section.id, section.term_id],
  );
  return assessment.id;
}

async function acceptedOption(assessmentId, daysAgo, teacherId) {
  const [option] = await ctx.sql(
    `INSERT INTO assessment_time_options (assessment_id, proposed_date, start_time, end_time)
     VALUES ($1, CURRENT_DATE - $2::int, '06:00', '06:30') RETURNING id, proposed_date`,
    [assessmentId, daysAgo],
  );
  await ctx.sql(
    `INSERT INTO time_option_offers (option_id, teacher_id, status) VALUES ($1, $2, 'accepted')`,
    [option.id, teacherId],
  );
  return option;
}

const finalize = (assessmentId, optionId, teacherId) =>
  ctx.api('POST', `/assessments/${assessmentId}/time-options/${optionId}/finalize`, {
    as: USERS.faculty,
    body: { teacherId },
  });

const observationsFor = (assessmentId) =>
  ctx.sql('SELECT * FROM observations WHERE assessment_id = $1 ORDER BY attempt_no', [assessmentId]);

const statusOf = async (assessmentId) =>
  (await ctx.sql('SELECT status FROM assessments WHERE id = $1', [assessmentId]))[0].status;

describe('postponing after a confirmed date, then rescheduling', () => {
  let a; let first; let second;

  before(async () => {
    a = await makeAssessment();
    first = await acceptedOption(a, 10, 1);
    const res = await finalize(a, first.id, 1);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('the committee postpones: attempt kept, date released, reason logged', async () => {
    const res = await ctx.api('POST', `/assessments/${a}/postpone`, {
      as: USERS.ac,
      body: { reason: 'Observer was ill' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'postponed');

    const [attempt] = await observationsFor(a);
    assert.equal(attempt.status, 'postponed');
    assert.equal(attempt.observer_id, 1);
    assert.equal(attempt.scheduled_date, first.proposed_date);

    const [option] = await ctx.sql('SELECT * FROM assessment_time_options WHERE id = $1', [first.id]);
    assert.equal(option.is_confirmed, false);
    assert.ok(option.released_at, 'released_at is set');
    assert.equal(option.confirmed_teacher_id, 1, 'who was booked stays on record');

    const [offerRow] = await ctx.sql(
      `SELECT f.status, x.action, x.reason FROM time_option_offers f
         JOIN time_option_offer_actions x ON x.offer_id = f.id
        WHERE f.option_id = $1`,
      [first.id],
    );
    assert.deepEqual(offerRow, { status: 'declined', action: 'withdrawn', reason: 'Sign-up postponed' });

    const [log] = await ctx.sql('SELECT * FROM cancellation_attempts WHERE assessment_id = $1', [a]);
    assert.equal(log.reason, 'other');
    assert.equal(log.notes, 'Observer was ill');
    assert.equal(log.observation_id, attempt.id);
  });

  test('the released date cannot be confirmed again', async () => {
    const res = await ctx.api('POST', `/time-options/${first.id}/confirm`, { as: USERS.profA });
    assert.ok([403, 409].includes(res.status), JSON.stringify(res.body));
    const [option] = await ctx.sql('SELECT is_confirmed FROM assessment_time_options WHERE id = $1', [first.id]);
    assert.equal(option.is_confirmed, false);
    assert.equal(await statusOf(a), 'postponed');
  });

  test('the postponed attempt no longer holds the observer’s capacity', async () => {
    const rows = await ctx.sql(
      `SELECT * FROM (${observerCommitmentsSql}) c WHERE c.assessment_id = $1`,
      [a],
    );
    assert.equal(rows.length, 0);
  });

  test('rescheduling with the same observer creates attempt 2', async () => {
    second = await acceptedOption(a, 5, 1);
    const res = await finalize(a, second.id, 1);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await statusOf(a), 'approved');

    const attempts = await observationsFor(a);
    assert.deepEqual(
      attempts.map((o) => [o.attempt_no, o.observer_id, o.status]),
      [[1, 1, 'postponed'], [2, 1, 'approved']],
    );
  });

  test('someone outside the observation cannot postpone it', async () => {
    const [, attempt2] = await observationsFor(a);
    const res = await ctx.api('POST', `/observations/${attempt2.id}/postpone`, {
      as: USERS.profD,
      body: { reason: 'Not mine' },
    });
    assert.equal(res.status, 403);
  });

  test('the observer postpones the scheduled observation', async () => {
    const [, attempt2] = await observationsFor(a);
    const res = await ctx.api('POST', `/observations/${attempt2.id}/postpone`, {
      as: USERS.profA,
      body: { reason: 'Class was cancelled that day' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'postponed');
    assert.equal(await statusOf(a), 'postponed');

    const again = await ctx.api('POST', `/observations/${attempt2.id}/postpone`, {
      as: USERS.profA,
      body: { reason: 'Twice' },
    });
    assert.equal(again.status, 409);

    const logs = await ctx.sql(
      'SELECT notes, observation_id FROM cancellation_attempts WHERE assessment_id = $1 ORDER BY id',
      [a],
    );
    assert.equal(logs.length, 2);
    assert.deepEqual(logs[1], { notes: 'Class was cancelled that day', observation_id: attempt2.id });
  });

  test('rescheduling with a different observer creates attempt 3', async () => {
    const third = await acceptedOption(a, 3, 4);
    const res = await finalize(a, third.id, 4);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const attempts = await observationsFor(a);
    assert.deepEqual(
      attempts.map((o) => [o.attempt_no, o.observer_id, o.status]),
      [[1, 1, 'postponed'], [2, 1, 'postponed'], [3, 4, 'approved']],
    );
    const confirmed = await ctx.sql(
      'SELECT id FROM assessment_time_options WHERE assessment_id = $1 AND is_confirmed',
      [a],
    );
    assert.deepEqual(confirmed.map((r) => r.id), [third.id]);
  });
});

test('postponing needs a reason', async () => {
  const a = await ctx.sql('SELECT id FROM assessments ORDER BY id LIMIT 1');
  const res = await ctx.api('POST', `/assessments/${a[0].id}/postpone`, { as: USERS.ac, body: { reason: ' ' } });
  assert.equal(res.status, 400);
});

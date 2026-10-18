// Sign-off and questionnaire responses (#18, #23, #76 / PR #84).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
let obs; // observation ids by scenario

// Observee: Professor C (teacher 3, faculty@). Observer: teacher 1 (professor.a@).
async function makeObservation(status, scheduledDaysFromToday) {
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
  const scheduled = scheduledDaysFromToday === null ? null : `CURRENT_DATE + ${Number(scheduledDaysFromToday)}`;
  const [observation] = await ctx.sql(
    `INSERT INTO observations (assessment_id, observee_id, observer_id, attempt_no, status, scheduled_date)
     VALUES ($1, 3, 1, 1, $2, ${scheduled ?? 'NULL'}) RETURNING id`,
    [assessment.id, status],
  );
  return observation.id;
}

const signOff = (id, as) => ctx.api('POST', `/observations/${id}/sign-off`, { as });

before(async () => {
  ctx = await startIntegration();
  obs = {
    postponed: await makeObservation('postponed', -1),
    unscheduled: await makeObservation('approved', null),
    future: await makeObservation('approved', 7),
    ready: await makeObservation('approved', -1),
  };
});
after(async () => { await ctx?.close(); });

describe('sign-off is refused until the observation can actually be signed', () => {
  // Each check asserts the message too: these rows would also fail the
  // unanswered-criteria rule, so a bare 409 can't tell which rule fired.
  test('postponed observation: 409', async () => {
    const res = await signOff(obs.postponed, USERS.profA);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /active and approved/);
  });

  test('no scheduled date: 409', async () => {
    const res = await signOff(obs.unscheduled, USERS.profA);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /scheduled date/);
  });

  test('scheduled date still in the future: 409', async () => {
    const res = await signOff(obs.future, USERS.profA);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /not been reached/);
  });

  test('someone who is not the observer or observee: 403', async () => {
    assert.equal((await signOff(obs.ready, USERS.profD)).status, 403);
  });

  test('observer with unanswered criteria: 409, listing what is missing', async () => {
    const res = await signOff(obs.ready, USERS.profA);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /criteria must be answered/);
    assert.equal(res.body.error.details.missing.length, 3);
  });
});

describe('questionnaire responses', () => {
  test('only the observer can submit', async () => {
    const body = { responses: [{ criterionId: 1, score: 4 }] };
    assert.equal((await ctx.api('POST', `/observations/${obs.ready}/responses`, { as: USERS.faculty, body })).status, 403);
  });

  test('a score above the criterion max is rejected by the database trigger as a 400', async () => {
    const body = { responses: [{ criterionId: 1, score: 6 }] };
    assert.equal((await ctx.api('POST', `/observations/${obs.ready}/responses`, { as: USERS.profA, body })).status, 400);
  });

  test('the observer answers every criterion', async () => {
    const body = { responses: [{ criterionId: 1, score: 4 }, { criterionId: 2, score: 5 }, { criterionId: 3, score: 3 }] };
    const res = await ctx.api('POST', `/observations/${obs.ready}/responses`, { as: USERS.profA, body });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.length, 3);
  });

  test('results stay hidden from the participants until both sign off', async () => {
    assert.equal((await ctx.api('GET', `/observations/${obs.ready}/responses`, { as: USERS.faculty })).status, 409);
    assert.equal((await ctx.api('GET', `/observations/${obs.ready}/responses`, { as: USERS.ac })).status, 200);
  });
});

describe('both sign-offs complete the record', () => {
  test('observer signs: still approved', async () => {
    const res = await signOff(obs.ready, USERS.profA);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'approved');
    assert.ok(res.body.observerSignedOffAt);
    assert.equal(res.body.observeeSignedOffAt, null);
  });

  test('observer signing twice: 409', async () => {
    const res = await signOff(obs.ready, USERS.profA);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /already signed off/);
  });

  test('observee signs: observation and assessment are completed', async () => {
    const res = await signOff(obs.ready, USERS.faculty);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'completed');
    const [assessment] = await ctx.sql(
      'SELECT a.status, a.completed_at FROM assessments a JOIN observations o ON o.assessment_id = a.id WHERE o.id = $1',
      [obs.ready],
    );
    assert.equal(assessment.status, 'completed');
    assert.ok(assessment.completed_at);
  });

  test('retrying after completion returns the record unchanged', async () => {
    const res = await signOff(obs.ready, USERS.faculty);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'completed');
  });

  test('once both have signed, the observee can see the results', async () => {
    const res = await ctx.api('GET', `/observations/${obs.ready}/responses`, { as: USERS.faculty });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
  });

  test('answers can no longer be changed after the observer signed', async () => {
    const body = { responses: [{ criterionId: 1, score: 1 }] };
    assert.equal((await ctx.api('POST', `/observations/${obs.ready}/responses`, { as: USERS.profA, body })).status, 409);
  });
});

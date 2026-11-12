// Locking in a date writes it to the observation, so sign-off can happen (#57).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;

// Observee: Professor C (teacher 3, faculty@). Observers: teacher 1 (profA@), teacher 4 (profD@).
// Dates are in the past so sign-off is allowed right away; 06:00 avoids every seeded class.
// Each suite uses its own days: a confirmed observation makes its observer busy at that slot.
// Each call adds a fresh section of one of Professor C's courses (one sign-up per section).
let sectionCount = 0;
async function makeAssessment() {
  sectionCount += 1;
  const [section] = await ctx.sql(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id)
     SELECT course_id, term_id, $1, 3 FROM course_sections WHERE teacher_id = 3 ORDER BY id LIMIT 1
     RETURNING id, term_id`,
    [`S${sectionCount}`],
  );
  const [assessment] = await ctx.sql(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id) VALUES (3, $1, $2) RETURNING id`,
    [section.id, section.term_id],
  );
  return assessment.id;
}

async function addOption(assessmentId, daysAgo) {
  const [option] = await ctx.sql(
    `INSERT INTO assessment_time_options (assessment_id, proposed_date, start_time, end_time)
     VALUES ($1, CURRENT_DATE - $2::int, '06:00', '06:30') RETURNING id, proposed_date`,
    [assessmentId, daysAgo],
  );
  return option;
}

async function offer(optionId, teacherId, status) {
  await ctx.sql(
    `INSERT INTO time_option_offers (option_id, teacher_id, status) VALUES ($1, $2, $3)`,
    [optionId, teacherId, status],
  );
}

const offerStatus = async (optionId, teacherId) =>
  (await ctx.sql('SELECT status FROM time_option_offers WHERE option_id = $1 AND teacher_id = $2', [optionId, teacherId]))[0]?.status;

const observationsFor = (assessmentId) =>
  ctx.sql('SELECT * FROM observations WHERE assessment_id = $1 ORDER BY attempt_no', [assessmentId]);

const finalize = (assessmentId, optionId, teacherId) =>
  ctx.api('POST', `/assessments/${assessmentId}/time-options/${optionId}/finalize`, { as: USERS.faculty, body: { teacherId } });

const confirm = (optionId, as) => ctx.api('POST', `/time-options/${optionId}/confirm`, { as });

before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

describe('observee finalizes an accepted offer (several observers)', () => {
  let a; let o1; let o2;
  before(async () => {
    a = await makeAssessment();
    o1 = await addOption(a, 2);
    o2 = await addOption(a, 1);
    await offer(o1.id, 1, 'accepted');
    await offer(o1.id, 4, 'accepted');
    await offer(o2.id, 4, 'pending');
  });

  test('an offer the observer has not accepted cannot be finalized', async () => {
    const res = await finalize(a, o2.id, 4);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /has not accepted/);
  });

  test('finalizing creates the observation with the observer and the date', async () => {
    const res = await finalize(a, o1.id, 1);
    assert.equal(res.status, 200);
    assert.equal(res.body.confirmedTeacherId, 1);

    const rows = await observationsFor(a);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].observer_id, 1);
    assert.equal(rows[0].status, 'approved');
    assert.equal(rows[0].scheduled_date, o1.proposed_date);
    const [assessment] = await ctx.sql('SELECT status FROM assessments WHERE id = $1', [a]);
    assert.equal(assessment.status, 'approved');
  });

  test('every competing offer is declined, including another observer on the same date (#78)', async () => {
    assert.equal(await offerStatus(o1.id, 1), 'accepted');
    assert.equal(await offerStatus(o1.id, 4), 'declined');
    assert.equal(await offerStatus(o2.id, 4), 'declined');
  });

  test('a second finalize is refused', async () => {
    const res = await finalize(a, o2.id, 4);
    assert.equal(res.status, 409);
  });

  test('the full path now reaches a completed observation', async () => {
    const [observation] = await observationsFor(a);
    const criteria = (await ctx.api('GET', '/criteria', { as: USERS.profA })).body.data;
    const responses = criteria.map((c) => ({ criterionId: c.id, score: 4 }));
    assert.equal((await ctx.api('POST', `/observations/${observation.id}/responses`, { as: USERS.profA, body: { responses } })).status, 201);
    assert.equal((await ctx.api('POST', `/observations/${observation.id}/sign-off`, { as: USERS.profA })).status, 200);
    const res = await ctx.api('POST', `/observations/${observation.id}/sign-off`, { as: USERS.faculty });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'completed');
  });
});

describe('observer confirms one of the proposed dates (one observer)', () => {
  let a; let p1; let p2;
  before(async () => {
    a = await makeAssessment();
    p1 = await addOption(a, 4);
    p2 = await addOption(a, 3);
    await offer(p1.id, 1, 'pending');
    await offer(p2.id, 1, 'pending');
  });

  test('someone the date was not offered to: 403', async () => {
    assert.equal((await confirm(p1.id, USERS.profD)).status, 403);
  });

  test('confirming creates the observation with the date', async () => {
    const res = await confirm(p1.id, USERS.profA);
    assert.equal(res.status, 200);
    assert.equal(res.body.isConfirmed, true);
    assert.equal(res.body.confirmedTeacherId, 1);

    const rows = await observationsFor(a);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].observer_id, 1);
    assert.equal(rows[0].scheduled_date, p1.proposed_date);
  });

  test('the other proposed dates are released and cannot be confirmed', async () => {
    assert.equal(await offerStatus(p2.id, 1), 'declined');
    assert.equal((await confirm(p2.id, USERS.profA)).status, 403);
  });

  test('sign-off gets past the date checks (only the questionnaire is left)', async () => {
    const [observation] = await observationsFor(a);
    const res = await ctx.api('POST', `/observations/${observation.id}/sign-off`, { as: USERS.profA });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /criteria must be answered/);
  });
});

describe('an observer was already chosen for the sign-up', () => {
  let a; let q1; let existing;
  before(async () => {
    a = await makeAssessment();
    // What POST /assessments/:id/observations leaves behind: an observation with no date yet.
    [existing] = await ctx.sql(
      `INSERT INTO observations (assessment_id, observee_id, observer_id, attempt_no, status)
       VALUES ($1, 3, 1, 1, 'approved') RETURNING id`,
      [a],
    );
    q1 = await addOption(a, 6);
    await offer(q1.id, 1, 'accepted');
    await offer(q1.id, 4, 'accepted');
  });

  test('finalizing with a different observer is refused and changes nothing', async () => {
    const res = await finalize(a, q1.id, 4);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /different observer/);
    const [option] = await ctx.sql('SELECT is_confirmed FROM assessment_time_options WHERE id = $1', [q1.id]);
    assert.equal(option.is_confirmed, false);
    assert.equal(await offerStatus(q1.id, 4), 'accepted');
  });

  test('finalizing with the chosen observer dates the existing observation', async () => {
    assert.equal((await finalize(a, q1.id, 1)).status, 200);
    const rows = await observationsFor(a);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, existing.id);
    assert.equal(rows[0].scheduled_date, q1.proposed_date);
  });
});

describe('a closed sign-up cannot be scheduled', () => {
  // Stale state: the sign-up closed while an accepted offer was still out.
  async function closedSignUp(status, daysAgo) {
    const a = await makeAssessment();
    const option = await addOption(a, daysAgo);
    await offer(option.id, 1, 'accepted');
    await offer(option.id, 4, 'accepted');
    await ctx.sql('UPDATE assessments SET status = $2 WHERE id = $1', [a, status]);
    return { a, option };
  }

  async function assertUnchanged({ a, option }, status) {
    const [row] = await ctx.sql('SELECT status FROM assessments WHERE id = $1', [a]);
    assert.equal(row.status, status);
    const [opt] = await ctx.sql(
      'SELECT is_confirmed, confirmed_teacher_id FROM assessment_time_options WHERE id = $1',
      [option.id],
    );
    assert.equal(opt.is_confirmed, false);
    assert.equal(opt.confirmed_teacher_id, null);
    assert.equal(await offerStatus(option.id, 1), 'accepted');
    assert.equal(await offerStatus(option.id, 4), 'accepted');
    assert.equal((await observationsFor(a)).length, 0);
  }

  for (const [i, status] of ['completed', 'cancelled', 'not_eligible'].entries()) {
    test(`finalize refuses a ${status} sign-up and changes nothing`, async () => {
      const signUp = await closedSignUp(status, 20 + i);
      const res = await finalize(signUp.a, signUp.option.id, 1);
      assert.equal(res.status, 409);
      assert.match(res.body.error.message, /no longer open/);
      await assertUnchanged(signUp, status);
    });

    test(`confirm refuses a ${status} sign-up and changes nothing`, async () => {
      const signUp = await closedSignUp(status, 30 + i);
      const res = await confirm(signUp.option.id, USERS.profA);
      assert.equal(res.status, 409);
      assert.match(res.body.error.message, /no longer open/);
      await assertUnchanged(signUp, status);
    });
  }

    test('a postponed sign-up can still be rescheduled', async () => {
      const { a, option } = await closedSignUp('postponed', 40);
      const res = await finalize(a, option.id, 4);
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const [row] = await ctx.sql('SELECT status FROM assessments WHERE id = $1', [a]);
      assert.equal(row.status, 'approved');

      const [observation] = await observationsFor(a);
      assert.equal(observation.observer_id, 4);
      assert.equal(observation.scheduled_date, option.proposed_date);
    });

    test('an observer with three commitments cannot confirm a fourth in the same term', async () => {
      // The earlier suites leave observer 1 with three commitments in this term.
      const assessmentId = await makeAssessment();
      const option = await addOption(assessmentId, 41);
      await offer(option.id, 1, 'pending');

      const res = await confirm(option.id, USERS.profA);
      assert.equal(res.status, 409, JSON.stringify(res.body));
      assert.equal(res.body.error.code, 'observer_capacity_reached');

      const [saved] = await ctx.sql(
        'SELECT is_confirmed FROM assessment_time_options WHERE id = $1',
        [option.id],
      );
      assert.equal(saved.is_confirmed, false);
      assert.equal(await offerStatus(option.id, 1), 'pending');
      assert.equal((await observationsFor(assessmentId)).length, 0);
    });
});

describe('closing observer requests (#124)', () => {
  const closeRequest = (id, action, as, body = {}) =>
    ctx.api('POST', `/assessments/${id}/time-options/${action}`, { as, body });

  test('withdraw closes all open offers, records the reason, and blocks stale acceptance', async () => {
    const id = await makeAssessment();
    const option = await addOption(id, 50);
    await offer(option.id, 1, 'accepted');
    await offer(option.id, 4, 'pending');

    assert.equal((await closeRequest(id, 'withdraw', USERS.profA)).status, 403);

    const res = await closeRequest(id, 'withdraw', USERS.faculty, {
      reason: 'Need different dates',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.offersClosed, 2);

    const rows = await ctx.sql(
      `SELECT f.id, f.teacher_id, f.status, h.action, h.reason
         FROM time_option_offers f
         JOIN time_option_offer_actions h ON h.offer_id = f.id
        WHERE f.option_id = $1
        ORDER BY f.teacher_id`,
      [option.id],
    );
    assert.deepEqual(
      rows.map(({ teacher_id, status, action, reason }) => [teacher_id, status, action, reason]),
      [
        [1, 'declined', 'withdrawn', 'Need different dates'],
        [4, 'declined', 'withdrawn', 'Need different dates'],
      ],
    );

    const stale = await ctx.api('POST', `/time-options/offers/${rows[0].id}/respond`, {
      as: USERS.profA,
      body: { status: 'accepted' },
    });
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    assert.equal(await offerStatus(option.id, 1), 'declined');
  });

  test('decline closes only the calling observer’s offers and records the reason', async () => {
    const id = await makeAssessment();
    const first = await addOption(id, 51);
    const second = await addOption(id, 52);
    await offer(first.id, 1, 'accepted');
    await offer(second.id, 1, 'pending');
    await offer(first.id, 4, 'pending');

    assert.equal((await closeRequest(id, 'decline', USERS.faculty)).status, 403);

    const res = await closeRequest(id, 'decline', USERS.profA, {
      reason: 'Unavailable',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.offersClosed, 2);
    assert.equal(await offerStatus(first.id, 1), 'declined');
    assert.equal(await offerStatus(second.id, 1), 'declined');
    assert.equal(await offerStatus(first.id, 4), 'pending');

    const history = await ctx.sql(
      `SELECT h.action, h.reason
         FROM time_option_offer_actions h
         JOIN time_option_offers f ON f.id = h.offer_id
        WHERE f.teacher_id = 1 AND f.option_id IN ($1, $2)`,
      [first.id, second.id],
    );
    assert.deepEqual(history, [
      { action: 'declined', reason: 'Unavailable' },
      { action: 'declined', reason: 'Unavailable' },
    ]);
  });

  test('neither action can close a finalized request', async () => {
    const id = await makeAssessment();
    const option = await addOption(id, 53);
    await offer(option.id, 4, 'accepted');

    const scheduled = await finalize(id, option.id, 4);
    assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body));

    assert.equal((await closeRequest(id, 'withdraw', USERS.faculty)).status, 409);
    assert.equal((await closeRequest(id, 'decline', USERS.profD)).status, 409);
    assert.equal(await offerStatus(option.id, 4), 'accepted');
    assert.equal((await observationsFor(id)).length, 1);
  });
  for (const action of ['withdraw', 'decline']) {
    test(`${action} frees a slot for another assessment`, async () => {
      // The earlier tests leave observer 4 with two confirmed assignments.
      const reservedId = await makeAssessment();
      const reserved = await addOption(reservedId, 54);
      await offer(reserved.id, 4, 'accepted');

      const nextId = await makeAssessment();
      const next = await addOption(nextId, 55);
      await offer(next.id, 4, 'pending');
      const [pending] = await ctx.sql(
        'SELECT id FROM time_option_offers WHERE option_id = $1 AND teacher_id = $2',
        [next.id, 4],
      );

      const respond = (status) =>
        ctx.api('POST', `/time-options/offers/${pending.id}/respond`, {
          as: USERS.profD,
          body: { status },
        });

      const blocked = await respond('accepted');
      assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
      assert.equal(blocked.body.error.code, 'observer_capacity_reached');
      assert.equal(await offerStatus(next.id, 4), 'pending');

      const actor = action === 'withdraw' ? USERS.faculty : USERS.profD;
      const closed = await closeRequest(reservedId, action, actor);
      assert.equal(closed.status, 200, JSON.stringify(closed.body));

      const accepted = await respond('accepted');
      assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
      assert.equal(await offerStatus(next.id, 4), 'accepted');

      // Release this reservation so the next case starts at the same capacity.
      assert.equal((await respond('declined')).status, 200);
    });
  }
});
// The written parts of the record (#95): the observer's notes, saved with the
// questionnaire responses, and the observee's comment, saved when they sign off.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
let obsId;

// Observee: faculty@ (teacher 3). Observer: professor.a@ (teacher 1).
// Scheduled yesterday, so both can sign off once every criterion is answered.
async function makeObservation() {
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
  const [observation] = await ctx.sql(
    `INSERT INTO observations (assessment_id, observee_id, observer_id, attempt_no, status, scheduled_date)
     VALUES ($1, 3, 1, 1, 'approved', CURRENT_DATE - 1) RETURNING id`,
    [assessment.id],
  );
  return observation.id;
}

const scores = [{ criterionId: 1, score: 4 }, { criterionId: 2, score: 5 }, { criterionId: 3, score: 3 }];
const save = (body, as = USERS.profA) => ctx.api('POST', `/observations/${obsId}/responses`, { as, body });
const read = (as) => ctx.api('GET', `/observations/${obsId}/responses`, { as });
const storedNotes = async () => (await ctx.sql('SELECT observer_notes FROM observations WHERE id = $1', [obsId]))[0].observer_notes;

before(async () => {
  ctx = await startIntegration();
  obsId = await makeObservation();
});
after(async () => { await ctx?.close(); });

describe('saving notes with the responses', () => {
  test('a new observation has no notes', async () => {
    const res = await read(USERS.profA);
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, null);
  });

  test('the observer saves notes with the scores; they are trimmed and returned', async () => {
    const res = await save({ responses: scores, notes: '  Clear pacing; try more cold calls.  ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.notes, 'Clear pacing; try more cold calls.');
    assert.equal(await storedNotes(), 'Clear pacing; try more cold calls.');
  });

  test('the observer reads them back', async () => {
    const res = await read(USERS.profA);
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, 'Clear pacing; try more cold calls.');
    assert.equal(res.body.data.length, 3);
  });

  test('saving scores without `notes` keeps the saved notes', async () => {
    const res = await save({ responses: scores });
    assert.equal(res.status, 201);
    assert.equal(res.body.notes, 'Clear pacing; try more cold calls.');
    assert.equal(await storedNotes(), 'Clear pacing; try more cold calls.');
  });

  test('a blank string clears them, then they can be written again', async () => {
    assert.equal((await save({ responses: scores, notes: '   ' })).status, 201);
    assert.equal(await storedNotes(), null);
    assert.equal((await save({ responses: scores, notes: 'Strong examples.' })).status, 201);
    assert.equal(await storedNotes(), 'Strong examples.');
  });

  test('notes over 5000 characters: 400, nothing changes', async () => {
    const res = await save({ responses: scores, notes: 'x'.repeat(5001) });
    assert.equal(res.status, 400);
    assert.equal(await storedNotes(), 'Strong examples.');
  });

  test('only the observer can write notes', async () => {
    assert.equal((await save({ responses: scores, notes: 'Not mine' }, USERS.faculty)).status, 403);
    assert.equal((await save({ responses: scores, notes: 'Not mine' }, USERS.profD)).status, 403);
    assert.equal(await storedNotes(), 'Strong examples.');
  });
});

describe('who can read the notes', () => {
  test('the committee can, before sign-off', async () => {
    const res = await read(USERS.ac);
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, 'Strong examples.');
  });

  test('the observee cannot before the observer signs off (same gate as the scores)', async () => {
    assert.equal((await read(USERS.faculty)).status, 409);
  });

  test('an unrelated professor cannot', async () => {
    assert.equal((await read(USERS.profD)).status, 403);
  });

  test('the observee can once the observer signs off', async () => {
    assert.equal((await ctx.api('POST', `/observations/${obsId}/sign-off`, { as: USERS.profA })).status, 200);
    const res = await read(USERS.faculty);
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, 'Strong examples.');
  });
});

describe('notes are final once the observer signs off', () => {
  test('the API refuses a change: 409, notes unchanged', async () => {
    const res = await save({ responses: scores, notes: 'Changed after signing' });
    assert.equal(res.status, 409);
    assert.equal(await storedNotes(), 'Strong examples.');
  });

  test('the database refuses a direct change too (migration 016 trigger)', async () => {
    await assert.rejects(
      ctx.sql('UPDATE observations SET observer_notes = $2 WHERE id = $1', [obsId, 'Edited in SQL']),
      /observer notes are final/,
    );
    assert.equal(await storedNotes(), 'Strong examples.');
  });

  test('other updates to a signed observation still work (only the notes are locked)', async () => {
    await ctx.sql('UPDATE observations SET updated_at = now() WHERE id = $1', [obsId]);
    assert.equal(await storedNotes(), 'Strong examples.');
  });

});

describe("the observee's comment on sign-off", () => {
  const signOff = (as, body) => ctx.api('POST', `/observations/${obsId}/sign-off`, { as, body });
  const storedComment = async () => (await ctx.sql('SELECT observee_comment FROM observations WHERE id = $1', [obsId]))[0].observee_comment;

  test('a comment over 2000 characters: 400, still unsigned', async () => {
    assert.equal((await signOff(USERS.faculty, { comment: 'x'.repeat(2001) })).status, 400);
    const [row] = await ctx.sql('SELECT observee_signed_off_at FROM observations WHERE id = $1', [obsId]);
    assert.equal(row.observee_signed_off_at, null);
  });

  test('the observee signs with a comment: stored trimmed and returned', async () => {
    const res = await signOff(USERS.faculty, { comment: '  The second half ran long because of a fire drill.  ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'completed');
    assert.equal(res.body.observeeComment, 'The second half ran long because of a fire drill.');
    assert.equal(await storedComment(), 'The second half ran long because of a fire drill.');
  });

  test('the record shows it to the participants and the committee', async () => {
    for (const as of [USERS.faculty, USERS.profA, USERS.ac]) {
      const res = await ctx.api('GET', `/observations/${obsId}`, { as });
      assert.equal(res.status, 200);
      assert.equal(res.body.observeeComment, 'The second half ran long because of a fire drill.');
    }
  });

  test('the database refuses a change after the observee signed (migration 016 trigger)', async () => {
    await assert.rejects(
      ctx.sql('UPDATE observations SET observee_comment = $2 WHERE id = $1', [obsId, 'Edited in SQL']),
      /observee comment is final/,
    );
    assert.equal(await storedComment(), 'The second half ran long because of a fire drill.');
  });

  test('view-only roles read the notes and the comment once the record is completed', async () => {
    const res = await read(USERS.deptHead);
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, 'Strong examples.');
    const record = await ctx.api('GET', `/observations/${obsId}`, { as: USERS.review });
    assert.equal(record.status, 200);
    assert.equal(record.body.observeeComment, 'The second half ran long because of a fire drill.');
  });
});

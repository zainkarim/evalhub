import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

// Runs fn with the term's sign-up deadline set, then puts the shared test
// database back the way it was (deadline, statuses, any lists fn created).
const withTerm = async (deadline, fn) => {
  const [term] = await ctx.sql(
    `SELECT id, signup_deadline, selection_started_at FROM terms
      WHERE id IN (SELECT due_term_id FROM assessments WHERE status = 'signed_up')
      ORDER BY id LIMIT 1`,
  );
  const before = await ctx.sql('SELECT id, status FROM assessments WHERE due_term_id = $1', [term.id]);
  const [{ max }] = await ctx.sql('SELECT coalesce(max(id), 0)::int AS max FROM candidate_lists');
  await ctx.sql(
    'UPDATE terms SET signup_deadline = $2, selection_started_at = NULL WHERE id = $1',
    [term.id, deadline],
  );
  try {
    await fn(term.id);
  } finally {
    await ctx.sql('DELETE FROM candidate_lists WHERE id > $1', [max]);
    for (const row of before) {
      await ctx.sql('UPDATE assessments SET status = $2 WHERE id = $1', [row.id, row.status]);
    }
    await ctx.sql(
      'UPDATE terms SET signup_deadline = $2, selection_started_at = $3 WHERE id = $1',
      [term.id, term.signup_deadline, term.selection_started_at],
    );
  }
};

test('only the committee can start observer selection, and the term must exist', async () => {
  const faculty = await ctx.api('POST', '/terms/1/start-observer-selection', { as: USERS.faculty });
  assert.equal(faculty.status, 403);

  const missing = await ctx.api('POST', '/terms/999999/start-observer-selection', { as: USERS.ac });
  assert.equal(missing.status, 404);
});

test('selection stays closed until the day after the sign-up deadline', async () => {
  await withTerm('2999-01-01', async (termId) => {
    const res = await ctx.api('POST', `/terms/${termId}/start-observer-selection`, { as: USERS.ac });
    assert.equal(res.status, 409);
  });
});

test('Start builds a list for every waiting sign-up, saves empty pools, and is idempotent', async () => {
  await withTerm('2000-01-01', async (termId) => {
    const waiting = await ctx.sql(
      `SELECT id FROM assessments WHERE due_term_id = $1 AND status = 'signed_up'`,
      [termId],
    );
    assert.ok(waiting.length > 0, 'seed data has a waiting sign-up in the term');

    const first = await ctx.api('POST', `/terms/${termId}/start-observer-selection`, { as: USERS.ac });
    assert.equal(first.status, 200);
    assert.equal(first.body.alreadyStarted, false);
    assert.equal(first.body.started, waiting.length);
    assert.equal(first.body.started, first.body.noEligible + first.body.limited + first.body.full);

    for (const { id } of waiting) {
      const [list] = await ctx.sql('SELECT * FROM candidate_lists WHERE assessment_id = $1 ORDER BY id DESC', [id]);
      assert.ok(list, `sign-up ${id} has a list, even if the pool is empty`);
      assert.ok(list.list_size <= list.pool_size);
      const [a] = await ctx.sql('SELECT status FROM assessments WHERE id = $1', [id]);
      assert.equal(a.status, list.list_size > 0 ? 'candidates_generated' : 'signed_up');
    }

    assert.ok(first.body.startedAt, 'the term records when selection started');
    const terms = await ctx.api('GET', '/terms', { as: USERS.ac });
    assert.ok(terms.body.data.find((t) => t.id === termId).selectionStartedAt);

    const second = await ctx.api('POST', `/terms/${termId}/start-observer-selection`, { as: USERS.ac });
    assert.equal(second.status, 200);
    assert.equal(second.body.alreadyStarted, true);
    assert.equal(second.body.started, 0, 'nothing is re-rolled');
    assert.equal(second.body.stillEmpty, first.body.noEligible);
  });
});

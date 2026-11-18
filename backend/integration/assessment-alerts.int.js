import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

// A waiting sign-up (no observer yet) to hang a candidate list on.
const waitingSignUp = async () => {
  const [a] = await ctx.sql(
    `SELECT id, due_term_id FROM assessments
      WHERE status IN ('signed_up', 'candidates_generated') ORDER BY id LIMIT 1`,
  );
  assert.ok(a, 'seed data has a waiting sign-up');
  return a;
};

const withList = async (assessmentId, poolSize, fn) => {
  const [list] = await ctx.sql(
    `INSERT INTO candidate_lists (assessment_id, target_level, target_school, pool_size, list_size)
     VALUES ($1, 3, 'ECS', $2, $2) RETURNING id`,
    [assessmentId, poolSize],
  );
  try { await fn(); } finally {
    await ctx.sql('DELETE FROM candidate_lists WHERE id = $1', [list.id]);
  }
};

test('GET /assessments/alerts is not read as an assessment id (the Cycle page 400)', async () => {
  const res = await ctx.api('GET', '/assessments/alerts', { as: USERS.ac });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.deepEqual(
    Object.keys(res.body.counts).sort(),
    ['awaitingSignOff', 'limited', 'postponed', 'urgent'],
  );
});

test('an empty candidate list is urgent, with the nested view the Cycle page reads', async () => {
  const a = await waitingSignUp();
  await withList(a.id, 0, async () => {
    const res = await ctx.api('GET', `/assessments/alerts?termId=${a.due_term_id}`, { as: USERS.ac });
    assert.equal(res.status, 200);
    const item = res.body.data.find((v) => v.id === a.id);
    assert.ok(item, 'the sign-up is listed');
    assert.equal(item.alert, 'no_eligible_observers');
    assert.deepEqual(item.candidateSummary, { poolSize: 0, listSize: 0 });
    assert.ok(item.teacher.firstName && item.section.course.title && item.section.term.year);
    assert.ok(res.body.counts.urgent >= 1);
    assert.equal(res.body.data[0].alert, 'no_eligible_observers', 'urgent sorts first');
  });
});

test('a pool smaller than a full list is a limited-pool notice', async () => {
  const a = await waitingSignUp();
  await withList(a.id, 2, async () => {
    const res = await ctx.api('GET', '/assessments/alerts', { as: USERS.ac });
    const item = res.body.data.find((v) => v.id === a.id);
    assert.equal(item?.alert, 'limited_pool');
    assert.ok(res.body.counts.limited >= 1);
  });
});

test('a full pool is not an alert, and the alerts are committee-only', async () => {
  const a = await waitingSignUp();
  await withList(a.id, 5, async () => {
    const res = await ctx.api('GET', '/assessments/alerts', { as: USERS.ac });
    assert.ok(!res.body.data.some((v) => v.id === a.id));
  });

  const faculty = await ctx.api('GET', '/assessments/alerts', { as: USERS.faculty });
  assert.equal(faculty.status, 403);
});

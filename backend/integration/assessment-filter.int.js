import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

test('AC and admin can filter assessments by teacher without a server error', async () => {
  for (const as of [USERS.ac, USERS.admin]) {
    const res = await ctx.api('GET', '/assessments?teacherId=3', { as });

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.data.every((a) => a.teacherId === 3));
    assert.ok(res.body.data.every((a) => a.sectionCode));

    console.log(`${as}: HTTP ${res.status}, total=${res.body.total}, teacherIds=${res.body.data.map((a) => a.teacherId)}`);
  }
});

test('teacher, term and status filters work together', async () => {
  const res = await ctx.api(
    'GET',
    '/assessments?teacherId=3&termId=10&status=signed_up',
    { as: USERS.ac },
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].teacherId, 3);
  assert.equal(res.body.data[0].dueTermId, 10);
  assert.equal(res.body.data[0].status, 'signed_up');

  console.log(`Combined filters: HTTP ${res.status}, total=${res.body.total}`);
});

test('a teacher without assessments returns an empty list', async () => {
  const res = await ctx.api('GET', '/assessments?teacherId=1', {
    as: USERS.ac,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.data, []);

  console.log(`No matching assessments: HTTP ${res.status}, total=${res.body.total}`);
});

test('faculty still cannot access the committee assessment list', async () => {
  const res = await ctx.api('GET', '/assessments?teacherId=3', {
    as: USERS.faculty,
  });

  assert.equal(res.status, 403);
  console.log(`Faculty access: HTTP ${res.status}`);
});

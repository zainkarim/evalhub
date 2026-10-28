import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startIntegration, USERS } from './harness.js';

let ctx;
before(async () => { ctx = await startIntegration(); });
after(async () => { await ctx?.close(); });

describe('login', () => {
  test('seeded faculty can log in and gets a token plus their teacher link', async () => {
    const res = await ctx.login(USERS.faculty);
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.deepEqual(
      { email: res.body.user.email, role: res.body.user.role, teacherId: res.body.user.teacherId },
      { email: USERS.faculty, role: 'faculty', teacherId: 3 },
    );
  });

  test('wrong password and unknown email get the same 401', async () => {
    const wrong = await ctx.login(USERS.faculty, 'not-the-password');
    const unknown = await ctx.login('nobody@example.edu', 'whatever');
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.code, unknown.body.error.code);
  });

  test('the token from login works on /auth/me', async () => {
    const { body } = await ctx.login(USERS.ac);
    const me = await ctx.api('GET', '/auth/me', { token: body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'ac_member');
  });
});

describe('access control', () => {
  test('protected routes reject a missing or bad token', async () => {
    assert.equal((await ctx.api('GET', '/teachers/3')).status, 401);
    assert.equal((await ctx.api('GET', '/teachers/3', { token: 'not.a.jwt' })).status, 401);
  });

  test('the professor list is AC/admin only', async () => {
    assert.equal((await ctx.api('GET', '/teachers', { as: USERS.faculty })).status, 403);
    assert.equal((await ctx.api('GET', '/teachers', { as: USERS.ac })).status, 200);
    assert.equal((await ctx.api('GET', '/teachers', { as: USERS.admin })).status, 200);
  });

  test('faculty can read their own teacher record but not someone else\'s', async () => {
    assert.equal((await ctx.api('GET', '/teachers/3', { as: USERS.faculty })).status, 200);
    assert.equal((await ctx.api('GET', '/teachers/1', { as: USERS.faculty })).status, 403);
  });

  test('only admin can register new accounts', async () => {
    const body = { email: 'new.user@example.edu', password: 'Long-Enough-Pass-1', role: 'faculty', teacherId: 5 };
    assert.equal((await ctx.api('POST', '/auth/register', { as: USERS.ac, body })).status, 403);
  });
});

describe('teacher rank self-service (#50)', () => {
  const teacher = async (id) => {
    const [row] = await ctx.sql(
      'SELECT * FROM teachers WHERE id = $1',
      [id],
    );
    return row;
  };

  // Failed requests must leave every teacher unchanged, including timestamps.
  const roster = () => ctx.sql('SELECT * FROM teachers ORDER BY id');

  test('PATCH requires a valid token', async () => {
    const before = await roster();
    const body = { rank: 'full_professor' };

    for (const options of [{ body }, { body, token: 'not.a.jwt' }]) {
      const res = await ctx.api('PATCH', '/teachers/3', options);
      assert.equal(res.status, 401);
      assert.deepEqual(await roster(), before);
    }
  });

  test('faculty can update their own rank and retrieve the saved value', async () => {
    const before = await teacher(3);
    const rank = before.rank === 'full_professor'
      ? 'associate_professor'
      : 'full_professor';

    const res = await ctx.api('PATCH', '/teachers/3', {
      as: USERS.faculty,
      body: { rank },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, 3);
    assert.equal(res.body.rank, rank);

    const after = await teacher(3);
    assert.equal(after.rank, rank);

    // Only rank and the automatic updated_at timestamp may change.
    const {
      rank: oldRank, updated_at: oldTime, ...beforeOtherFields
    } = before;
    const {
      rank: newRank, updated_at: newTime, ...afterOtherFields
    } = after;
    assert.deepEqual(afterOtherFields, beforeOtherFields);

    const get = await ctx.api('GET', '/teachers/3', {
      as: USERS.faculty,
    });
    assert.equal(get.status, 200);
    assert.equal(get.body.rank, rank);
  });

  test('faculty cannot update another teacher', async () => {
    const before = await roster();
    const res = await ctx.api('PATCH', '/teachers/1', {
      as: USERS.faculty,
      body: { rank: 'full_professor' },
    });

    assert.equal(res.status, 403);
    assert.deepEqual(await roster(), before);
  });

  test('faculty extra fields are rejected without partial updates', async () => {
    const before = await roster();
    const own = await teacher(3);
    const rank = own.rank === 'full_professor'
      ? 'associate_professor'
      : 'full_professor';

    const forbiddenFields = {
      firstName: 'Changed',
      lastName: 'Changed',
      email: 'changed@example.edu',
      school: 'OTHER',
      department: 'OTHER',
      isActive: !own.is_active,
      teacherId: 1,
      role: 'admin',
      unexpected: true,
    };

    for (const [field, value] of Object.entries(forbiddenFields)) {
      const res = await ctx.api('PATCH', '/teachers/3', {
        as: USERS.faculty,
        body: { rank, [field]: value },
      });
      assert.equal(res.status, 400, `Must reject field: ${field}`);
      assert.deepEqual(await roster(), before);
    }
  });

  test('faculty empty or invalid updates are rejected', async () => {
    const before = await roster();
    const bodies = [
      {},
      { rank: 'dean' },
      { rank: null },
      { rank: 123 },
      { isActive: false },
    ];

    for (const body of bodies) {
      const res = await ctx.api('PATCH', '/teachers/3', {
        as: USERS.faculty,
        body,
      });
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(await roster(), before);
    }
  });

  test('AC and admin retain permission to update other teacher fields', async () => {
    for (const as of [USERS.ac, USERS.admin]) {
      const before = await teacher(3);
      const body = {
        firstName: before.first_name === 'Updated' ? 'Revised' : 'Updated',
        isActive: !before.is_active,
      };

      const res = await ctx.api('PATCH', '/teachers/3', { as, body });
      assert.equal(res.status, 200);
      assert.equal(res.body.firstName, body.firstName);
      assert.equal(res.body.isActive, body.isActive);

      const after = await teacher(3);
      assert.equal(after.first_name, body.firstName);
      assert.equal(after.is_active, body.isActive);
      assert.equal(after.rank, before.rank);
    }
  });
});

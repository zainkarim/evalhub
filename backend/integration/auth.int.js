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

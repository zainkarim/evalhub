// Shared setup for the integration tests (#24): a real Postgres, the real
// migrations and seed, and the real Express app on a random port.
//
// Uses a separate database (default: <dev database name>_test on the same
// server) and wipes it on every run, so it never touches your dev data.
// Override with TEST_DATABASE_URL. The name must end in "_test".
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL or TEST_DATABASE_URL (backend/.env)');
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/^\//, '')}_test`;
  return url.toString();
}

async function resetDatabase(testUrl) {
  const dbName = new URL(testUrl).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to reset "${dbName}": the test database name must end in _test`);
  }

  // Create the test database if it doesn't exist yet (connect to the server's default DB).
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  const db = new pg.Client({ connectionString: testUrl });
  await db.connect();
  try {
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await db.end();
  }

  // The same migrate + seed scripts developers run, pointed at the test DB.
  const env = { ...process.env, DATABASE_URL: testUrl };
  for (const script of ['src/db/migrate.js', 'src/db/seed.js']) {
    execFileSync(process.execPath, [script], { cwd: backendDir, env, stdio: 'pipe' });
  }
}

/**
 * Resets the test DB, starts the app, and returns helpers:
 *   api(method, path, { as, body })  -> { status, body }   (as = seeded email)
 *   sql(text, params)                -> rows
 *   login(email, password)           -> { status, body }   (real /auth/login)
 */
export async function startIntegration() {
  const testUrl = testDatabaseUrl();
  await resetDatabase(testUrl);

  // config.js reads DATABASE_URL when first imported, so set it before importing the app.
  process.env.DATABASE_URL = testUrl;
  const { createApp } = await import('../src/app.js');
  const { pool } = await import('../src/db/pool.js');
  const { signToken } = await import('../src/middleware/auth.js');

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const sql = async (text, params = []) => (await pool.query(text, params)).rows;

  // Sign tokens directly instead of logging in each time (login is rate-limited
  // to 20 attempts per 15 minutes); the login route itself is tested in auth.int.js.
  const tokens = new Map();
  async function tokenFor(email) {
    if (!tokens.has(email)) {
      const [user] = await sql('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
      if (!user) throw new Error(`No seeded user ${email}`);
      tokens.set(email, signToken(user));
    }
    return tokens.get(email);
  }

  async function request(method, urlPath, { as, body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const bearer = token ?? (as ? await tokenFor(as) : null);
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const res = await fetch(baseUrl + urlPath, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  const login = (email, password = process.env.SEED_PASSWORD ?? 'ChangeMe-Dev-123!') =>
    request('POST', '/auth/login', { body: { email, password } });

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { api: request, sql, login, close };
}

// Seeded demo users (db/seeds + src/db/seed.js).
export const USERS = {
  admin: 'admin@example.edu',      // admin, no teacher profile
  ac: 'ac@example.edu',            // ac_member, Professor B (teacher 2)
  faculty: 'faculty@example.edu',  // faculty, Professor C (teacher 3)
  profA: 'professor.a@example.edu', // faculty, teacher 1
  profD: 'professor.d@example.edu', // faculty, teacher 4
};

// Loads synthetic development data + three demo accounts. Refuses to run in production.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool } from './pool.js';

if (config.env === 'production') {
  console.error('Refusing to seed: NODE_ENV=production');
  process.exit(1);
}

const seedFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/seeds/dev_seed.sql');
const demoPassword = process.env.SEED_PASSWORD ?? 'ChangeMe-Dev-123!';

try {
  await pool.query(await readFile(seedFile, 'utf8'));

  const hash = await bcrypt.hash(demoPassword, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, teacher_id) VALUES
       ('admin@example.edu',   $1, 'admin',     NULL),
       ('ac@example.edu',      $1, 'ac_member', 2),
       ('faculty@example.edu', $1, 'faculty',   3)`,
    [hash],
  );

  // observee_observer_login (professor fix #5): a login is one teacher's
  // *account*, not a separate "observee" vs "observer" credential — the same
  // faculty login signs up to be observed (observee) and shows up as a
  // candidate who confirms a time to go observe someone else (observer),
  // depending only on which flow the UI is in at the time. Before this fix,
  // the seed only created 3 named demo accounts (above), so testing anyone
  // else's observer side (e.g. Professor H confirming a time) required an
  // ad hoc POST /api/auth/register call every time. Instead, give every
  // seeded teacher a login automatically, using their own teachers.email, so
  // the whole roster can sign in out of the box. Teachers 2 and 3 already
  // got an account above (as ac_member / faculty respectively) and
  // users.teacher_id is UNIQUE, so skip those two here.
  const { rows: teacherRows } = await pool.query(
    `SELECT id, email FROM teachers WHERE id NOT IN (2, 3) ORDER BY id`,
  );
  for (const t of teacherRows) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, teacher_id) VALUES ($1, $2, 'faculty', $3)`,
      [t.email, hash, t.id],
    );
  }

  console.log('Seeded. Demo logins (dev only): admin@example.edu, ac@example.edu, faculty@example.edu');
  console.log(`Plus one faculty login per seeded teacher (their own teachers.email, e.g. professor.h@example.edu)`);
  console.log(`Password: ${demoPassword}`);
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

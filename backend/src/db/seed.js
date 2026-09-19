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

  console.log('Seeded. Demo logins (dev only): admin@example.edu, ac@example.edu, faculty@example.edu');
  console.log(`Password: ${demoPassword}`);
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

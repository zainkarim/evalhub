import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { query } from '../db/pool.js';
import { authenticate, requireRole, signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many login attempts. Try again later.' } },
});

const toUser = (row) => ({ id: row.id, email: row.email, role: row.role, teacherId: row.teacher_id });

const loginBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

// POST /api/auth/login  ->  { token, user }
router.post('/login', loginLimiter, validate(loginBody), async (req, res) => {
  const { email, password } = req.valid.body;
  const { rows } = await query(
    'SELECT id, email, password_hash, role, teacher_id, is_active FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];
  const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.is_active || !passwordOk) {
    throw new HttpError(401, 'invalid_credentials', 'Invalid email or password');
  }
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json({ token: signToken(user), user: toUser(user) });
});

// GET /api/auth/me  ->  current user (+ linked teacher name)
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.teacher_id, t.first_name, t.last_name
       FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id
      WHERE u.id = $1 AND u.is_active`,
    [req.user.id],
  );
  if (!rows[0]) throw new HttpError(401, 'unauthorized', 'Account is no longer active');
  res.json({ ...toUser(rows[0]), firstName: rows[0].first_name, lastName: rows[0].last_name });
});

const registerBody = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(200),
  role: z.enum(['faculty', 'ac_member', 'admin']),
  teacherId: z.number().int().positive().nullable().optional(),
});

// POST /api/auth/register  (admin only) -> create a login account
router.post('/register', authenticate, requireRole('admin'), validate(registerBody), async (req, res) => {
  const { email, password, role, teacherId = null } = req.valid.body;
  if (role !== 'admin' && !teacherId) {
    throw new HttpError(400, 'validation_error', 'teacherId is required for faculty and ac_member accounts');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, role, teacher_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, role, teacher_id`,
    [email, passwordHash, role, teacherId],
  );
  res.status(201).json(toUser(rows[0]));
});

export default router;

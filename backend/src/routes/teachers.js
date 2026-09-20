import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { buildUpdate, escapeLike, pageOffset } from '../db/sql.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, pagination, paged, validate } from '../middleware/validate.js';

const router = Router();

// Keep in sync with the CHECK constraint on teachers.rank in 001_initial_schema.sql.
const RANKS = ['assistant_professor', 'associate_professor', 'full_professor'];

const toTeacher = (r) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  school: r.school,
  rank: r.rank,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const teacherFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  // Short upper-case school code, e.g. ECS, EPPS (normalised so equality matching works)
  school: z.string().trim().toUpperCase().min(1).max(50),
  rank: z.enum(RANKS),
  isActive: z.boolean().optional(),
};
const createBody = z.object(teacherFields);
const updateBody = z.object(teacherFields).partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  school: z.string().trim().toUpperCase().max(50).optional(),
  rank: z.enum(RANKS).optional(),
  active: z.enum(['true', 'false']).optional(),
  ...pagination,
});

const COLUMNS = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  school: 'school',
  rank: 'rank',
  isActive: 'is_active',
};

// GET /api/teachers?q=&school=&rank=&active=&page=&pageSize=   (AC / admin)
router.get('/', requireRole(...AC_OR_ADMIN), validate(listQuery, 'query'), async (req, res) => {
  const { q, school, rank, active, page, pageSize } = req.valid.query;
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replaceAll('?', `$${params.length}`)); };

  if (q) add('(first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?)', `%${escapeLike(q)}%`);
  if (school) add('school = ?', school);
  if (rank) add('rank = ?', rank);
  if (active) add('is_active = ?', active === 'true');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ rows }, { rows: count }] = await Promise.all([
    query(
      `SELECT * FROM teachers ${clause} ORDER BY last_name, first_name, id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, pageOffset(page, pageSize)],
    ),
    query(`SELECT count(*)::int AS total FROM teachers ${clause}`, params),
  ]);
  res.json(paged(rows.map(toTeacher), count[0].total, page, pageSize));
});

// GET /api/teachers/:id   (AC / admin, or the teacher themself)
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const isSelf = req.user.teacherId === id;
  if (!isSelf && !AC_OR_ADMIN.includes(req.user.role)) {
    throw new HttpError(403, 'forbidden', 'You do not have permission to do that');
  }
  const { rows } = await query('SELECT * FROM teachers WHERE id = $1', [id]);
  if (!rows[0]) throw notFound('Teacher');
  res.json(toTeacher(rows[0]));
});

// POST /api/teachers   (AC / admin)
router.post('/', requireRole(...AC_OR_ADMIN), validate(createBody), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await query(
    `INSERT INTO teachers (first_name, last_name, email, school, rank, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [b.firstName, b.lastName, b.email, b.school, b.rank, b.isActive ?? true],
  );
  res.status(201).json(toTeacher(rows[0]));
});

// PATCH /api/teachers/:id   (AC / admin) — partial update
router.patch('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(updateBody), async (req, res) => {
  const { sets, values } = buildUpdate(req.valid.body, COLUMNS);
  const { rows } = await query(
    `UPDATE teachers SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, req.valid.params.id],
  );
  if (!rows[0]) throw notFound('Teacher');
  res.json(toTeacher(rows[0]));
});

// DELETE /api/teachers/:id   (AC / admin) — SOFT delete (is_active = false).
// Teachers are referenced by teaching history and user accounts, so rows are never removed.
router.delete('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), async (req, res) => {
  const { rowCount } = await query('UPDATE teachers SET is_active = FALSE WHERE id = $1', [req.valid.params.id]);
  if (!rowCount) throw notFound('Teacher');
  res.status(204).end();
});

export default router;

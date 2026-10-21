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
  department: r.department,
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
  // Observer matching is by department (migration 005), e.g. CS. Defaults to
  // the school on create, the same fallback migration 005 used.
  department: z.string().trim().toUpperCase().min(1).max(50).optional(),
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
  // The AC Professors page loads the whole roster at once; the department
  // alone has 130+ teachers after the Nebula import, past the usual 100.
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

const COLUMNS = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  school: 'school',
  department: 'department',
  rank: 'rank',
  isActive: 'is_active',
};

// §4.1: Assistant Professor -> due again the calendar year after their last
// completed observation, satisfied by either Spring or Fall of that year.
// Associate/Full Professor -> due again 2 calendar years later. Summer terms
// never satisfy the cadence for anyone, and a Summer term itself carries no
// due/overdue status.
function dueYearFor(rank, lastCompletedYear) {
  if (lastCompletedYear == null) return null; // never (validly) evaluated
  const interval = rank === 'assistant_professor' ? 1 : 2;
  return lastCompletedYear + interval;
}

function computeDueStatus(r, term) {
  if (term.season === 'summer') return 'not_applicable';

  const countsTowardCadence = r.last_completed_season && r.last_completed_season !== 'summer';
  const lastCompletedYear = countsTowardCadence ? r.last_completed_year : null;

  const dueYear = dueYearFor(r.rank, lastCompletedYear);
  if (dueYear === null) return 'overdue';
  if (dueYear < term.year) return 'overdue';
  if (dueYear === term.year) return 'due';
  return 'not_due';
}

const toReportRow = (r, term) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  school: r.school,
  department: r.department,
  rank: r.rank,
  dueStatus: computeDueStatus(r, term),
  lastCompletedAt: r.last_completed_at,
  signUpStatus: r.current_assessment_id ? 'signed_up' : 'not_signed_up',
  currentObservationStatus: r.current_status ?? null,
});

const reportQuery = z.object({
  termId: z.coerce.number().int().positive(),
});

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

// GET /api/teachers/report?termId=   (AC / admin)
// Must be registered before GET /:id, or Express treats "report" as :id.
router.get(
  '/report',
  requireRole(...AC_OR_ADMIN),
  validate(reportQuery, 'query'),
  async (req, res) => {
    const { termId } = req.valid.query;

    const { rows: termRows } = await query('SELECT * FROM terms WHERE id = $1', [termId]);
    if (!termRows[0]) throw notFound('Term');
    const term = termRows[0];

    const { rows } = await query(
      `SELECT
          t.*,
          lc.completed_at AS last_completed_at,
          lt.year         AS last_completed_year,
          lt.season       AS last_completed_season,
          cur.id          AS current_assessment_id,
          cur.status      AS current_status
        FROM teachers t
        LEFT JOIN LATERAL (
          SELECT a.completed_at, a.due_term_id
            FROM assessments a
           WHERE a.teacher_id = t.id AND a.status = 'completed'
           ORDER BY a.completed_at DESC NULLS LAST
           LIMIT 1
        ) lc ON true
        LEFT JOIN terms lt ON lt.id = lc.due_term_id
        LEFT JOIN LATERAL (
          SELECT a.id, a.status
            FROM assessments a
           WHERE a.teacher_id = t.id AND a.due_term_id = $1
           ORDER BY a.signed_up_at DESC
           LIMIT 1
        ) cur ON true
       WHERE t.is_active
       ORDER BY t.last_name, t.first_name, t.id`,
      [termId],
    );

    res.json({ data: rows.map((r) => toReportRow(r, term)) });
  },
);

// GET /api/teachers/:id/profile   (AC / admin, or the teacher themself)
router.get('/:id/profile', validate(idParams, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const isSelf = req.user.teacherId === id;
  if (!isSelf && !AC_OR_ADMIN.includes(req.user.role)) {
    throw new HttpError(403, 'forbidden', 'You do not have permission to do that');
  }

  const { rows: teacherRows } = await query('SELECT * FROM teachers WHERE id = $1', [id]);
  if (!teacherRows[0]) throw notFound('Teacher');

  const { rows: history } = await query(
    `SELECT a.id, a.due_term_id, a.status, a.signed_up_at, a.completed_at,
            tm.season, tm.year
       FROM assessments a
       JOIN terms tm ON tm.id = a.due_term_id
      WHERE a.teacher_id = $1
      ORDER BY a.signed_up_at DESC`,
    [id],
  );

  res.json({
    ...toTeacher(teacherRows[0]),
    department: teacherRows[0].department,
    history: history.map((h) => ({
      assessmentId: h.id,
      termId: h.due_term_id,
      season: h.season,
      year: h.year,
      status: h.status,
      signedUpAt: h.signed_up_at,
      completedAt: h.completed_at,
    })),
  });
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
    `INSERT INTO teachers (first_name, last_name, email, school, department, rank, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [b.firstName, b.lastName, b.email, b.school, b.department ?? b.school, b.rank, b.isActive ?? true],
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

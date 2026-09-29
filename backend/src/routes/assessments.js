import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, pagination, paged, validate } from '../middleware/validate.js';

const router = Router();

const STATUSES = [
  'signed_up', 'candidates_generated', 'pending_ac_approval',
  'approved', 'completed', 'not_eligible', 'postponed', 'cancelled',
];

const toAssessment = (r) => ({
  id: r.id,
  teacherId: r.teacher_id,
  sectionId: r.section_id,
  dueTermId: r.due_term_id,
  status: r.status,
  signedUpAt: r.signed_up_at,
  completedAt: r.completed_at,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const listQuery = z.object({
  teacherId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUSES).optional(),
  ...pagination,
});

// GET /api/assessments?teacherId=&termId=&status=&page=&pageSize=   (AC / admin)
// Full list, any teacher. Faculty use GET /api/assessments/mine instead.
router.get('/', requireRole(...AC_OR_ADMIN), validate(listQuery, 'query'), async (req, res) => {
  const { teacherId, termId, status, page, pageSize } = req.valid.query;
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replaceAll('?', `$${params.length}`)); };

  if (teacherId) add('teacher_id = ?', teacherId);
  if (termId) add('due_term_id = ?', termId);
  if (status) add('status = ?', status);

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ rows }, { rows: count }] = await Promise.all([
    query(
      `SELECT * FROM assessments ${clause} ORDER BY signed_up_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
    query(`SELECT count(*)::int AS total FROM assessments ${clause}`, params),
  ]);
  res.json(paged(rows.map(toAssessment), count[0].total, page, pageSize));
});

// GET /api/assessments/mine   (faculty) — the current user's own sign-ups,
// both as observee here. (Observations they've *given* live under
// GET /api/observations once that endpoint exists — Fabian's piece.)
router.get('/mine', async (req, res) => {
  if (!req.user.teacherId) {
    throw new HttpError(403, 'forbidden', 'This account is not linked to a teacher profile');
  }
  const { rows } = await query(
    'SELECT * FROM assessments WHERE teacher_id = $1 ORDER BY signed_up_at DESC',
    [req.user.teacherId],
  );
  res.json({ data: rows.map(toAssessment) });
});

// GET /api/assessments/:id   (AC/admin, or the owning teacher)
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query('SELECT * FROM assessments WHERE id = $1', [req.valid.params.id]);
  if (!rows[0]) throw notFound('Assessment');
  const isOwner = req.user.teacherId === rows[0].teacher_id;
  if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
    throw new HttpError(403, 'forbidden', 'You do not have permission to do that');
  }
  res.json(toAssessment(rows[0]));
});

const signUpBody = z.object({
  sectionId: z.number().int().positive(),
  // AC/admin may sign up on behalf of a teacher; faculty may only sign up themselves.
  teacherId: z.number().int().positive().optional(),
});

// POST /api/assessments/sign-up   (faculty signs up themself; AC/admin may specify teacherId)
// "Professors sign up for a course each semester" (kickoff notes) —
// one assessment per (teacher, section); a section can only be claimed once (Q&A 18).
router.post('/sign-up', validate(signUpBody), async (req, res) => {
  const { sectionId, teacherId: requestedTeacherId } = req.valid.body;

  let teacherId = req.user.teacherId;
  if (requestedTeacherId && requestedTeacherId !== teacherId) {
    if (!AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(403, 'forbidden', 'Only AC/admin can sign up on behalf of another teacher');
    }
    teacherId = requestedTeacherId;
  }
  if (!teacherId) {
    throw new HttpError(400, 'validation_error', 'No teacher specified and this account has no linked teacher profile');
  }

  const { rows: sectionRows } = await query(
    `SELECT cs.id, cs.term_id, cs.teacher_id AS instructor_id, c.school, c.course_level
       FROM course_sections cs JOIN courses c ON c.id = cs.course_id
      WHERE cs.id = $1`,
    [sectionId],
  );
  const section = sectionRows[0];
  if (!section) throw notFound('Section');
  if (section.instructor_id !== teacherId) {
    // The requesting teacher must be the instructor of the section being observed.
    throw new HttpError(409, 'conflict', 'This teacher is not the instructor of that section');
  }

  const { rows } = await query(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [teacherId, sectionId, section.term_id],
  );
  res.status(201).json(toAssessment(rows[0]));
  // UNIQUE (section_id) on the table turns a duplicate sign-up for the same
  // section into a 409 conflict via the shared Postgres error handler.
});

const cancelBody = z.object({
  reason: z.enum(['not_eligible', 'left_department', 'other']).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// POST /api/assessments/:id/cancel   (AC/admin) — e.g. system flagged someone
// as due who turns out not to be (feeds the Eligibility Accuracy KPI).
router.post('/:id/cancel', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(cancelBody), async (req, res) => {
  const { reason, notes } = req.valid.body;
  const { rows } = await query(
    `UPDATE assessments SET status = 'cancelled', notes = COALESCE($2, notes)
     WHERE id = $1 AND status NOT IN ('completed', 'cancelled') RETURNING *`,
    [req.valid.params.id, reason ? `[${reason}] ${notes ?? ''}`.trim() : notes ?? null],
  );
  if (!rows[0]) throw notFound('Cancellable assessment');
  res.json(toAssessment(rows[0]));
});

export default router;

// --- Not built here (Sprint 2, Fabian's half of the split) ---------------
// POST /api/assessments/:id/candidates   — generate ~5 observer candidates
//   (see db/queries/eligible_observers.sql for the matching query this builds on)
// POST /api/assessments/:id/observations — record the chosen observer -> 'proposed'
// POST /api/observations/:id/review      — AC approve/reject (human-in-the-loop gate)
// POST /api/observations/:id/sign-off    — observer/observee confirm completion

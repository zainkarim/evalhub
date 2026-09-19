import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { buildUpdate } from '../db/sql.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

export const toSection = (r) => ({
  id: r.id,
  courseId: r.course_id,
  termId: r.term_id,
  sectionNumber: r.section_number,
  teacherId: r.teacher_id,
  meetingDays: r.meeting_days,
  startTime: r.start_time ? r.start_time.slice(0, 5) : null, // 'HH:MM:SS' -> 'HH:MM'
  endTime: r.end_time ? r.end_time.slice(0, 5) : null,
  location: r.location,
  source: r.source,
  externalId: r.external_id,
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24h)');

export const sectionFields = {
  termId: z.number().int().positive(),
  sectionNumber: z.string().trim().min(1).max(10),
  teacherId: z.number().int().positive().nullable().optional(),
  meetingDays: z.string().trim().max(20).nullable().optional(),
  startTime: hhmm.nullable().optional(),
  endTime: hhmm.nullable().optional(),
  location: z.string().trim().max(100).nullable().optional(),
};

export const sectionColumns = {
  termId: 'term_id',
  sectionNumber: 'section_number',
  teacherId: 'teacher_id',
  meetingDays: 'meeting_days',
  startTime: 'start_time',
  endTime: 'end_time',
  location: 'location',
};

const updateBody = z.object(sectionFields).partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

// "Teaching history": which sections has a teacher taught, optionally at a given level?
const listQuery = z.object({
  teacherId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
  level: z.coerce.number().int().min(1).max(9).optional(),
});

// GET /api/sections?teacherId=&termId=&level=   (any authenticated user)
router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { teacherId, termId, level } = req.valid.query;
  const params = [];
  const where = [];
  if (teacherId) { params.push(teacherId); where.push(`cs.teacher_id = $${params.length}`); }
  if (termId) { params.push(termId); where.push(`cs.term_id = $${params.length}`); }
  if (level) { params.push(level); where.push(`c.course_level = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT cs.* FROM course_sections cs JOIN courses c ON c.id = cs.course_id
     ${clause} ORDER BY cs.term_id DESC, cs.course_id, cs.section_number LIMIT 500`,
    params,
  );
  res.json({ data: rows.map(toSection) });
});

// PATCH /api/sections/:id   (AC / admin)
router.patch('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(updateBody), async (req, res) => {
  const { sets, values } = buildUpdate(req.valid.body, sectionColumns);
  const { rows } = await query(
    `UPDATE course_sections SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, req.valid.params.id],
  );
  if (!rows[0]) throw notFound('Section');
  res.json(toSection(rows[0]));
});

// DELETE /api/sections/:id   (AC / admin)
router.delete('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM course_sections WHERE id = $1', [req.valid.params.id]);
  if (!rowCount) throw notFound('Section');
  res.status(204).end();
});

export default router;

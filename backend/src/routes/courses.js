import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { buildUpdate, escapeLike, pageOffset } from '../db/sql.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { notFound } from '../middleware/errors.js';
import { idParams, pagination, paged, validate } from '../middleware/validate.js';
import { sectionFields, toSection } from './sections.js';

const router = Router();

const toCourse = (r) => ({
  id: r.id,
  subject: r.subject,
  school: r.school,
  courseNumber: r.course_number,
  title: r.title,
  courseLevel: r.course_level, // derived by the database from the first digit of courseNumber
  source: r.source,
  externalId: r.external_id,
});

const courseFields = {
  subject: z.string().trim().toUpperCase().regex(/^[A-Z]{2,6}$/, 'Expected 2-6 letters, e.g. CS'),
  // School that owns the course; observer eligibility is by (school, level)
  school: z.string().trim().toUpperCase().min(1).max(50),
  courseNumber: z.string().trim().regex(/^\d{4}$/, 'Expected 4 digits, e.g. 4485'),
  title: z.string().trim().min(1).max(200),
  externalId: z.string().trim().max(100).nullable().optional(),
};
const createBody = z.object(courseFields);
const updateBody = z.object(courseFields).partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

const COLUMNS = { subject: 'subject', school: 'school', courseNumber: 'course_number', title: 'title', externalId: 'external_id' };

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  subject: z.string().trim().toUpperCase().max(6).optional(),
  school: z.string().trim().toUpperCase().max(50).optional(),
  level: z.coerce.number().int().min(1).max(9).optional(),
  ...pagination,
});

// GET /api/courses?q=&subject=&school=&level=&page=&pageSize=   (any authenticated user)
router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { q, subject, school, level, page, pageSize } = req.valid.query;
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replaceAll('?', `$${params.length}`)); };

  if (q) add("(title ILIKE ? OR (subject || course_number) ILIKE ? OR (subject || ' ' || course_number) ILIKE ?)", `%${escapeLike(q)}%`);
  if (subject) add('subject = ?', subject);
  if (school) add('school = ?', school);
  if (level) add('course_level = ?', level);

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ rows }, { rows: count }] = await Promise.all([
    query(
      `SELECT * FROM courses ${clause} ORDER BY subject, course_number
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, pageOffset(page, pageSize)],
    ),
    query(`SELECT count(*)::int AS total FROM courses ${clause}`, params),
  ]);
  res.json(paged(rows.map(toCourse), count[0].total, page, pageSize));
});

// GET /api/courses/:id
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query('SELECT * FROM courses WHERE id = $1', [req.valid.params.id]);
  if (!rows[0]) throw notFound('Course');
  res.json(toCourse(rows[0]));
});

// POST /api/courses   (AC / admin)
router.post('/', requireRole(...AC_OR_ADMIN), validate(createBody), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await query(
    'INSERT INTO courses (subject, school, course_number, title, external_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [b.subject, b.school, b.courseNumber, b.title, b.externalId ?? null],
  );
  res.status(201).json(toCourse(rows[0]));
});

// PATCH /api/courses/:id   (AC / admin)
router.patch('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(updateBody), async (req, res) => {
  const { sets, values } = buildUpdate(req.valid.body, COLUMNS);
  const { rows } = await query(
    `UPDATE courses SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, req.valid.params.id],
  );
  if (!rows[0]) throw notFound('Course');
  res.json(toCourse(rows[0]));
});

// DELETE /api/courses/:id   (AC / admin) — 409 if the course still has sections
router.delete('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM courses WHERE id = $1', [req.valid.params.id]);
  if (!rowCount) throw notFound('Course');
  res.status(204).end();
});

// ---- Sections nested under a course --------------------------------------

const sectionListQuery = z.object({
  termId: z.coerce.number().int().positive().optional(),
  teacherId: z.coerce.number().int().positive().optional(),
});
const createSectionBody = z.object(sectionFields);

// GET /api/courses/:id/sections?termId=&teacherId=
router.get('/:id/sections', validate(idParams, 'params'), validate(sectionListQuery, 'query'), async (req, res) => {
  const { termId, teacherId } = req.valid.query;
  const params = [req.valid.params.id];
  const where = ['course_id = $1'];
  if (termId) { params.push(termId); where.push(`term_id = $${params.length}`); }
  if (teacherId) { params.push(teacherId); where.push(`teacher_id = $${params.length}`); }
  const { rows } = await query(
    `SELECT * FROM course_sections WHERE ${where.join(' AND ')} ORDER BY term_id DESC, section_number`,
    params,
  );
  res.json({ data: rows.map(toSection) });
});

// POST /api/courses/:id/sections   (AC / admin)
router.post('/:id/sections', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(createSectionBody), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await query(
    `INSERT INTO course_sections (course_id, term_id, section_number, teacher_id, meeting_days, start_time, end_time, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.valid.params.id, b.termId, b.sectionNumber, b.teacherId ?? null, b.meetingDays ?? null, b.startTime ?? null, b.endTime ?? null, b.location ?? null],
  );
  res.status(201).json(toSection(rows[0]));
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, notFound } from '../middleware/errors.js';

const router = Router();

const toTerm = (r) => ({
  id: r.id,
  season: r.season,
  year: r.year,
  startDate: r.start_date,
  endDate: r.end_date,
  isLongTerm: r.is_long_term,
  signupDeadline: r.signup_deadline,
  observationDeadline: r.observation_deadline,
  feedbackDeadline: r.feedback_deadline,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const termBody = z.object({
  season: z.enum(['spring', 'summer', 'fall']),
  year: z.number().int().min(2000).max(2100),
  startDate: isoDate,
  endDate: isoDate,
}).refine((t) => t.endDate > t.startDate, { message: 'endDate must be after startDate', path: ['endDate'] });

const datesBody = z.object({
  signupDeadline: isoDate.optional(),
  observationDeadline: isoDate.optional(),
  feedbackDeadline: isoDate.optional(),
}).refine((b) => b.signupDeadline || b.observationDeadline || b.feedbackDeadline, {
  message: 'Provide at least one of signupDeadline, observationDeadline, or feedbackDeadline',
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

// GET /api/terms  (any authenticated user) — newest first
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM terms ORDER BY start_date DESC');
  res.json({ data: rows.map(toTerm) });
});

// POST /api/terms  (AC / admin)
router.post('/', requireRole(...AC_OR_ADMIN), validate(termBody), async (req, res) => {
  const { season, year, startDate, endDate } = req.valid.body;
  const { rows } = await query(
    'INSERT INTO terms (season, year, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *',
    [season, year, startDate, endDate],
  );
  res.status(201).json(toTerm(rows[0]));
});

// PATCH /api/terms/:id/dates  (AC / admin) — set or update sign-up / observation-period /
// feedback deadlines. Order enforced: signup < observation < feedback.
router.patch(
  '/:id/dates',
  requireRole(...AC_OR_ADMIN),
  validate(idParams, 'params'),
  validate(datesBody),
  async (req, res) => {
    const { id } = req.valid.params;
    const { rows: termRows } = await query('SELECT * FROM terms WHERE id = $1', [id]);
    if (!termRows[0]) throw notFound('Term');
    const term = termRows[0];

    const signupDeadline = req.valid.body.signupDeadline ?? term.signup_deadline;
    const observationDeadline = req.valid.body.observationDeadline ?? term.observation_deadline;
    const feedbackDeadline = req.valid.body.feedbackDeadline ?? term.feedback_deadline;

    if (signupDeadline && observationDeadline && signupDeadline >= observationDeadline) {
      throw new HttpError(
        400,
        'validation_error',
        'signupDeadline must be before observationDeadline',
        { signupDeadline, observationDeadline },
      );
    }
    if (observationDeadline && feedbackDeadline && observationDeadline >= feedbackDeadline) {
      throw new HttpError(
        400,
        'validation_error',
        'observationDeadline must be before feedbackDeadline',
        { observationDeadline, feedbackDeadline },
      );
    }
    if (!observationDeadline && signupDeadline && feedbackDeadline && signupDeadline >= feedbackDeadline) {
      throw new HttpError(
        400,
        'validation_error',
        'signupDeadline must be before feedbackDeadline',
        { signupDeadline, feedbackDeadline },
      );
    }
    if (observationDeadline && observationDeadline > term.end_date) {
      throw new HttpError(
        400,
        'validation_error',
        `observationDeadline (${observationDeadline}) cannot be after the term ends (${term.end_date})`,
      );
    }

    const { rows } = await query(
      'UPDATE terms SET signup_deadline = $2, observation_deadline = $3, feedback_deadline = $4 WHERE id = $1 RETURNING *',
      [id, signupDeadline, observationDeadline, feedbackDeadline],
    );
    res.json(toTerm(rows[0]));
  },
);

export default router;

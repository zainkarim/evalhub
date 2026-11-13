
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

const surveyBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  feedback: z.string().max(5000).default(''),
  suggestions: z.string().max(5000).default(''),
});

const surveyQuery = z.object({
  termId: z.coerce.number().int().positive(),
});

// Only faculty with a teacher profile can submit.
function checkFaculty(req, res, next) {
  if (req.user.role !== 'faculty' || !req.user.teacherId) {
    return next(new HttpError(403, 'forbidden', 'Faculty profile is required.'));
  }
  next();
}

// Find the latest term that has started.
async function getCurrentTerm() {
  const { rows } = await query(
    `SELECT *
     FROM terms
     WHERE start_date <= CURRENT_DATE
     ORDER BY start_date DESC
     LIMIT 1`,
  );
  return rows[0] ?? null;
}

// GET /api/surveys/status
router.get('/status', checkFaculty, async (req, res) => {
  const term = await getCurrentTerm();

  if (!term) {
    return res.json({
      submitted: false,
      available: false,
    });
  }

  const { rows } = await query(
    `SELECT id
     FROM process_feedback
     WHERE respondent_id = $1
       AND term_id = $2
       AND observation_id IS NULL
     LIMIT 1`,
    [req.user.teacherId, term.id],
  );

  const submitted = rows.length > 0;

  // Check the feedback deadline.
  const { rows: deadlineRows } = await query(
    `SELECT (
       feedback_deadline IS NULL
       OR CURRENT_DATE <= feedback_deadline
     ) AS available
     FROM terms
     WHERE id = $1`,
    [term.id],
  );

  res.json({
    submitted,
    available: deadlineRows[0].available,
    termId: term.id,
  });
});

// POST /api/surveys
router.post('/', checkFaculty, validate(surveyBody), async (req, res) => {
  const term = await getCurrentTerm();

  if (!term) {
    throw new HttpError(
      400,
      'validation_error',
      'There is no active term for this survey.',
    );
  }

  const { rows: existing } = await query(
    `SELECT id
     FROM process_feedback
     WHERE respondent_id = $1
       AND term_id = $2
       AND observation_id IS NULL
     LIMIT 1`,
    [req.user.teacherId, term.id],
  );

  if (existing.length > 0) {
    throw new HttpError(
      409,
      'conflict',
      'You have already submitted this survey for this term.',
    );
  }

  // Check the feedback deadline.
  const { rows: deadlineRows } = await query(
    `SELECT (
       feedback_deadline IS NULL
       OR CURRENT_DATE <= feedback_deadline
     ) AS available
     FROM terms
     WHERE id = $1`,
    [term.id],
  );

  if (!deadlineRows[0].available) {
    throw new HttpError(
      409,
      'conflict',
      'The feedback survey deadline has passed.',
    );
  }

  const { rating, feedback, suggestions } = req.valid.body;

  try {
    const { rows } = await query(
      `INSERT INTO process_feedback
         (respondent_id, term_id, rating, feedback, suggestions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, term_id, rating, feedback, suggestions, submitted_at`,
      [req.user.teacherId, term.id, rating, feedback, suggestions],
    );

    return res.status(201).json({
      id: rows[0].id,
      termId: rows[0].term_id,
      rating: rows[0].rating,
      feedback: rows[0].feedback,
      suggestions: rows[0].suggestions,
      submittedAt: rows[0].submitted_at,
    });
  } catch (err) {
    // Prevent duplicate submissions at the same time.
    if (err.code === '23505') {
      throw new HttpError(
        409,
        'conflict',
        'You have already submitted this survey for this term.',
      );
    }
    throw err;
  }
});

// GET /api/surveys?termId=10
router.get(
  '/',
  requireRole(...AC_OR_ADMIN),
  validate(surveyQuery, 'query'),
  async (req, res) => {
    const { termId } = req.valid.query;

    const { rows } = await query(
      `SELECT id, respondent_id, term_id, rating,
              feedback, suggestions, submitted_at
       FROM process_feedback
       WHERE term_id = $1
         AND observation_id IS NULL
       ORDER BY submitted_at DESC`,
      [termId],
    );

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        respondentId: row.respondent_id,
        termId: row.term_id,
        rating: row.rating,
        feedback: row.feedback,
        suggestions: row.suggestions,
        submittedAt: row.submitted_at,
      })),
    });
  },
);

export default router;

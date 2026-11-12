import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { findEligibleObservers, latestCandidateList, saveCandidateList } from '../lib/candidateLists.js';

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
  // When the committee clicked Start Observer Selection for the term; null until then.
  selectionStartedAt: r.selection_started_at ?? null,
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

// POST /api/terms/:id/start-observer-selection  (AC / admin)
// THE one cycle-wide "Start Observer Selection". After the sign-up deadline the
// committee clicks it once and every sign-up in the term that has no candidate
// list gets one. It approves nothing.
//  - idempotent: a sign-up that already has a non-empty list is never re-rolled;
//  - a sign-up whose list is empty is re-checked on every call, and only gets a
//    new list when somebody has become eligible ("stillEmpty" counts the rest);
//  - zero eligible saves a 0/0 list so the alert and KPIs can see it.
router.post(
  '/:id/start-observer-selection',
  requireRole(...AC_OR_ADMIN),
  validate(idParams, 'params'),
  async (req, res) => {
    const { id } = req.valid.params;
    const { rows: termRows } = await query('SELECT * FROM terms WHERE id = $1', [id]);
    if (!termRows[0]) throw notFound('Term');
    const term = termRows[0];

    const startedBefore = term.selection_started_at;
    const today = new Date().toISOString().slice(0, 10);
    if (!startedBefore && term.signup_deadline && today <= term.signup_deadline) {
      throw new HttpError(
        409,
        'conflict',
        `Observer selection opens the day after the sign-up deadline (${term.signup_deadline}).`,
      );
    }

    const { rows: signUps } = await query(
      `SELECT * FROM assessments
        WHERE due_term_id = $1 AND status = 'signed_up'
        ORDER BY signed_up_at, id`,
      [id],
    );

    const built = [];
    let stillEmpty = 0;
    for (const assessment of signUps) {
      const existing = await latestCandidateList(assessment.id);
      if (existing && existing.list_size > 0) continue;

      const matching = await findEligibleObservers(assessment);
      if (!matching) continue;
      // Empty list from an earlier call: only replace it when somebody is eligible now.
      if (existing && matching.poolSize === 0) {
        stillEmpty += 1;
        continue;
      }
      await saveCandidateList(assessment, matching, req.user.id);
      built.push({ poolSize: matching.poolSize, fullListSize: matching.fullListSize });
    }

    const { rows: startedRows } = await query(
      `UPDATE terms SET selection_started_at = COALESCE(selection_started_at, now())
        WHERE id = $1 RETURNING selection_started_at`,
      [id],
    );

    res.json({
      termId: id,
      alreadyStarted: Boolean(startedBefore),
      startedAt: startedRows[0].selection_started_at,
      started: built.length,
      noEligible: built.filter((b) => b.poolSize === 0).length,
      limited: built.filter((b) => b.poolSize > 0 && b.poolSize < b.fullListSize).length,
      full: built.filter((b) => b.poolSize >= b.fullListSize).length,
      stillEmpty,
    });
  },
);

export default router;

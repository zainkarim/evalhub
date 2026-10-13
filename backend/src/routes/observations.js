import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

const toObservation = (r) => ({
  id: r.id,
  assessmentId: r.assessment_id,
  observeeId: r.observee_id,
  observerId: r.observer_id,
  attemptNo: r.attempt_no,
  status: r.status,
  scheduledDate: r.scheduled_date,
  observerSignedOffAt: r.observer_signed_off_at,
  observeeSignedOffAt: r.observee_signed_off_at,
});

const toResponse = (r) => ({
  id: r.id,
  observationId: r.observation_id,
  criterionId: r.criterion_id,
  score: r.score,
  updatedAt: r.updated_at,
});

async function loadObservation(id) {
  const { rows } = await query('SELECT * FROM observations WHERE id = $1', [id]);
  return rows[0] ?? null;
}

function requireParty(req, observation) {
  const isObserver = req.user.teacherId === observation.observer_id;
  const isObservee = req.user.teacherId === observation.observee_id;
  const isAcAdmin = AC_OR_ADMIN.includes(req.user.role);
  if (!isObserver && !isObservee && !isAcAdmin) {
    throw new HttpError(403, 'forbidden', 'You are not part of this observation');
  }
  return { isObserver, isObservee, isAcAdmin };
}

// Retired endpoint: selecting an observer no longer requires AC approval.
// Keep an explicit response so old clients cannot silently use the old workflow.
router.post('/:id/review', validate(idParams, 'params'), async () => {
  throw new HttpError(
    410,
    'ac_review_removed',
    'AC approval is no longer part of the observation workflow. Select an eligible observer, or use AC override when no eligible observers exist.',
  );
});

// GET /api/observations/:id   (observer, observee, or AC/admin)
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const observation = await loadObservation(req.valid.params.id);
  if (!observation) throw notFound('Observation');
  requireParty(req, observation);
  res.json(toObservation(observation));
});

// ---------------------------------------------------------------------
// #23: submit + view questionnaire responses. Depends on criteria CRUD
// (src/routes/criteria.js) and observation_responses (migration 008).
// ---------------------------------------------------------------------

const submitBody = z.object({
  responses: z.array(z.object({
    criterionId: z.number().int().positive(),
    score: z.number().int().positive(),
  })).min(1).max(50),
});

// POST /api/observations/:id/responses   (the observer on this observation, only)
// Upsert, not insert-only: the observer can amend an answer right up until
// they sign off (see migration 008's design note on why this isn't
// insert-only). "Cannot edit questions" (the issue's own phrasing) means the
// evaluation_criteria set itself is fixed from here -- criteria.js owns
// that, not this endpoint, which only ever writes scores against criteria
// that already exist (enforced by the FK + the DB-level score-range
// trigger, migration 008).
router.post(
  '/:id/responses',
  validate(idParams, 'params'),
  validate(submitBody),
  async (req, res) => {
    const observation = await loadObservation(req.valid.params.id);
    if (!observation) throw notFound('Observation');

    if (req.user.teacherId !== observation.observer_id) {
      throw new HttpError(403, 'forbidden', 'Only the observer on this observation can submit responses');
    }

    if (observation.observer_signed_off_at) {
      throw new HttpError(409, 'conflict', 'You have already signed off on this observation; responses are final');
    }

    const inserted = [];
    for (const r of req.valid.body.responses) {
      try {
        const { rows } = await query(
          `INSERT INTO observation_responses (observation_id, criterion_id, score)
           VALUES ($1, $2, $3)
           ON CONFLICT (observation_id, criterion_id) DO UPDATE SET score = EXCLUDED.score
           RETURNING *`,
          [observation.id, r.criterionId, r.score],
        );
        inserted.push(rows[0]);
      } catch (err) {
        // The DB trigger (migration 008) rejects a score above that
        // criterion's max_score with a RAISE EXCEPTION, which arrives here
        // as a generic Postgres error (no standard SQLSTATE for a custom
        // RAISE) -- surface it as a validation error naming the criterion,
        // rather than letting errorHandler fall through to a bare 500.
        if (err.message?.includes('exceeds criterion')) {
          throw new HttpError(400, 'validation_error', err.message, { criterionId: r.criterionId });
        }
        throw err;
      }
    }

    res.status(201).json({ data: inserted.map(toResponse) });
  },
);

// GET /api/observations/:id/responses   (observer, observee, or AC/admin --
// but observer/observee only once BOTH have signed off; "view results
// read-only once submitted and signed", the issue's own wording)
router.get('/:id/responses', validate(idParams, 'params'), async (req, res) => {
  const observation = await loadObservation(req.valid.params.id);
  if (!observation) throw notFound('Observation');

  const { isAcAdmin } = requireParty(req, observation);

  const bothSigned = observation.observer_signed_off_at && observation.observee_signed_off_at;
  if (!isAcAdmin && !bothSigned) {
    throw new HttpError(409, 'conflict', 'Responses are not visible until both the observer and observee have signed off');
  }

  const { rows } = await query(
    `SELECT r.*, c.name AS criterion_name, c.max_score
       FROM observation_responses r
       JOIN evaluation_criteria c ON c.id = r.criterion_id
      WHERE r.observation_id = $1
      ORDER BY c.sort_order, c.id`,
    [observation.id],
  );

  res.json({
    data: rows.map((r) => ({ ...toResponse(r), criterionName: r.criterion_name, maxScore: r.max_score })),
  });
});

// ---------------------------------------------------------------------
// Sign-off. Not a numbered ticket, but #23's read-gating above is dead
// code without a way for observer_signed_off_at / observee_signed_off_at
// to ever actually get set (nothing in the codebase set them before this).
// ---------------------------------------------------------------------

// POST /api/observations/:id/sign-off   (the observer or the observee on
// this observation, signing off as themselves -- not on each other's
// behalf, and not AC/admin, since a sign-off is a personal attestation)
router.post('/:id/sign-off', validate(idParams, 'params'), async (req, res) => {
  const observation = await loadObservation(req.valid.params.id);
  if (!observation) throw notFound('Observation');

  const isObserver = req.user.teacherId === observation.observer_id;
  const isObservee = req.user.teacherId === observation.observee_id;

  if (!isObserver && !isObservee) {
    throw new HttpError(403, 'forbidden', 'Only the observer or observee on this observation can sign off on it');
  }

  if (isObserver && observation.observer_signed_off_at) {
    throw new HttpError(409, 'conflict', 'You have already signed off on this observation');
  }
  if (isObservee && observation.observee_signed_off_at) {
    throw new HttpError(409, 'conflict', 'You have already signed off on this observation');
  }

  // The observer's sign-off is their attestation that the questionnaire is
  // complete -- require every active criterion to have an answer first, so
  // a sign-off can't lock in a half-filled questionnaire (migration 008's
  // design note flags exactly this risk).
  if (isObserver) {
    const { rows: unanswered } = await query(
      `SELECT c.id, c.name
         FROM evaluation_criteria c
        WHERE c.is_active
          AND NOT EXISTS (
            SELECT 1 FROM observation_responses r
             WHERE r.observation_id = $1 AND r.criterion_id = c.id
          )`,
      [observation.id],
    );
    if (unanswered.length > 0) {
      throw new HttpError(
        409,
        'conflict',
        'All active criteria must be answered before signing off',
        { missing: unanswered.map((c) => ({ id: c.id, name: c.name })) },
      );
    }
  }

  const column = isObserver ? 'observer_signed_off_at' : 'observee_signed_off_at';
  const { rows: updatedRows } = await query(
    `UPDATE observations SET ${column} = now() WHERE id = $1 RETURNING *`,
    [observation.id],
  );
  let updated = updatedRows[0];

  // Both sides signed -- this is the one place that ever moves an
  // observation (and its assessment) to 'completed'. Nothing else in the
  // codebase did this before; without it, 'completed' was an unreachable
  // status despite being the terminal state the schema's own CHECK
  // constraints are written around.
  if (updated.observer_signed_off_at && updated.observee_signed_off_at && updated.status !== 'completed') {
    const { rows: completedRows } = await query(
      `UPDATE observations SET status = 'completed' WHERE id = $1 RETURNING *`,
      [observation.id],
    );
    updated = completedRows[0];

    await query(
      `UPDATE assessments SET status = 'completed', completed_at = now() WHERE id = $1`,
      [updated.assessment_id],
    );
  }

  res.json(toObservation(updated));
});

export default router;

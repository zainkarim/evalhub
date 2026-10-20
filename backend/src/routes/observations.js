import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../db/pool.js';
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

// GET /api/observations/:id/responses   (AC/admin and the observer: always;
// the observee: only once the OBSERVER has signed off. Professor correction
// on #23: the original "both signed" gate was backwards -- it made the
// observee sign off blind before they were ever allowed to see what they
// were signing. The observer wrote the responses and is the only one who
// can edit them (see POST above), so they can always see their own work;
// the observee's read access unlocks as soon as the observer locks theirs
// in, and the observee signs after reviewing, not before.)
router.get('/:id/responses', validate(idParams, 'params'), async (req, res) => {
  const observation = await loadObservation(req.valid.params.id);
  if (!observation) throw notFound('Observation');

  const { isAcAdmin, isObserver } = requireParty(req, observation);

  const observerSigned = Boolean(observation.observer_signed_off_at);
  if (!isAcAdmin && !isObserver && !observerSigned) {
    throw new HttpError(409, 'conflict', 'Responses are not visible to the observee until the observer has signed off');
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

// POST /api/observations/:id/sign-off
router.post('/:id/sign-off', validate(idParams, 'params'), async (req, res) => {
  const client = await pool.connect();
  let updated;

  try {
    await client.query('BEGIN');

    // Lock the parent assessment before its observation.
    const { rows: assessmentRows } = await client.query(
      `SELECT a.* FROM assessments a
       WHERE a.id = (
         SELECT assessment_id FROM observations WHERE id = $1
       )
       FOR UPDATE OF a`,
      [req.valid.params.id],
    );
    const assessment = assessmentRows[0];
    if (!assessment) throw notFound('Observation');

    const { rows: observationRows } = await client.query(
      `SELECT o.*, o.scheduled_date <= CURRENT_DATE AS date_reached
       FROM observations o
       WHERE o.id = $1 AND o.assessment_id = $2
       FOR UPDATE OF o`,
      [req.valid.params.id, assessment.id],
    );
    const observation = observationRows[0];
    if (!observation) throw notFound('Observation');

    const isObserver = req.user.teacherId === observation.observer_id;
    const isObservee = req.user.teacherId === observation.observee_id;

    if (!isObserver && !isObservee) {
      throw new HttpError(
        403, 'forbidden',
        'Only the observer or observee on this observation can sign off on it',
      );
    }

    // A completed record is returned without any writes, after authorization.
    if (observation.status === 'completed' && assessment.status === 'completed') {
      updated = observation;
    } else {
      if (observation.status !== 'approved' || assessment.status !== 'approved') {
        throw new HttpError(
          409, 'conflict',
          'The observation and assessment must both be active and approved before sign-off',
        );
      }

      if (!observation.scheduled_date) {
        throw new HttpError(
          409, 'conflict',
          'The observation must have a scheduled date before sign-off',
        );
      }
      if (!observation.date_reached) {
        throw new HttpError(
          409, 'conflict',
          'The scheduled observation date has not been reached',
        );
      }

      if ((isObserver && observation.observer_signed_off_at)
          || (isObservee && observation.observee_signed_off_at)) {
        throw new HttpError(
          409, 'conflict',
          'You have already signed off on this observation',
        );
      }

      // Preserve main's requirement: every active criterion needs an answer.
      if (isObserver) {
        const { rows: unanswered } = await client.query(
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
            409, 'conflict',
            'All active criteria must be answered before signing off',
            { missing: unanswered.map((c) => ({ id: c.id, name: c.name })) },
          );
        }
      }

      const column = isObserver ? 'observer_signed_off_at' : 'observee_signed_off_at';
      const { rows: signedRows } = await client.query(
        `UPDATE observations SET ${column} = now() WHERE id = $1 RETURNING *`,
        [observation.id],
      );
      updated = signedRows[0];

      if (updated.observer_signed_off_at && updated.observee_signed_off_at) {
        const { rows: completedRows } = await client.query(
          `UPDATE observations SET status = 'completed' WHERE id = $1 RETURNING *`,
          [observation.id],
        );
        updated = completedRows[0];

        await client.query(
          `UPDATE assessments
           SET status = 'completed', completed_at = COALESCE(completed_at, now())
           WHERE id = $1`,
          [assessment.id],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(toObservation(updated));
});

export default router;

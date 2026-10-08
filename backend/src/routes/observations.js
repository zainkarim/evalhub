import { Router } from 'express';
import { pool } from '../db/pool.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

const toSignOff = (row) => ({
  id: row.id,
  assessmentId: row.assessment_id,
  status: row.status,
  scheduledDate: row.scheduled_date,
  observerSignedOffAt: row.observer_signed_off_at,
  observeeSignedOffAt: row.observee_signed_off_at,
});

// Retired endpoint: selecting an observer no longer requires AC approval.
router.post('/:id/review', validate(idParams, 'params'), async () => {
  throw new HttpError(
    410,
    'ac_review_removed',
    'AC approval is no longer part of the observation workflow. Select an eligible observer, or use AC override when no eligible observers exist.',
  );
});

// Each participant signs for themselves. Both signatures complete the record.
router.post('/:id/sign-off', validate(idParams, 'params'), async (req, res) => {
  const client = await pool.connect();
  let result;

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT *, scheduled_date <= CURRENT_DATE AS sign_off_date_reached
         FROM observations
        WHERE id = $1
        FOR UPDATE`,
      [req.valid.params.id],
    );

    const observation = rows[0];
    if (!observation) throw notFound('Observation');

    const teacherId = req.user.teacherId;
    const isObserver =
      teacherId != null && teacherId === observation.observer_id;
    const isObservee =
      teacherId != null && teacherId === observation.observee_id;

    if (!isObserver && !isObservee) {
      throw new HttpError(
        403,
        'forbidden',
        'Only the observer or observee for this observation can sign off',
      );
    }

    if (observation.status === 'completed') {
      // Repeated requests do not change a completed record.
      result = observation;
    } else {
      const { rows: assessments } = await client.query(
        'SELECT status FROM assessments WHERE id = $1 FOR UPDATE',
        [observation.assessment_id],
      );

      if (
        observation.status !== 'approved' ||
        assessments[0]?.status !== 'approved'
      ) {
        throw new HttpError(
          409,
          'conflict',
          'Only an active scheduled observation can be signed off',
        );
      }

      if (!observation.scheduled_date) {
        throw new HttpError(
          409,
          'conflict',
          'The observation must have a scheduled date before sign-off',
        );
      }

      if (!observation.sign_off_date_reached) {
        throw new HttpError(
          409,
          'conflict',
          'Cannot sign off before the scheduled observation date',
        );
      }

      // Selected by the server, never supplied by the user.
      const column = isObserver
        ? 'observer_signed_off_at'
        : 'observee_signed_off_at';

      result = observation;

      if (!observation[column]) {
        const { rows: signed } = await client.query(
          `UPDATE observations
              SET ${column} = now()
            WHERE id = $1
            RETURNING *`,
          [observation.id],
        );
        result = signed[0];
      }

      if (result.observer_signed_off_at && result.observee_signed_off_at) {
        const { rows: completed } = await client.query(
          `UPDATE observations
              SET status = 'completed'
            WHERE id = $1
            RETURNING *`,
          [observation.id],
        );
        result = completed[0];

        await client.query(
          `UPDATE assessments
              SET status = 'completed',
                  completed_at = COALESCE(completed_at, now())
            WHERE id = $1`,
          [observation.assessment_id],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  res.json(toSignOff(result));
});

export default router;
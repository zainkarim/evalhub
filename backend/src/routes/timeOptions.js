import { Router } from 'express';
import { pool } from '../db/pool.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

const toOption = (r) => ({
  id: r.id,
  assessmentId: r.assessment_id,
  proposedDate: r.proposed_date,
  startTime: r.start_time ? r.start_time.slice(0, 5) : null,
  endTime: r.end_time ? r.end_time.slice(0, 5) : null,
  offeredToTeacherId: r.offered_to_teacher_id,
  isConfirmed: r.is_confirmed,
});

function checkOption(option, teacherId) {
  if (!option) throw notFound('Time option');

  if (teacherId == null || option.offered_to_teacher_id !== teacherId) {
    throw new HttpError(403, 'forbidden', 'This option was not offered to you');
  }

  if (option.is_confirmed) {
    throw new HttpError(409, 'conflict', 'This option is already confirmed');
  }
}

router.post('/:id/confirm', validate(idParams, 'params'), async (req, res) => {
  const client = await pool.connect();
  let confirmedOption;

  try {
    await client.query('BEGIN');

    const optionId = req.valid.params.id;
    const teacherId = req.user.teacherId;

    const { rows: initialOptions } = await client.query(
      'SELECT * FROM assessment_time_options WHERE id = $1',
      [optionId],
    );

    const initialOption = initialOptions[0];
    checkOption(initialOption, teacherId);

    // Lock the latest observation attempt before changing its date.
    // Other confirmations for this assessment wait here.
    const { rows: observations } = await client.query(
      `SELECT *
         FROM observations
        WHERE assessment_id = $1
        ORDER BY attempt_no DESC
        LIMIT 1
        FOR UPDATE`,
      [initialOption.assessment_id],
    );

    const observation = observations[0];

    if (!observation) {
      throw new HttpError(
        409,
        'conflict',
        'An observation must exist before confirming a date',
      );
    }

    if (observation.observer_id !== teacherId) {
      throw new HttpError(
        409,
        'conflict',
        'This option does not match the current observation observer',
      );
    }

    const { rows: assessments } = await client.query(
      'SELECT status FROM assessments WHERE id = $1 FOR UPDATE',
      [initialOption.assessment_id],
    );

    if (
      observation.status !== 'approved' ||
      assessments[0]?.status !== 'approved'
    ) {
      throw new HttpError(
        409,
        'conflict',
        'Only an active observation can have a date confirmed',
      );
    }

    if (observation.scheduled_date) {
      throw new HttpError(
        409,
        'conflict',
        'This observation already has a scheduled date',
      );
    }

    // Recheck after waiting for locks; another request may have changed it.
    const { rows: currentOptions } = await client.query(
      'SELECT * FROM assessment_time_options WHERE id = $1 FOR UPDATE',
      [optionId],
    );

    const option = currentOptions[0];
    checkOption(option, teacherId);

    await client.query(
      'UPDATE observations SET scheduled_date = $1 WHERE id = $2',
      [option.proposed_date, observation.id],
    );

    const { rows: confirmed } = await client.query(
      `UPDATE assessment_time_options
          SET is_confirmed = TRUE
        WHERE id = $1
        RETURNING *`,
      [option.id],
    );

    confirmedOption = confirmed[0];

    // Remaining options are no longer available to the observer.
    // Attempting to confirm one later fails the permission check with 403.
    await client.query(
      `UPDATE assessment_time_options
          SET offered_to_teacher_id = NULL
        WHERE assessment_id = $1
          AND id <> $2
          AND NOT is_confirmed`,
      [option.assessment_id, option.id],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  res.json(toOption(confirmedOption));
});

export default router;

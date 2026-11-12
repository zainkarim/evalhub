import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../db/pool.js';
import { findTeacherConflict } from '../lib/availability.js';
import { lockInDate } from '../lib/scheduling.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';
import { getObserverCapacity } from '../lib/observerCapacity.js';

const router = Router();

const toOption = (r) => ({
  id: r.id,
  assessmentId: r.assessment_id,
  proposedDate: r.proposed_date,
  startTime: r.start_time ? r.start_time.slice(0, 5) : null,
  endTime: r.end_time ? r.end_time.slice(0, 5) : null,
  offeredToTeacherId: r.offered_to_teacher_id,
  confirmedTeacherId: r.confirmed_teacher_id,
  isConfirmed: r.is_confirmed,
});

const toOffer = (r) => ({
  id: r.id,
  optionId: r.option_id,
  teacherId: r.teacher_id,
  status: r.status,
});

// POST /api/time-options/offers/:id/respond   (the observer this offer was sent to)
// Fix #6's observer-side half: an observer can now be offered a date by
// several observees/assessments in parallel, each via its own offer row in
// time_option_offers (migration 006). Responding 'accepted' is NOT final --
// it just tells the observee "I could do this one." The observee is the one
// who locks a date in, via POST /api/assessments/:id/time-options/:optionId/finalize,
// which is what used to happen here directly under the old one-observer model.
const respondBody = z.object({ status: z.enum(['accepted', 'declined']) });
router.post(
  '/offers/:id/respond',
  validate(idParams, 'params'),
  validate(respondBody),
  async (req, res) => {
    const client = await pool.connect();
    let updated;

    try {
      await client.query('BEGIN');

      // Lock the assessment first, consistently with sign-off.
      const { rows: assessments } = await client.query(
        `SELECT a.*
         FROM assessments a
         JOIN assessment_time_options t ON t.assessment_id = a.id
         JOIN time_option_offers f ON f.option_id = t.id
         WHERE f.id = $1
         FOR UPDATE OF a`,
        [req.valid.params.id],
      );
      const assessment = assessments[0];
      if (!assessment) throw notFound('Offer');

      const { rows: offers } = await client.query(
        'SELECT * FROM time_option_offers WHERE id = $1',
        [req.valid.params.id],
      );
      const offer = offers[0];
      if (!offer) throw notFound('Offer');

      if (offer.teacher_id !== req.user.teacherId) {
        throw new HttpError(403, 'forbidden', 'This offer was not sent to you');
      }

      // All capacity-increasing paths must use this same observer lock.
      await client.query(
        'SELECT id FROM teachers WHERE id = $1 FOR UPDATE',
        [offer.teacher_id],
      );

      const { rows: options } = await client.query(
        'SELECT * FROM assessment_time_options WHERE id = $1',
        [offer.option_id],
      );
      const option = options[0];
      if (!option) throw notFound('Time option');

      const { rows: confirmed } = await client.query(
        `SELECT id FROM assessment_time_options
         WHERE assessment_id = $1 AND is_confirmed`,
        [assessment.id],
      );
      if (confirmed.length) {
        throw new HttpError(
          409, 'conflict', 'This assessment already has a confirmed date',
        );
      }

      if (req.valid.body.status === 'accepted') {
        if (['completed', 'cancelled', 'not_eligible'].includes(assessment.status)) {
          throw new HttpError(
            409, 'conflict', 'This assessment is no longer open for scheduling',
          );
        }

        const capacity = await getObserverCapacity(
          client,
          offer.teacher_id,
          assessment.due_term_id,
          assessment.id,
        );

        if (!capacity.alreadyReserved && capacity.used >= capacity.limit) {
          throw new HttpError(
            409,
            'observer_capacity_reached',
            'You have reached the limit of 3 observations for this semester',
            { termId: assessment.due_term_id, ...capacity },
          );
        }

        const conflict = await findTeacherConflict(
          offer.teacher_id,
          option.proposed_date,
          option.start_time.slice(0, 5),
          option.end_time.slice(0, 5),
          client,
        );
        if (conflict) {
          throw new HttpError(
            409, 'conflict', `You are not free at that time: ${conflict.detail}`,
          );
        }
      }

      const { rows } = await client.query(
        `UPDATE time_option_offers
         SET status = $2, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [offer.id, req.valid.body.status],
      );
      updated = rows[0];

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json(toOffer(updated));
  },
);

// POST /api/time-options/:id/confirm   (an observer this option was offered to)
// The observer picks one of the observee's proposed dates and it is locked in
// at once (requirements §4.3 step 5; the frontend's one-observer flow). Works
// for offers sent through time_option_offers (migration 006) and for older
// batches that used offered_to_teacher_id. The multi-offer alternative, where
// the observee picks among accepted offers, is
// POST /api/assessments/:id/time-options/:optionId/finalize. Both end in
// lockInDate (src/lib/scheduling.js).
router.post('/:id/confirm', validate(idParams, 'params'), async (req, res) => {
  const client = await pool.connect();
  let updated;

  try {
    await client.query('BEGIN');

    const { rows: assessments } = await client.query(
      `SELECT a.*
       FROM assessments a
       JOIN assessment_time_options t ON t.assessment_id = a.id
       WHERE t.id = $1
       FOR UPDATE OF a`,
      [req.valid.params.id],
    );
    const assessment = assessments[0];
    if (!assessment) throw notFound('Time option');

    const { rows: options } = await client.query(
      'SELECT * FROM assessment_time_options WHERE id = $1',
      [req.valid.params.id],
    );
    const option = options[0];
    if (!option) throw notFound('Time option');

    const observerId = req.user.teacherId;
    const { rows: offerRows } = await client.query(
      `SELECT 1 FROM time_option_offers
       WHERE option_id = $1 AND teacher_id = $2 AND status <> 'declined'`,
      [option.id, observerId],
    );
    if (observerId == null
        || (option.offered_to_teacher_id !== observerId && offerRows.length === 0)) {
      throw new HttpError(403, 'forbidden', 'This option was not offered to you');
    }

    await client.query(
      'SELECT id FROM teachers WHERE id = $1 FOR UPDATE',
      [observerId],
    );

    if (['completed', 'cancelled', 'not_eligible'].includes(assessment.status)) {
      throw new HttpError(
        409, 'conflict', 'This assessment is no longer open for scheduling',
      );
    }

    const { rows: existing } = await client.query(
      `SELECT id FROM assessment_time_options
       WHERE assessment_id = $1 AND is_confirmed`,
      [assessment.id],
    );
    if (existing.length) {
      throw new HttpError(
        409, 'conflict', 'This assessment already has a confirmed date',
      );
    }

    const capacity = await getObserverCapacity(
      client,
      observerId,
      assessment.due_term_id,
      assessment.id,
    );

    if (!capacity.alreadyReserved && capacity.used >= capacity.limit) {
      throw new HttpError(
        409,
        'observer_capacity_reached',
        'You have reached the limit of 3 observations for this semester',
        { termId: assessment.due_term_id, ...capacity },
      );
    }

    const proposedDate = option.proposed_date;
    const startTime = option.start_time.slice(0, 5);
    const endTime = option.end_time.slice(0, 5);

    const observerConflict = await findTeacherConflict(
      observerId,
      proposedDate,
      startTime,
      endTime,
      client,
    );
    if (observerConflict) {
      throw new HttpError(
        409, 'conflict',
        `You are no longer free at that time: ${observerConflict.detail}`,
      );
    }

    const observeeConflict = await findTeacherConflict(
      assessment.teacher_id,
      proposedDate,
      startTime,
      endTime,
      client,
    );
    if (observeeConflict) {
      throw new HttpError(
        409, 'conflict',
        `The observee is no longer free at that time: ${observeeConflict.detail}`,
      );
    }

    ({ option: updated } = await lockInDate(client, {
      assessment,
      option,
      observerId: observerId,
    }));

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(toOption(updated));
});

export default router;

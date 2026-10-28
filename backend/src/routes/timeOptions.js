import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../db/pool.js';
import { findTeacherConflict } from '../lib/availability.js';
import { lockInDate } from '../lib/scheduling.js';
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
router.post('/offers/:id/respond', validate(idParams, 'params'), validate(respondBody), async (req, res) => {
  const { rows } = await query('SELECT * FROM time_option_offers WHERE id = $1', [req.valid.params.id]);
  const offer = rows[0];
  if (!offer) throw notFound('Offer');

  if (offer.teacher_id !== req.user.teacherId) {
    throw new HttpError(403, 'forbidden', 'This offer was not sent to you');
  }

  const { rows: optionRows } = await query('SELECT * FROM assessment_time_options WHERE id = $1', [offer.option_id]);
  if (optionRows[0]?.is_confirmed) {
    throw new HttpError(409, 'conflict', 'This assessment already has a confirmed date');
  }

  // Accepting is a real commitment-in-waiting, so re-verify the observer is
  // actually free for it right now (not just at send time).
  if (req.valid.body.status === 'accepted') {
    const option = optionRows[0];
    const conflict = await findTeacherConflict(
      req.user.teacherId,
      option.proposed_date,
      option.start_time.slice(0, 5),
      option.end_time.slice(0, 5),
    );
    if (conflict) {
      throw new HttpError(409, 'conflict', `You are not free at that time: ${conflict.detail}`);
    }
  }

  const { rows: updated } = await query(
    `UPDATE time_option_offers SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [offer.id, req.valid.body.status],
  );

  res.json(toOffer(updated[0]));
});

// POST /api/time-options/:id/confirm   (an observer this option was offered to)
// The observer picks one of the observee's proposed dates and it is locked in
// at once (requirements §4.3 step 5; the frontend's one-observer flow). Works
// for offers sent through time_option_offers (migration 006) and for older
// batches that used offered_to_teacher_id. The multi-offer alternative, where
// the observee picks among accepted offers, is
// POST /api/assessments/:id/time-options/:optionId/finalize. Both end in
// lockInDate (src/lib/scheduling.js).
router.post('/:id/confirm', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query('SELECT * FROM assessment_time_options WHERE id = $1', [req.valid.params.id]);
  const option = rows[0];
  if (!option) throw notFound('Time option');

  const { rows: offerRows } = await query(
    `SELECT 1 FROM time_option_offers WHERE option_id = $1 AND teacher_id = $2 AND status <> 'declined'`,
    [option.id, req.user.teacherId],
  );
  const offeredToMe = req.user.teacherId != null
    && (option.offered_to_teacher_id === req.user.teacherId || offerRows.length > 0);
  if (!offeredToMe) {
    throw new HttpError(403, 'forbidden', 'This option was not offered to you');
  }
  if (option.is_confirmed) {
    throw new HttpError(409, 'conflict', 'This option is already confirmed');
  }

  // Defensive re-check (fix #4): time may have passed since this option was
  // sent -- a new section could have been added to this observer's schedule,
  // or (once fix #6's multi-observer flow is in) the observee could have
  // already confirmed a different observer's slot on the same day. Re-verify
  // both sides are still free right before locking this one in.
  const { rows: assessmentRows } = await query(
    'SELECT teacher_id FROM assessments WHERE id = $1',
    [option.assessment_id],
  );
  const observeeId = assessmentRows[0]?.teacher_id;
  const proposedDate = option.proposed_date;
  const startTime = option.start_time.slice(0, 5);
  const endTime = option.end_time.slice(0, 5);

  const observerConflict = await findTeacherConflict(req.user.teacherId, proposedDate, startTime, endTime);
  if (observerConflict) {
    throw new HttpError(409, 'conflict', `You are no longer free at that time: ${observerConflict.detail}`);
  }
  if (observeeId) {
    const observeeConflict = await findTeacherConflict(observeeId, proposedDate, startTime, endTime);
    if (observeeConflict) {
      throw new HttpError(409, 'conflict', `The observee is no longer free at that time: ${observeeConflict.detail}`);
    }
  }

  // Confirm it, decline the competing offers, and write the observer and date
  // to the observation in one transaction (#57).
  const client = await pool.connect();
  let confirmed;
  try {
    await client.query('BEGIN');
    const { rows: locked } = await client.query('SELECT * FROM assessments WHERE id = $1 FOR UPDATE', [option.assessment_id]);
    if (['completed', 'cancelled', 'not_eligible'].includes(locked[0].status)) {
      throw new HttpError(409, 'conflict', 'This assessment is no longer open for scheduling');
    }
    ({ option: confirmed } = await lockInDate(client, { assessment: locked[0], option, observerId: req.user.teacherId }));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(toOption(confirmed));
});

export default router;

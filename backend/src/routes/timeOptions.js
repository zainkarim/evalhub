import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { findTeacherConflict } from '../lib/availability.js';
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

// POST /api/time-options/:id/confirm   (legacy -- the observer this option was
// offered to, pre-fix-#6 single-observer model via offered_to_teacher_id)
// Kept for any batches sent before migration 006 (new sends no longer set
// offered_to_teacher_id -- see assessments.js's /time-options/send). New
// scheduling goes through POST /offers/:id/respond + the observee's
// /assessments/:id/time-options/:optionId/finalize instead.
router.post('/:id/confirm', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query('SELECT * FROM assessment_time_options WHERE id = $1', [req.valid.params.id]);
  const option = rows[0];
  if (!option) throw notFound('Time option');

  if (option.offered_to_teacher_id !== req.user.teacherId) {
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

  const { rows: confirmed } = await query(
    'UPDATE assessment_time_options SET is_confirmed = TRUE WHERE id = $1 RETURNING *',
    [option.id],
  );
  // Any sibling options that were offered alongside this one become moot —
  // clear their offered_to_teacher_id so a stale confirm attempt on them 404s
  // cleanly (via the forbidden check above) instead of silently double-booking.
  await query(
    'UPDATE assessment_time_options SET offered_to_teacher_id = NULL WHERE assessment_id = $1 AND id <> $2 AND NOT is_confirmed',
    [option.assessment_id, option.id],
  );

  res.json(toOption(confirmed[0]));
});

export default router;

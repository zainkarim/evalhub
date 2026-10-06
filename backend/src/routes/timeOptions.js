import { Router } from 'express';
import { query } from '../db/pool.js';
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

// POST /api/time-options/:id/confirm   (the observer this option was offered to)
// The one place "the observer confirms one of the proposed dates" (requirements.md
// §4.3 step 5) actually happens. Only the teacher the option was offered to can
// confirm it — not the observee, not any other teacher. The partial unique index
// on (assessment_id) WHERE is_confirmed guarantees only one option per assessment
// can ever end up confirmed, even under a race between two requests.
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

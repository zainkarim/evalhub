import { HttpError } from '../middleware/errors.js';

// Locks one proposed date in for an assessment (#57). Both ways a date gets
// chosen end here: the observer confirming it (POST /time-options/:id/confirm)
// and the observee finalizing an accepted offer
// (POST /assessments/:id/time-options/:optionId/finalize).
//
// Must run inside a transaction on `client`, after the caller has locked the
// assessment row (SELECT ... FOR UPDATE), and takes that locked row, so the
// status check below sees the current status. In one step it:
//   0. refuses a closed sign-up (postponed stays open: it can be rescheduled)
//   1. confirms the option for this observer
//   2. declines every other offer on this assessment, including other
//      observers' offers on this same option (#78)
//   3. writes the observer and date to the current observation, creating it
//      when none is active (the multi-offer flow never created one), so
//      sign-off has a scheduled date to check
//   4. marks the assessment approved (scheduled)
export async function lockInDate(client, { assessment, option, observerId }) {
  if (['completed', 'cancelled', 'not_eligible'].includes(assessment.status)) {
    throw new HttpError(409, 'conflict', 'This assessment is no longer open for scheduling');
  }

  if (option.released_at) {
    throw new HttpError(
      409, 'conflict',
      'This date was released when the sign-up was postponed. Propose a new date.',
    );
  }

  const { rows: confirmedRows } = await client.query(
    `UPDATE assessment_time_options
        SET is_confirmed = TRUE, confirmed_teacher_id = $2
      WHERE id = $1 AND NOT is_confirmed AND released_at IS NULL
      RETURNING *`,
    [option.id, observerId],
  );
  if (!confirmedRows[0]) {
    throw new HttpError(409, 'conflict', 'This assessment already has a confirmed date');
  }

  await client.query(
    `UPDATE time_option_offers
        SET status = 'declined', updated_at = now()
      WHERE option_id IN (SELECT id FROM assessment_time_options WHERE assessment_id = $1)
        AND NOT (option_id = $2 AND teacher_id = $3)
        AND status <> 'declined'`,
    [assessment.id, option.id, observerId],
  );
  await client.query(
    `UPDATE time_option_offers
        SET status = 'accepted', updated_at = now()
      WHERE option_id = $1 AND teacher_id = $2 AND status <> 'accepted'`,
    [option.id, observerId],
  );
  // Legacy single-observer column: stale options can no longer be confirmed.
  await client.query(
    `UPDATE assessment_time_options SET offered_to_teacher_id = NULL
      WHERE assessment_id = $1 AND id <> $2 AND NOT is_confirmed`,
    [assessment.id, option.id],
  );

  // The active attempt, if the observer was already chosen through
  // POST /assessments/:id/observations. Postponed and finished attempts stay
  // as they are; a new attempt is created instead.
  const { rows: activeRows } = await client.query(
    `SELECT * FROM observations
      WHERE assessment_id = $1 AND status IN ('proposed', 'approved')
      ORDER BY attempt_no DESC
      LIMIT 1
      FOR UPDATE`,
    [assessment.id],
  );
  const active = activeRows[0];

  let observation;
  if (active) {
    if (active.observer_id !== observerId) {
      throw new HttpError(
        409, 'conflict',
        'A different observer is already selected for this sign-up',
        { observerId: active.observer_id },
      );
    }
    const { rows } = await client.query(
      `UPDATE observations SET scheduled_date = $2, status = 'approved'
        WHERE id = $1 RETURNING *`,
      [active.id, option.proposed_date],
    );
    observation = rows[0];
  } else {
    const { rows: listRows } = await client.query(
      `SELECT id FROM candidate_lists WHERE assessment_id = $1 ORDER BY id DESC LIMIT 1`,
      [assessment.id],
    );
    const { rows } = await client.query(
      `INSERT INTO observations
         (assessment_id, observee_id, observer_id, attempt_no, source_list_id, is_ac_stepin, status, scheduled_date)
       SELECT $1, $2, $3, COALESCE(MAX(attempt_no), 0) + 1, $4, FALSE, 'approved', $5
         FROM observations WHERE assessment_id = $1
       RETURNING *`,
      [assessment.id, assessment.teacher_id, observerId, listRows[0]?.id ?? null, option.proposed_date],
    );
    observation = rows[0];
  }

  await client.query(
    `UPDATE assessments SET status = 'approved' WHERE id = $1 AND status <> 'approved'`,
    [assessment.id],
  );

  return { option: confirmedRows[0], observation };
}

// Postpones a sign-up (#134, workflow step 8: never delete, mark Postponed,
// log who, when and why). Must run inside a transaction on `client`, after the
// caller has locked the assessment row. In one step it:
//   1. marks the active attempt (proposed/approved observation) postponed,
//      keeping its observer and scheduled date on record
//   2. releases the confirmed date (is_confirmed -> FALSE, released_at set),
//      so the one-confirmed-date index lets a new date be confirmed
//   3. closes open offers, logged as withdrawn with the postponement reason
//   4. logs the attempt in cancellation_attempts, linked to the closed attempt
//   5. marks the sign-up postponed
// A new attempt is created by lockInDate when a new date is confirmed, with
// the same observer or a different one.
export async function postponeSignUp(client, assessment, { userId, reason, notes = null }) {
  if (['completed', 'cancelled'].includes(assessment.status)) {
    throw new HttpError(409, 'conflict', 'This assessment is already finished and cannot be postponed');
  }

  const { rows: closedObservations } = await client.query(
    `UPDATE observations SET status = 'postponed'
      WHERE assessment_id = $1 AND status IN ('proposed', 'approved')
      RETURNING id`,
    [assessment.id],
  );

  await client.query(
    `UPDATE assessment_time_options
        SET is_confirmed = FALSE, released_at = now()
      WHERE assessment_id = $1 AND is_confirmed`,
    [assessment.id],
  );

  await client.query(
    `WITH closed AS (
       UPDATE time_option_offers f
          SET status = 'declined', updated_at = now()
         FROM assessment_time_options t
        WHERE t.id = f.option_id
          AND t.assessment_id = $1
          AND f.status IN ('pending', 'accepted')
        RETURNING f.id
     )
     INSERT INTO time_option_offer_actions (offer_id, actor_user_id, action, reason)
     SELECT id, $2, 'withdrawn', 'Sign-up postponed' FROM closed`,
    [assessment.id, userId],
  );

  await client.query(
    `INSERT INTO cancellation_attempts (assessment_id, requested_by, reason, notes, observation_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [assessment.id, userId, reason, notes, closedObservations[0]?.id ?? null],
  );

  const { rows } = await client.query(
    `UPDATE assessments
        SET status = 'postponed',
            notes = COALESCE($2, notes)
      WHERE id = $1
      RETURNING *`,
    [assessment.id, notes],
  );
  return { assessment: rows[0], observationId: closedObservations[0]?.id ?? null };
}

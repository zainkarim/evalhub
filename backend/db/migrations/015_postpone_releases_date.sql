-- #134: postponing a sign-up that already had a confirmed date.
--
-- The partial unique index assessment_time_options_one_confirmed_idx allows one
-- confirmed date per sign-up, so a postponed sign-up whose old date stayed
-- confirmed could never be rescheduled. Postponing now releases that date:
-- is_confirmed goes back to FALSE and released_at records when. The row (and
-- confirmed_teacher_id, who was booked) is kept, never deleted, and a released
-- date can't be confirmed or sent again.
ALTER TABLE assessment_time_options ADD COLUMN released_at TIMESTAMPTZ;

-- Which attempt a postponement closed, when it closed one. NULL when the
-- sign-up had no active attempt (for example, postponed before scheduling).
ALTER TABLE cancellation_attempts
  ADD COLUMN observation_id INT REFERENCES observations (id) ON DELETE SET NULL;

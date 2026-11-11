-- View-only roles for the Department Head and the Annual Review Committee
-- (requirements §3, §4.3 step 10, §4.6). Both get read-only access to
-- completed observation records and take no part in the workflow: they never
-- sign up, observe, sign off, or appear as an observer candidate.
--
--   dept_head      -> Department Head
--   annual_review  -> Annual Review Committee member
--
-- Numbered 012 because PR #121 claims 011. migrate.js tracks applied files by
-- name, so the two apply correctly whichever merges first.

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('faculty', 'ac_member', 'admin', 'dept_head', 'annual_review'));

-- A view-only account is not a teacher login. If it were linked to a teacher
-- profile, the teacher-id checks on sign-up, responses and sign-off would let
-- it act as that professor.
ALTER TABLE users ADD CONSTRAINT users_view_only_no_teacher
  CHECK (role NOT IN ('dept_head', 'annual_review') OR teacher_id IS NULL);

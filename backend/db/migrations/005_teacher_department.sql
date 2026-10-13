-- Observer matching: department, not school (professor correction, 10/13 —
-- see docs/weekly-report or the team's testing-walkthrough doc for context).
--
-- UTD's schools each contain several distinct departments -- e.g. the Erik
-- Jonsson School of Engineering and Computer Science (ECS) contains six:
-- Bioengineering, Computer Science, Electrical Engineering, Materials
-- Science and Engineering, Mechanical Engineering, and Systems Engineering.
-- (catalog.utdallas.edu/2026/graduate/programs/ecs). Matching observers by
-- teachers.school alone (the only field that existed before this migration)
-- could pair, say, a Computer Science observee with an Electrical
-- Engineering observer, because both are "ECS" -- same school, wrong
-- department. This migration adds the missing finer-grained field.
--
-- courses.subject (e.g. 'CS') already functions as a department-level course
-- prefix, so no change is needed on the courses side -- only teachers lacked
-- this granularity.

ALTER TABLE teachers ADD COLUMN department TEXT;

-- Backfill: each teacher's department is the subject they've taught most
-- often (course_sections -> courses.subject), which is the only signal this
-- database actually has for "what department is this person in." A teacher
-- with no teaching history yet (brand new hire, no sections seeded) falls
-- back to their school code so the column can still be made NOT NULL below
-- -- that's a placeholder, not a real department, and should be corrected
-- by hand (or at next sign-up) once real data exists for them.
WITH most_taught_subject AS (
  SELECT DISTINCT ON (cs.teacher_id)
         cs.teacher_id,
         c.subject
    FROM course_sections cs
    JOIN courses c ON c.id = cs.course_id
   WHERE cs.teacher_id IS NOT NULL
   GROUP BY cs.teacher_id, c.subject
   ORDER BY cs.teacher_id, count(*) DESC
)
UPDATE teachers t
   SET department = COALESCE(mts.subject, t.school)
  FROM most_taught_subject mts
 WHERE mts.teacher_id = t.id;

UPDATE teachers SET department = school WHERE department IS NULL;

ALTER TABLE teachers ALTER COLUMN department SET NOT NULL;

CREATE INDEX teachers_department_idx ON teachers (department) WHERE is_active;

COMMENT ON COLUMN teachers.department IS
  'Department-level course prefix (e.g. CS, EE) -- the actual observer-matching key per the professor''s 10/13 correction. Distinct from school (e.g. ECS), which is too coarse: one school contains several departments.';

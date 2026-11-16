-- Reference query for observer matching, used by POST /assessments/:id/candidates
-- and the AC-override check inside POST /assessments/:id/observations.
--
-- CHANGED 2026-10-13 (professor correction, see docs/testing walkthrough):
-- matching key switched from school to department. A school (e.g. ECS, the
-- Erik Jonsson School of Engineering and Computer Science) contains several
-- distinct departments (Computer Science, Electrical Engineering, Mechanical
-- Engineering, ...), so school-only matching could pair a CS observee with
-- an EE observer -- same school, wrong department. teachers.department
-- (migration 005) is now the matching key on the teacher side; courses.subject
-- (e.g. 'CS') already served this purpose on the course side and is unchanged.
--
-- Both callers pass:
-- [observee_id, department, course_level, date, limit, lookbackYears,
--  due_term_id, observerCapacity]
-- The commitments CTE is supplied from observerCapacity.js so candidate
-- filtering and offer acceptance use the same reservation rules.
--
-- Rules, per Q&A 8 and 15, department correction 10/13:
--   - match by course level (first digit of course number), not focus area
--   - observer has to be in the same DEPARTMENT as the observee's section
--     (not just the same school -- see above)
--   - observer has to have taught that level, in that department, within the
--     lookback window (app_settings.observer_lookback_years, default 2 years)
--   - return exactly 5 candidates if that many qualify; random pick if
--     more than 5 do
--   - if fewer than 5 qualify (new hire, small department, etc.) just
--     return what's there. if the pool is completely empty, don't call
--     this at all -- an AC member steps in instead
--     (observations.is_ac_stepin = true, source_list_id = NULL)
--
-- KNOWN SEPARATE GAP (not fixed here, flagging for whoever picks it up):
-- requirements.md §4.2 "Observer Pool mechanic" says the eligible pool
-- should be restricted to teachers who signed up as an observee THIS
-- cycle, not the full historical roster matching department+level+recency.
-- This query still pulls from the full roster. Not a crash, just broader
-- than spec -- worth fixing, just not urgent tonight.
--
-- $1 observee teacher id (to exclude self)
-- $2 target department
-- $3 target course level
-- $4 as-of date
-- $5 list size / limit
-- $6 lookback years
-- $7 assessment due_term_id (working definition of cycle)
-- $8 maximum assignments per observer per cycle
WITH commitments AS (
  /* OBSERVER_COMMITMENTS_SQL */
),
capacity AS (
  SELECT observer_id, COUNT(*)::int AS used
  FROM commitments
  WHERE due_term_id = $7::int
  GROUP BY observer_id
),
pool AS (
  SELECT DISTINCT t.id, t.first_name, t.last_name, t.email
  FROM teachers t
  JOIN course_sections cs ON cs.teacher_id = t.id
  JOIN courses c          ON c.id = cs.course_id
  JOIN terms tm           ON tm.id = cs.term_id
  LEFT JOIN capacity cap ON cap.observer_id = t.id
  WHERE t.is_active
    AND t.id <> $1
    AND t.department = $2
    AND c.subject = $2
    AND c.course_level = $3
    AND tm.start_date <= $4::date
    AND tm.end_date >= ($4::date - make_interval(years => $6::int))
    AND COALESCE(cap.used, 0) < $8::int
)
SELECT p.id, p.first_name, p.last_name, p.email,
       (SELECT count(*) FROM pool)::int AS pool_size
FROM pool p
ORDER BY random()
LIMIT $5::int;

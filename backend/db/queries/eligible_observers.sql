-- Reference query for observer matching, used by POST /assessments/:id/candidates
-- and the AC-override check inside POST /assessments/:id/observations.
--
-- FIXED 2026-10-06: placeholders renumbered to match how assessments.js
-- actually calls this (6 positional args, not 7 -- the original version of
-- this file had a leftover unused $1 and referenced $7, which meant every
-- real call to this query failed with "bind message supplies 6 parameters,
-- but prepared statement requires 7". Both call sites in assessments.js
-- pass [observee_id, school, course_level, date, limit, lookbackYears] in
-- that order -- this file now matches that exactly.
--
-- Rules, per Q&A 8 and 15:
--   - match by course level (first digit of course number), not focus area
--   - observer has to be in the same school as the observee's section
--   - observer has to have taught that level, in that school, within the
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
-- cycle, not the full historical roster matching school+level+recency.
-- This query still pulls from the full roster. Not a crash, just broader
-- than spec -- worth fixing, just not urgent tonight.
--
-- $1 observee teacher id (to exclude self)
-- $2 target school (school of the section being observed)
-- $3 target course level
-- $4 as-of date (usually CURRENT_DATE)
-- $5 list size / limit (app_settings.candidate_list_size)
-- $6 lookback years (app_settings.observer_lookback_years)
WITH pool AS (
  SELECT DISTINCT t.id, t.first_name, t.last_name, t.email
  FROM teachers t
  JOIN course_sections cs ON cs.teacher_id = t.id
  JOIN courses c          ON c.id = cs.course_id
  JOIN terms tm           ON tm.id = cs.term_id
  WHERE t.is_active
    AND t.id <> $1
    AND t.school = $2
    AND c.school = $2
    AND c.course_level = $3
    AND tm.start_date <= $4::date
    AND tm.end_date   >= ($4::date - make_interval(years => $6::int))
)
SELECT p.id, p.first_name, p.last_name, p.email,
       (SELECT count(*) FROM pool)::int AS pool_size
FROM pool p
ORDER BY random()
LIMIT $5::int;

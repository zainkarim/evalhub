-- =====================================================================
-- Observer candidate matching — reference query (Sprint 2)
-- NOT run by the migration runner. For whoever builds the "generate
-- candidates" endpoint (POST /assessments/:id/candidates).
--
-- Requirement (Q&A 8, 15):
--   * match by COURSE LEVEL (first digit of course number), not focus area
--   * observer must be in the SAME SCHOOL as the observee's section
--   * observer must have taught that level in that school within the
--     configured lookback window (app_settings.observer_lookback_years, default 2)
--   * return EXACTLY 5 candidates (app_settings.candidate_list_size);
--     random pick if more qualify
--   * fewer than 5 qualify (e.g. new hire) → return what exists; if the
--     pool is empty, the caller should let an AC member step in instead
--     (observations.is_ac_stepin = true, source_list_id = NULL)
--
-- Parameters
--   $1  assessment id                (to exclude the observee and read their section)
--   $2  observee teacher id
--   $3  target school                (school of the section being observed)
--   $4  target course level          (course_level of that section)
--   $5  as-of date                   (usually CURRENT_DATE)
--   $6  list size                    (app_settings.candidate_list_size)
--   $7  lookback years               (app_settings.observer_lookback_years)
-- =====================================================================
WITH pool AS (
  SELECT DISTINCT t.id, t.first_name, t.last_name, t.email
  FROM teachers t
  JOIN course_sections cs ON cs.teacher_id = t.id
  JOIN courses c          ON c.id = cs.course_id
  JOIN terms tm           ON tm.id = cs.term_id
  WHERE t.is_active
    AND t.id <> $2
    AND t.school = $3
    AND c.school = $3
    AND c.course_level = $4
    AND tm.start_date <= $5::date
    AND tm.end_date   >= ($5::date - make_interval(years => $7::int))
)
SELECT p.id, p.first_name, p.last_name, p.email,
       (SELECT count(*) FROM pool)::int AS pool_size
FROM pool p
ORDER BY random()
LIMIT $6::int;

-- Usage sketch for the endpoint that generates candidates:
--   1. Look up the assessment's section -> course -> (school, course_level)
--   2. Run the query above to get up to 5 random candidates + pool_size
--   3. INSERT one candidate_lists row (target_school, target_level, pool_size, list_size)
--   4. INSERT one observer_candidates row per candidate, position 1..N
--   5. UPDATE assessments SET status = 'candidates_generated' WHERE id = $1
--   6. If pool_size = 0, do NOT create a candidate list — surface the
--      new-hire edge case instead so an AC member can step in
--      (observations row with is_ac_stepin = true, source_list_id NULL).

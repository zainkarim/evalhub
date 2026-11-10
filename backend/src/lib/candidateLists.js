import { readFileSync } from 'node:fs';
import { query } from '../db/pool.js';

const eligibleObserversSql = readFileSync(
  new URL('../../db/queries/eligible_observers.sql', import.meta.url),
  'utf8',
);

export const latestCandidateList = async (assessmentId) => {
  const { rows } = await query(
    `SELECT * FROM candidate_lists WHERE assessment_id = $1
      ORDER BY generated_at DESC, id DESC LIMIT 1`,
    [assessmentId],
  );
  return rows[0] ?? null;
};

// Runs the matching query for one sign-up without saving anything: the
// observer pool for its section (same department, same course level, taught
// it within the lookback window), and up to candidate_list_size of them.
export async function findEligibleObservers(assessment) {
  const { rows: sectionRows } = await query(
    `SELECT cs.teacher_id AS observee_id, c.subject, c.course_level
       FROM course_sections cs
       JOIN courses c ON c.id = cs.course_id
      WHERE cs.id = $1`,
    [assessment.section_id],
  );
  const section = sectionRows[0];
  if (!section) return null;

  const { rows: settingRows } = await query(
    `SELECT key, value FROM app_settings
      WHERE key IN ('candidate_list_size', 'observer_lookback_years')`,
  );
  const setting = (key, fallback) =>
    Number(settingRows.find((row) => row.key === key)?.value ?? fallback);

  const fullListSize = setting('candidate_list_size', 5);

  const { rows: candidates } = await query(eligibleObserversSql, [
    section.observee_id,
    section.subject,
    section.course_level,
    new Date().toISOString().slice(0, 10),
    fullListSize,
    setting('observer_lookback_years', 2),
  ]);

  return {
    section,
    candidates,
    fullListSize,
    poolSize: candidates.length > 0 ? Number(candidates[0].pool_size) : 0,
  };
}

// Saves the result of findEligibleObservers as the sign-up's newest candidate
// list. An empty pool is saved too (a 0/0 list), so the committee alert and the
// unmatched-faculty / list-sufficiency KPIs can see it. The sign-up only moves
// on to 'candidates_generated' when the list has somebody on it.
export async function saveCandidateList(assessment, matching, actingUserId) {
  const { section, candidates, poolSize } = matching;
  const { rows: listRows } = await query(
    `INSERT INTO candidate_lists
       (assessment_id, target_level, target_school, pool_size, list_size, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [assessment.id, section.course_level, section.subject, poolSize, candidates.length, actingUserId],
  );
  const list = listRows[0];

  for (let i = 0; i < candidates.length; i += 1) {
    await query(
      'INSERT INTO observer_candidates (list_id, teacher_id, position) VALUES ($1, $2, $3)',
      [list.id, candidates[i].id, i + 1],
    );
  }
  if (candidates.length > 0) {
    await query(`UPDATE assessments SET status = 'candidates_generated' WHERE id = $1`, [assessment.id]);
  }
  return list;
}

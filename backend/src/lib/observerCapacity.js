// Issue #70 policy:
// - cycle = assessments.due_term_id
// - accepted offers reserve capacity
// - confirmed and completed assignments retain capacity
// - one slot per observer + assessment, regardless of date options
export const OBSERVER_CAPACITY = 3;

export const observerCommitmentsSql = `
  SELECT f.teacher_id AS observer_id,
         a.id AS assessment_id,
         a.due_term_id
  FROM time_option_offers f
  JOIN assessment_time_options t ON t.id = f.option_id
  JOIN assessments a ON a.id = t.assessment_id
  WHERE f.status = 'accepted'

  UNION

  SELECT COALESCE(t.confirmed_teacher_id, t.offered_to_teacher_id)
           AS observer_id,
         a.id AS assessment_id,
         a.due_term_id
  FROM assessment_time_options t
  JOIN assessments a ON a.id = t.assessment_id
  WHERE t.is_confirmed
    AND COALESCE(t.confirmed_teacher_id, t.offered_to_teacher_id)
        IS NOT NULL

  UNION

  SELECT o.observer_id,
         a.id AS assessment_id,
         a.due_term_id
  FROM observations o
  JOIN assessments a ON a.id = o.assessment_id
  WHERE o.status = 'completed'
`;

export async function getObserverCapacity(
  db,
  observerId,
  termId,
  assessmentId,
) {
  const { rows } = await db.query(
    `WITH commitments AS (${observerCommitmentsSql})
     SELECT COUNT(*)::int AS used,
            COALESCE(BOOL_OR(assessment_id = $3), FALSE)
              AS already_reserved
     FROM commitments
     WHERE observer_id = $1 AND due_term_id = $2`,
    [observerId, termId, assessmentId],
  );

  return {
    used: rows[0].used,
    alreadyReserved: rows[0].already_reserved,
    limit: OBSERVER_CAPACITY,
  };
}
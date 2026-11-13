-- #103: Allow one survey per teacher each term.
-- Keep the old feedback data.

ALTER TABLE process_feedback
  ADD COLUMN term_id INT REFERENCES terms (id) ON DELETE RESTRICT,
  ADD COLUMN feedback TEXT,
  ADD COLUMN suggestions TEXT;

-- Add term ID to old feedback records.
UPDATE process_feedback pf
SET term_id = a.due_term_id
FROM observations o
JOIN assessments a ON a.id = o.assessment_id
WHERE pf.observation_id = o.id;

-- New surveys do not need observation ID.
ALTER TABLE process_feedback
  ALTER COLUMN observation_id DROP NOT NULL;

-- Each feedback needs an observation ID or term ID.
ALTER TABLE process_feedback
  ADD CONSTRAINT process_feedback_term_submission_check
  CHECK (observation_id IS NOT NULL OR term_id IS NOT NULL);

-- One survey per teacher per term.
CREATE UNIQUE INDEX process_feedback_one_survey_per_term_idx
  ON process_feedback (respondent_id, term_id)
  WHERE observation_id IS NULL;

-- Make searching by term faster.
CREATE INDEX process_feedback_term_idx
  ON process_feedback (term_id);

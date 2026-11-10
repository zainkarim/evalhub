-- When the committee clicked Start Observer Selection for a term (the one
-- cycle-wide action, POST /terms/:id/start-observer-selection). NULL until then.
ALTER TABLE terms
  ADD COLUMN selection_started_at TIMESTAMPTZ;

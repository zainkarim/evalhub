-- #95: store the written parts of the observation record.
--
-- The observer form (#33, #81) has an "Observation notes" box and sends
-- `notes` with POST /api/observations/:id/responses, and the observee's
-- sign-off has an optional "Your perspective" comment sent with
-- POST /api/observations/:id/sign-off. Until now neither was stored, so both
-- were silently dropped on the real backend (the API even read a missing
-- observee_comment column as null). The professor's process doc has the
-- observer "make notes" in their copy of the template, which both then sign,
-- so this text is part of the signed record.
--
-- NULL = nothing written. Notes up to 5000 characters, the comment up to 2000.
ALTER TABLE observations
  ADD COLUMN observer_notes TEXT
    CHECK (observer_notes IS NULL OR char_length(observer_notes) <= 5000),
  ADD COLUMN observee_comment TEXT
    CHECK (observee_comment IS NULL OR char_length(observee_comment) <= 2000);

-- Each part is final once its author signs off, like the scores (the API
-- already refuses with 409; this keeps the rule in the database too, #102).
CREATE FUNCTION lock_signed_observation_text() RETURNS trigger AS $$
BEGIN
  IF OLD.observer_signed_off_at IS NOT NULL
     AND NEW.observer_notes IS DISTINCT FROM OLD.observer_notes THEN
    RAISE EXCEPTION 'observer notes are final once the observer has signed off (observation %)', OLD.id;
  END IF;
  IF OLD.observee_signed_off_at IS NOT NULL
     AND NEW.observee_comment IS DISTINCT FROM OLD.observee_comment THEN
    RAISE EXCEPTION 'the observee comment is final once the observee has signed off (observation %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER observations_lock_signed_text
  BEFORE UPDATE OF observer_notes, observee_comment ON observations
  FOR EACH ROW EXECUTE FUNCTION lock_signed_observation_text();

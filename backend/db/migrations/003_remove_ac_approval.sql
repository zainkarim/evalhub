-- AC handles override when no eligible observer exists.
-- AC approval is no longer required.
-- Keep 'approved' temporarily for compatibility with the routes.

DO $$
DECLARE
  review_constraint TEXT;
  matching_constraints INT;
BEGIN
  -- Find the old AC-review CHECK without assuming its generated name.
  SELECT count(*)::int, min(c.conname::text)
    INTO matching_constraints, review_constraint
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = 'observations'::regclass
     AND c.contype = 'c'
     AND a.attname = 'ac_reviewed_at';

  IF matching_constraints > 1 THEN
    RAISE EXCEPTION
      'Multiple AC review CHECK constraints found; inspect before migrating';
  ELSIF matching_constraints = 1 THEN
    EXECUTE format(
      'ALTER TABLE observations DROP CONSTRAINT %I',
      review_constraint
    );
  END IF;
END;
$$;
-- ─────────────────────────────────────────────────────────────────
-- Migration: Guarantee unique property codes
-- Run this once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Fix any existing duplicates first (keep the oldest row's code, reassign duplicates)
DO $$
DECLARE
  dup RECORD;
  new_code INT;
  max_code INT;
BEGIN
  SELECT COALESCE(MAX(property_code::int), 1000) INTO max_code
  FROM properties
  WHERE property_code ~ '^[0-9]+$';

  FOR dup IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY property_code ORDER BY created_at ASC) AS rn
      FROM properties
      WHERE property_code IS NOT NULL
    ) t
    WHERE rn > 1
  ) LOOP
    max_code := max_code + 1;
    UPDATE properties SET property_code = max_code::text WHERE id = dup.id;
  END LOOP;
END $$;

-- 2. Add UNIQUE constraint (safe even if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_property_code_unique'
  ) THEN
    ALTER TABLE properties
      ADD CONSTRAINT properties_property_code_unique UNIQUE (property_code);
  END IF;
END $$;

-- 3. Create atomic function that always returns next available code
CREATE OR REPLACE FUNCTION next_property_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_code INT;
BEGIN
  -- Lock to prevent race conditions between concurrent inserts
  PERFORM pg_advisory_xact_lock(hashtext('property_code_gen'));

  SELECT COALESCE(MAX(property_code::int), 1000) + 1
  INTO next_code
  FROM properties
  WHERE property_code ~ '^[0-9]+$';

  -- Ensure result is at least 4 digits
  IF next_code < 1000 THEN
    next_code := 1000;
  END IF;

  RETURN next_code::text;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION next_property_code() TO authenticated;
GRANT EXECUTE ON FUNCTION next_property_code() TO anon;

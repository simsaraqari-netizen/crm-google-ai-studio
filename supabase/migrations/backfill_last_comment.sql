-- ─────────────────────────────────────────────────────────────────
-- Migration: Add last_comment columns then backfill from comments
-- Run this once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Step 1: Add columns if they don't already exist
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS last_comment    text,
  ADD COLUMN IF NOT EXISTS last_comment_at timestamptz;

-- Step 2: Backfill from existing comments
UPDATE properties p
SET
  last_comment    = c.text,
  last_comment_at = c.created_at
FROM (
  SELECT DISTINCT ON (property_id)
    property_id,
    text,
    created_at
  FROM comments
  WHERE is_deleted = false
  ORDER BY property_id, created_at DESC
) c
WHERE p.id = c.property_id;

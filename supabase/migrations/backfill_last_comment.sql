-- ─────────────────────────────────────────────────────────────────
-- Migration: Backfill last_comment and last_comment_at on properties
-- Run this once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

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
WHERE p.id = c.property_id
  AND (p.last_comment IS NULL OR p.last_comment = '');

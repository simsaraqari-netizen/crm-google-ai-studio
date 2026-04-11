-- ─────────────────────────────────────────────────────────────────
-- Migration: Add performance indexes for search and filtering
-- Run this once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Search fields (used in ilike queries)
CREATE INDEX IF NOT EXISTS idx_properties_name        ON properties USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_phone       ON properties USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_phone_2     ON properties USING gin (phone_2 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_details     ON properties USING gin (details gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_code        ON properties (property_code);

-- Filter fields (used in eq queries)
CREATE INDEX IF NOT EXISTS idx_properties_company_id  ON properties (company_id);
CREATE INDEX IF NOT EXISTS idx_properties_status      ON properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_governorate ON properties (governorate);
CREATE INDEX IF NOT EXISTS idx_properties_area        ON properties (area);
CREATE INDEX IF NOT EXISTS idx_properties_type        ON properties (type);
CREATE INDEX IF NOT EXISTS idx_properties_purpose     ON properties (purpose);
CREATE INDEX IF NOT EXISTS idx_properties_is_sold     ON properties (is_sold);
CREATE INDEX IF NOT EXISTS idx_properties_created_at  ON properties (created_at DESC);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_property_id   ON comments (property_id);
CREATE INDEX IF NOT EXISTS idx_comments_is_deleted    ON comments (is_deleted);

-- Favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id      ON favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_property_id  ON favorites (property_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id      ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id   ON notifications (company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON notifications (created_at DESC);

-- Enable trigram extension (required for gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────
-- Migration: Setup properties_media storage bucket + policies
-- Run this once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Create the bucket if it doesn't exist (public = true allows direct URL access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'properties_media',
  'properties_media',
  true,
  52428800, -- 50 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/mov','video/quicktime','video/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- 2. Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Public read properties_media"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload properties_media"   ON storage.objects;
DROP POLICY IF EXISTS "Auth delete properties_media"   ON storage.objects;
DROP POLICY IF EXISTS "Auth update properties_media"   ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload"              ON storage.objects;

-- 3. Anyone can read (view images publicly)
CREATE POLICY "Public read properties_media"
ON storage.objects FOR SELECT
USING (bucket_id = 'properties_media');

-- 4. Authenticated users can upload
CREATE POLICY "Auth upload properties_media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'properties_media');

-- 5. Authenticated users can delete (for removing property images)
CREATE POLICY "Auth delete properties_media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'properties_media');

-- 6. Authenticated users can update
CREATE POLICY "Auth update properties_media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'properties_media');

-- ============================================================
-- Migration: Fix file-tracking-images Storage Bucket Policies
-- AND ensure file_images / file_image columns exist
-- ============================================================

-- 1. Ensure the columns exist on file_tracking_records (safe if already added)
ALTER TABLE public.file_tracking_records
  ADD COLUMN IF NOT EXISTS file_image  TEXT,
  ADD COLUMN IF NOT EXISTS file_images JSONB DEFAULT '[]'::jsonb;

-- Set default for existing rows that have NULL
UPDATE public.file_tracking_records
  SET file_images = '[]'::jsonb
  WHERE file_images IS NULL;

-- 2. Storage policies for 'file-tracking-images' bucket
--    Allows any authenticated user to upload, view, update, and delete
--    their own uploads (or any upload — these are shared dept files).

-- DROP old policies if they exist (idempotent re-run safety)
DROP POLICY IF EXISTS "file_tracking_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "file_tracking_images_select" ON storage.objects;
DROP POLICY IF EXISTS "file_tracking_images_update" ON storage.objects;
DROP POLICY IF EXISTS "file_tracking_images_delete" ON storage.objects;
DROP POLICY IF EXISTS "file_tracking_images_public_select" ON storage.objects;

-- Allow authenticated users to upload files into the bucket
CREATE POLICY "file_tracking_images_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'file-tracking-images');

-- Allow public read (bucket is already public, this ensures anon can view)
CREATE POLICY "file_tracking_images_public_select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'file-tracking-images');

-- Allow authenticated users to update files
CREATE POLICY "file_tracking_images_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'file-tracking-images')
  WITH CHECK (bucket_id = 'file-tracking-images');

-- Allow authenticated users to delete files
CREATE POLICY "file_tracking_images_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'file-tracking-images');

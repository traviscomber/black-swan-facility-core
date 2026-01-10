-- Fix the gis-overlays storage bucket to accept all MIME types for KMZ files
-- KMZ files can be detected as various MIME types (application/zip, application/octet-stream, etc.)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Allow public uploads to gis-overlays bucket" ON storage.objects;

-- Create a new policy that allows uploads without MIME type restrictions
CREATE POLICY "Allow public uploads to gis-overlays bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'gis-overlays'
);

-- Update the bucket to remove MIME type restrictions
UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 52428800
WHERE id = 'gis-overlays';

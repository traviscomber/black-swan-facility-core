-- Create or update storage bucket for GIS overlays

-- First, try to create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gis-overlays',
  'gis-overlays',
  true,
  52428800, -- 50MB
  ARRAY['application/vnd.google-earth.kmz', 'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kml', 'application/zip', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['application/vnd.google-earth.kmz', 'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kml', 'application/zip', 'application/octet-stream']::text[],
  file_size_limit = 52428800,
  public = true;

-- Drop and recreate the storage policy
DROP POLICY IF EXISTS "Allow all operations on gis-overlays" ON storage.objects;

CREATE POLICY "Allow all operations on gis-overlays"
ON storage.objects FOR ALL
USING (bucket_id = 'gis-overlays')
WITH CHECK (bucket_id = 'gis-overlays');

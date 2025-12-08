-- Create Supabase Storage bucket for infrastructure files
-- This bucket will store photos and documents

-- Insert bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('infrastructure-files', 'infrastructure-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'infrastructure-files' );

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'infrastructure-files' );

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'infrastructure-files' );

-- Update schema info
SELECT 'Storage bucket "infrastructure-files" created with public read access' as status;

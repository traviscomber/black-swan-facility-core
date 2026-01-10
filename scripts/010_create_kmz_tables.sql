-- Create kmz_files table for storing KMZ overlay metadata
CREATE TABLE IF NOT EXISTS kmz_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  is_active BOOLEAN DEFAULT true,
  current_version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- Create kmz_file_versions table for version history
CREATE TABLE IF NOT EXISTS kmz_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kmz_id UUID REFERENCES kmz_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE kmz_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE kmz_file_versions ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all on kmz_files" ON kmz_files FOR ALL USING (true);
CREATE POLICY "Allow all on kmz_file_versions" ON kmz_file_versions FOR ALL USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kmz_files_active ON kmz_files(is_active);
CREATE INDEX IF NOT EXISTS idx_kmz_file_versions_kmz_id ON kmz_file_versions(kmz_id);

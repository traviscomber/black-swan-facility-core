-- Create KMZ files management table
CREATE TABLE IF NOT EXISTS kmz_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  current_version INTEGER DEFAULT 1
);

-- Create KMZ file versions table for history tracking
CREATE TABLE IF NOT EXISTS kmz_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kmz_id UUID REFERENCES kmz_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  uploaded_by TEXT,
  notes TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_kmz_files_active ON kmz_files(is_active);
CREATE INDEX IF NOT EXISTS idx_kmz_versions_kmz_id ON kmz_file_versions(kmz_id);
CREATE INDEX IF NOT EXISTS idx_kmz_files_created_by ON kmz_files(created_by);

-- Enable RLS on both tables
ALTER TABLE kmz_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE kmz_file_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all on kmz_files" ON kmz_files
  FOR ALL USING (true);

CREATE POLICY "Allow all on kmz_file_versions" ON kmz_file_versions
  FOR ALL USING (true);

-- Create document versions table to track all changes to infrastructure documents
CREATE TABLE IF NOT EXISTS infrastructure_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES infrastructure_documents(id) ON DELETE CASCADE,
  infrastructure_id UUID REFERENCES infrastructure_plans(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT,
  version_number INTEGER NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON infrastructure_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_infrastructure_id ON infrastructure_document_versions(infrastructure_id);

-- Add version tracking to documents table
ALTER TABLE infrastructure_documents 
ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS version_notes TEXT;

-- Enable RLS on document versions table
ALTER TABLE infrastructure_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on document_versions" ON infrastructure_document_versions
  FOR ALL USING (true);

-- Add new columns to issues table to support enhanced issue tracking
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS issue_type_id UUID REFERENCES issue_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS infrastructure_id UUID REFERENCES infrastructure_plans(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium';

-- Create indexes for better query performance  
CREATE INDEX IF NOT EXISTS idx_issues_issue_type ON issues(issue_type_id);
CREATE INDEX IF NOT EXISTS idx_issues_infrastructure ON issues(infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);

-- Update existing issues to have default severity if null
UPDATE issues SET severity = 'medium' WHERE severity IS NULL;

-- Issue Types Schema
-- Predefined and custom issue types for better categorization

CREATE TABLE IF NOT EXISTS issue_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'infrastructure', 'asset', 'facility', 'safety', 'other'
  description TEXT,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false, -- true if created by user
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Add issue_type_id and infrastructure_id columns to issues table
ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_type_id uuid REFERENCES issue_types(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS infrastructure_id uuid REFERENCES infrastructure_plans(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES employees(id);

-- Enable RLS
ALTER TABLE issue_types ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all on issue_types" ON issue_types FOR ALL USING (true) WITH CHECK (true);

-- Seed predefined issue types

-- Infrastructure Issues
INSERT INTO issue_types (name, category, description, severity, is_custom) VALUES
('Network Outage', 'infrastructure', 'Complete loss of network connectivity', 'critical', false),
('Slow Connection', 'infrastructure', 'Degraded network performance', 'medium', false),
('Equipment Failure', 'infrastructure', 'Hardware malfunction or breakdown', 'high', false),
('Configuration Error', 'infrastructure', 'Incorrect settings or configuration', 'medium', false),
('Power Failure', 'infrastructure', 'Loss of electrical power', 'critical', false),
('Water Leak', 'infrastructure', 'Leaking pipes or fixtures', 'high', false),
('Low Pressure', 'infrastructure', 'Insufficient water pressure', 'medium', false);

-- Asset Issues
INSERT INTO issue_types (name, category, description, severity, is_custom) VALUES
('Equipment Damage', 'asset', 'Physical damage to equipment', 'high', false),
('Maintenance Required', 'asset', 'Scheduled or unscheduled maintenance needed', 'medium', false),
('Malfunction', 'asset', 'Equipment not operating correctly', 'high', false),
('Missing Equipment', 'asset', 'Equipment lost or stolen', 'high', false);

-- Facility Issues
INSERT INTO issue_types (name, category, description, severity, is_custom) VALUES
('Cleanliness', 'facility', 'Cleaning or sanitation issue', 'low', false),
('Structural Damage', 'facility', 'Building or structure damage', 'high', false),
('HVAC Issue', 'facility', 'Heating, ventilation, or cooling problem', 'medium', false),
('Lighting Problem', 'facility', 'Lighting malfunction or inadequate illumination', 'low', false);

-- Safety Issues
INSERT INTO issue_types (name, category, description, severity, is_custom) VALUES
('Safety Hazard', 'safety', 'Immediate safety risk', 'critical', false),
('Fire Risk', 'safety', 'Potential fire hazard', 'critical', false),
('Trip Hazard', 'safety', 'Risk of slipping or falling', 'high', false),
('Security Concern', 'safety', 'Security vulnerability or breach', 'high', false);

-- Other
INSERT INTO issue_types (name, category, description, severity, is_custom) VALUES
('Other', 'other', 'Issue not covered by predefined types', 'medium', false);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(issue_type_id);
CREATE INDEX IF NOT EXISTS idx_issues_infrastructure ON issues(infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_issue_types_category ON issue_types(category);
CREATE INDEX IF NOT EXISTS idx_issue_types_active ON issue_types(is_active) WHERE is_active = true;

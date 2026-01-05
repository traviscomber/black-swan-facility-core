-- Issue Labels table for flexible tagging
CREATE TABLE IF NOT EXISTS issue_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#8B7355', -- Default brown color matching theme
  created_at TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Issue label assignments (many-to-many)
CREATE TABLE IF NOT EXISTS issue_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES issue_labels(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT now(),
  UNIQUE(issue_id, label_id)
);

-- Issue to Task assignments (many-to-many)
CREATE TABLE IF NOT EXISTS issue_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT now(),
  UNIQUE(issue_id, task_id)
);

-- Enable RLS
ALTER TABLE issue_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_task_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on issue_labels" ON issue_labels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on issue_label_assignments" ON issue_label_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on issue_task_assignments" ON issue_task_assignments FOR ALL USING (true) WITH CHECK (true);

-- Seed default labels
INSERT INTO issue_labels (name, description, color) VALUES
('Urgent', 'Requires immediate attention', '#dc2626'),
('Bug', 'Issue or defect', '#f59e0b'),
('Feature Request', 'New functionality requested', '#3b82f6'),
('Documentation', 'Documentation related', '#6366f1'),
('Infrastructure', 'Infrastructure related', '#8b5cf6'),
('Safety', 'Safety concern', '#ef4444'),
('Blocked', 'Blocked by another issue', '#6b7280'),
('Follow-up', 'Needs follow-up action', '#14b8a6');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_issue_label_assignments_issue ON issue_label_assignments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_label_assignments_label ON issue_label_assignments(label_id);
CREATE INDEX IF NOT EXISTS idx_issue_task_assignments_issue ON issue_task_assignments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_task_assignments_task ON issue_task_assignments(task_id);

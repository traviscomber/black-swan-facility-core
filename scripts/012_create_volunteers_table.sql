-- Volunteers Management Table
-- Tracks volunteer staff with volunteer-specific fields

CREATE TABLE IF NOT EXISTS volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  volunteer_role TEXT,
  status TEXT DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  hours_logged NUMERIC DEFAULT 0,
  skills TEXT[],
  availability TEXT,
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (restrict in production based on roles)
CREATE POLICY "Allow all on volunteers" ON volunteers FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_volunteers_status ON volunteers(status);
CREATE INDEX idx_volunteers_active ON volunteers(is_active);

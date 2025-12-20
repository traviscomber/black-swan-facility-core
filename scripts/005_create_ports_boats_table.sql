-- Create ports_boats table to store port facilities and vessels
CREATE TABLE IF NOT EXISTS ports_boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('port', 'boat')),
  location TEXT NOT NULL,
  capacity TEXT,
  status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'inactive')),
  description TEXT,
  last_maintenance DATE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE ports_boats ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow all operations
CREATE POLICY "Allow all operations on ports_boats" ON ports_boats
  FOR ALL
  USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_ports_boats_type ON ports_boats(type);
CREATE INDEX idx_ports_boats_status ON ports_boats(status);

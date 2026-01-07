-- Infrastructure Connections table: stores connection diagrams between infrastructure points
-- This allows visualization of roads, building connections, utility lines, etc.

CREATE TABLE IF NOT EXISTS infrastructure_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_infrastructure_id uuid NOT NULL REFERENCES infrastructure_plans(id) ON DELETE CASCADE,
  to_infrastructure_id uuid NOT NULL REFERENCES infrastructure_plans(id) ON DELETE CASCADE,
  connection_type TEXT DEFAULT 'road',  -- road, building, electricity, water, internet, gas, sewage, etc.
  description TEXT,
  -- GeoJSON LineString coordinates as JSON array of [lon, lat] pairs
  coordinates JSONB,  -- Format: [[lon1, lat1], [lon2, lat2], ...]
  status TEXT DEFAULT 'active',  -- planned, active, inactive
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE infrastructure_connections ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for now
CREATE POLICY "Allow all on infrastructure_connections" ON infrastructure_connections FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for fast querying
CREATE INDEX idx_from_infrastructure ON infrastructure_connections(from_infrastructure_id);
CREATE INDEX idx_to_infrastructure ON infrastructure_connections(to_infrastructure_id);
CREATE INDEX idx_connection_type ON infrastructure_connections(connection_type);

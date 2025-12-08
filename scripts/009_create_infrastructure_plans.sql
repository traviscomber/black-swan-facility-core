-- Infrastructure Plans Schema for GIS Map
-- Tables for managing Internet, Water, and Electrical infrastructure with photos

-- Infrastructure Plans table
CREATE TABLE IF NOT EXISTS infrastructure_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'internet', 'water', 'electricity'
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'planned', 'maintenance', 'inactive'
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  installation_date DATE,
  last_inspection DATE,
  next_inspection DATE,
  specifications JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Infrastructure Photos table
CREATE TABLE IF NOT EXISTS infrastructure_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infrastructure_id uuid REFERENCES infrastructure_plans(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT, -- 'installation', 'maintenance', 'issue', 'documentation'
  taken_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Infrastructure Documents table
CREATE TABLE IF NOT EXISTS infrastructure_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infrastructure_id uuid REFERENCES infrastructure_plans(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT, -- 'plan', 'schematic', 'manual', 'report', 'certificate'
  uploaded_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE infrastructure_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on infrastructure_plans" ON infrastructure_plans FOR ALL USING (true);
CREATE POLICY "Allow all on infrastructure_photos" ON infrastructure_photos FOR ALL USING (true);
CREATE POLICY "Allow all on infrastructure_documents" ON infrastructure_documents FOR ALL USING (true);

-- Seed sample infrastructure data

-- Internet Infrastructure
INSERT INTO infrastructure_plans (name, category, description, latitude, longitude, status, priority, specifications) VALUES
('Main Fiber Entry Point', 'internet', 'Primary fiber optic entry point from ISP', -39.7598, -73.2285, 'active', 'critical', '{"bandwidth": "1Gbps", "provider": "Local ISP", "connection_type": "Fiber"}'::jsonb),
('North Woods WiFi AP', 'internet', 'Outdoor WiFi access point for north cabins', -39.7590, -73.2295, 'active', 'high', '{"coverage_radius": "100m", "frequency": "5GHz", "model": "Ubiquiti"}'::jsonb),
('Main Lodge Network Switch', 'internet', 'Core network switch 48-port', -39.7605, -73.2280, 'active', 'critical', '{"ports": 48, "speed": "1Gbps", "managed": true}'::jsonb),
('South Field Repeater', 'internet', 'Signal repeater for extended coverage', -39.7610, -73.2270, 'maintenance', 'normal', '{"range": "200m", "frequency": "2.4/5GHz"}'::jsonb);

-- Water Infrastructure
INSERT INTO infrastructure_plans (name, category, description, latitude, longitude, status, priority, specifications) VALUES
('Main Water Pump Station', 'water', 'Primary well pump and filtration system', -39.7600, -73.2290, 'active', 'critical', '{"capacity": "500L/min", "depth": "80m", "power": "5HP"}'::jsonb),
('North Cabin Water Line', 'water', 'Distribution line to north cabins', -39.7592, -73.2298, 'active', 'high', '{"diameter": "2 inch", "material": "PVC", "length": "150m"}'::jsonb),
('Emergency Water Storage', 'water', 'Backup water tank 10000L', -39.7608, -73.2275, 'active', 'critical', '{"capacity": "10000L", "material": "Steel", "elevation": "high"}'::jsonb),
('Irrigation Control Valve', 'water', 'Main irrigation system control', -39.7612, -73.2268, 'active', 'normal', '{"zones": 4, "type": "Automatic", "schedule": "Timer"}'::jsonb);

-- Electrical Infrastructure
INSERT INTO infrastructure_plans (name, category, description, latitude, longitude, status, priority, specifications) VALUES
('Main Electrical Panel', 'electricity', 'Primary 200A service panel', -39.7603, -73.2282, 'active', 'critical', '{"amperage": "200A", "voltage": "240V", "phases": 1}'::jsonb),
('Solar Panel Array', 'electricity', '20kW solar installation on main lodge', -39.7604, -73.2281, 'active', 'high', '{"capacity": "20kW", "panels": 60, "inverter": "Grid-tie"}'::jsonb),
('Generator Backup', 'electricity', 'Diesel backup generator 50kW', -39.7602, -73.2284, 'active', 'critical', '{"capacity": "50kW", "fuel": "Diesel", "runtime": "48h"}'::jsonb),
('North Cabin Subpanel', 'electricity', 'Distribution subpanel 100A', -39.7591, -73.2296, 'active', 'high', '{"amperage": "100A", "circuits": 24}'::jsonb),
('Outdoor Lighting Circuit', 'electricity', 'Security and pathway lighting', -39.7607, -73.2277, 'active', 'normal', '{"type": "LED", "power": "500W total", "zones": 5}'::jsonb);

-- Add sample photos
INSERT INTO infrastructure_photos (infrastructure_id, photo_url, caption, photo_type)
SELECT id, '/placeholder.svg?height=400&width=600', 'Main fiber optic connection box', 'installation'
FROM infrastructure_plans WHERE name = 'Main Fiber Entry Point' LIMIT 1;

INSERT INTO infrastructure_photos (infrastructure_id, photo_url, caption, photo_type)
SELECT id, '/placeholder.svg?height=400&width=600', 'Well pump and filtration system', 'installation'
FROM infrastructure_plans WHERE name = 'Main Water Pump Station' LIMIT 1;

INSERT INTO infrastructure_photos (infrastructure_id, photo_url, caption, photo_type)
SELECT id, '/placeholder.svg?height=400&width=600', 'Rooftop solar installation', 'installation'
FROM infrastructure_plans WHERE name = 'Solar Panel Array' LIMIT 1;

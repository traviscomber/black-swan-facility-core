-- Solar panels tracking table
CREATE TABLE IF NOT EXISTS solar_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity_kw DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'maintenance', 'inactive')),
  installation_date DATE NOT NULL,
  last_maintenance TIMESTAMP DEFAULT NOW(),
  victron_device_id TEXT,
  current_output_kw DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Building electricity consumption tracking
CREATE TABLE IF NOT EXISTS building_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_name TEXT NOT NULL,
  location TEXT NOT NULL,
  current_usage_kw DECIMAL(10,2) DEFAULT 0,
  daily_usage_kwh DECIMAL(10,2) DEFAULT 0,
  monthly_usage_kwh DECIMAL(10,2) DEFAULT 0,
  solar_offset_percent INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE solar_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_consumption ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all on solar_panels (ALL)" ON solar_panels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on building_consumption (ALL)" ON building_consumption FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_solar_panels_status ON solar_panels(status);
CREATE INDEX idx_solar_panels_victron ON solar_panels(victron_device_id) WHERE victron_device_id IS NOT NULL;
CREATE INDEX idx_building_consumption_name ON building_consumption(building_name);

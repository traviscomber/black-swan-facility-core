-- Create tablet device registry table
CREATE TABLE IF NOT EXISTS tablet_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tablet_location ON tablet_devices(location_id);
CREATE INDEX idx_tablet_device_id ON tablet_devices(device_id);

ALTER TABLE tablet_devices ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone can read tablet info
CREATE POLICY "Read tablet devices" ON tablet_devices FOR SELECT USING (true);

-- RLS: Only staff can update
CREATE POLICY "Update tablet devices" ON tablet_devices FOR UPDATE USING (auth.role() = 'authenticated');

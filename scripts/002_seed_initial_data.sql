-- Seed initial data for Black Swan Facility Core

-- Insert default utilities to monitor
INSERT INTO utilities (category, status, notes, last_update) VALUES
  ('Electricity', 'ok', 'All systems operational', now()),
  ('Water', 'ok', 'Water supply normal', now()),
  ('Internet', 'ok', 'Connection stable', now())
ON CONFLICT DO NOTHING;

-- Insert sample employees
INSERT INTO employees (name, role, phone, email, is_active) VALUES
  ('John Smith', 'Facility Manager', '555-0101', 'john@blackswan.com', true),
  ('Sarah Johnson', 'Maintenance Lead', '555-0102', 'sarah@blackswan.com', true),
  ('Mike Davis', 'Operations', '555-0103', 'mike@blackswan.com', true)
ON CONFLICT DO NOTHING;

-- Insert sample critical assets
INSERT INTO assets (name, type, location, description, is_critical, latitude, longitude) VALUES
  ('Main Generator', 'Electricity', 'Equipment Building', 'Primary backup power generator', true, 40.7128, -74.0060),
  ('Well Pump #1', 'Water', 'North Field', 'Primary water well pump', true, 40.7138, -74.0070),
  ('Network Router', 'Internet', 'Admin Building', 'Main network router', true, 40.7118, -74.0050),
  ('Solar Panel Array', 'Electricity', 'South Roof', 'Solar power system', false, 40.7108, -74.0040),
  ('Water Storage Tank', 'Water', 'East Side', 'Main water storage', true, 40.7148, -74.0080)
ON CONFLICT DO NOTHING;

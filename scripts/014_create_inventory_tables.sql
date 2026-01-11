-- Create cost centers table
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create asset categories table
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#726658',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create multimedia assets table (Inventory)
CREATE TABLE IF NOT EXISTS multimedia_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES asset_categories(id),
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id),
  serial_number TEXT,
  brand TEXT,
  model TEXT,
  purchase_date DATE,
  purchase_price NUMERIC,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'deprecated')),
  location TEXT,
  assigned_to TEXT,
  photo_url TEXT,
  qr_code_data TEXT,
  qr_code_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID
);

-- Create asset logs table for tracking changes
CREATE TABLE IF NOT EXISTS multimedia_asset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES multimedia_assets(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('created', 'updated', 'photo_added', 'status_changed', 'maintenance', 'assigned')),
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE multimedia_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE multimedia_asset_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all on cost_centers" ON cost_centers FOR ALL USING (true);
CREATE POLICY "Allow all on asset_categories" ON asset_categories FOR ALL USING (true);
CREATE POLICY "Allow all on multimedia_assets" ON multimedia_assets FOR ALL USING (true);
CREATE POLICY "Allow all on multimedia_asset_logs" ON multimedia_asset_logs FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_multimedia_assets_category ON multimedia_assets(category_id);
CREATE INDEX idx_multimedia_assets_cost_center ON multimedia_assets(cost_center_id);
CREATE INDEX idx_multimedia_assets_status ON multimedia_assets(status);
CREATE INDEX idx_multimedia_assets_code ON multimedia_assets(asset_code);
CREATE INDEX idx_multimedia_asset_logs_asset ON multimedia_asset_logs(asset_id);

-- Insert default cost centers
INSERT INTO cost_centers (name, code, description) VALUES
  ('Multimedia', 'MM', 'Multimedia assets and equipment'),
  ('IT Infrastructure', 'IT', 'Information technology'),
  ('Facilities', 'FA', 'Facility management'),
  ('Operations', 'OP', 'General operations')
ON CONFLICT (code) DO NOTHING;

-- Insert default categories
INSERT INTO asset_categories (name, icon, color) VALUES
  ('Computers', 'monitor', '#3b82f6'),
  ('Cameras', 'camera', '#ec4899'),
  ('Audio Equipment', 'headphones', '#8b5cf6'),
  ('Projectors', 'presentation', '#f59e0b'),
  ('Displays', 'tv', '#06b6d4'),
  ('Networking', 'router', '#10b981'),
  ('Storage', 'hard-drive', '#6366f1'),
  ('Other', 'box', '#6b7280')
ON CONFLICT DO NOTHING;

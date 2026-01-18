-- Operations and Monthly KMZ Tracking System
-- Stores vehicle trips, field operations, and associated KMZ files organized by month

-- Table: vehicles/equipment fleet
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('truck', 'van', 'car', 'tractor', 'excavator', 'drone', 'other')),
  plate_number TEXT,
  team_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE,
  vin TEXT,
  purchase_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: operations/trips
CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('vehicle_trip', 'field_operation', 'survey', 'inspection', 'maintenance', 'other')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  assigned_team_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
  assigned_to UUID,
  start_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  end_date TIMESTAMP WITHOUT TIME ZONE,
  location TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  
  -- Statistics
  distance_km NUMERIC,
  duration_hours NUMERIC,
  area_covered_km2 NUMERIC,
  
  -- Monthly organization
  month DATE NOT NULL, -- First day of the month for grouping
  
  -- Additional data
  photos JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: KMZ files associated with operations
CREATE TABLE IF NOT EXISTS operation_kmz_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  kmz_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  file_type TEXT DEFAULT 'kmz',
  
  -- KMZ content metadata
  bounds JSONB, -- {minLat, maxLat, minLon, maxLon}
  total_distance_km NUMERIC,
  total_duration_hours NUMERIC,
  total_area_km2 NUMERIC,
  waypoints_count INTEGER,
  
  -- Visualization
  is_visible BOOLEAN DEFAULT TRUE,
  color_code TEXT DEFAULT '#2196F3',
  opacity NUMERIC DEFAULT 1,
  
  -- Tracking
  uploaded_by UUID,
  uploaded_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITHOUT TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: Monthly operation summaries (for quick stats)
CREATE TABLE IF NOT EXISTS monthly_operation_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  total_operations INTEGER DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  total_duration_hours NUMERIC DEFAULT 0,
  total_area_covered_km2 NUMERIC DEFAULT 0,
  total_kmz_files INTEGER DEFAULT 0,
  vehicles_active JSONB DEFAULT '[]'::jsonb,
  teams_involved JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_operations_month ON operations(month);
CREATE INDEX IF NOT EXISTS idx_operations_vehicle ON operations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_operations_team ON operations(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operation_kmz_operation ON operation_kmz_files(operation_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_month ON monthly_operation_summary(month);

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_kmz_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_operation_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all on vehicles" ON vehicles FOR ALL USING (TRUE);
CREATE POLICY "Allow all on operations" ON operations FOR ALL USING (TRUE);
CREATE POLICY "Allow all on operation_kmz_files" ON operation_kmz_files FOR ALL USING (TRUE);
CREATE POLICY "Allow all on monthly_operation_summary" ON monthly_operation_summary FOR ALL USING (TRUE);

-- Sample data
INSERT INTO vehicles (code, name, vehicle_type, status) VALUES
  ('VEH-001', 'Camion Principal', 'truck', 'active'),
  ('VEH-002', 'Van de Operaciones', 'van', 'active'),
  ('VEH-003', 'Tractor', 'tractor', 'active'),
  ('DRONE-01', 'Drone de Mapeo', 'drone', 'active')
ON CONFLICT DO NOTHING;

COMMIT;

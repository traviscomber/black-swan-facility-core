-- Fuel consumption tracking system for field operations
-- Stores fuel consumption records from WhatsApp messages, images or manual entry

CREATE TABLE IF NOT EXISTS fuel_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Operation reference
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  
  -- Fuel data
  fuel_code TEXT NOT NULL UNIQUE,
  date_recorded DATE NOT NULL,
  time_recorded TIME,
  liters NUMERIC(10,2) NOT NULL CHECK (liters > 0),
  fuel_type TEXT CHECK (fuel_type IN ('diesel', 'gasoline', 'premium_gas', 'other')),
  cost_pesos NUMERIC(12,2),
  
  -- Location & context
  location TEXT,
  odometer_reading NUMERIC,
  notes TEXT,
  
  -- Image evidence
  photo_url TEXT,
  
  -- Source information
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp', 'image_upload')),
  submitted_by UUID,
  whatsapp_message_id TEXT,
  
  -- Status
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMP WITHOUT TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monthly fuel summary for analytics
CREATE TABLE IF NOT EXISTS monthly_fuel_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  total_liters NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(14,2) DEFAULT 0,
  total_records INTEGER DEFAULT 0,
  vehicles_count INTEGER DEFAULT 0,
  average_cost_per_liter NUMERIC(10,2),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle ON fuel_consumption(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel_consumption(date_recorded);
CREATE INDEX IF NOT EXISTS idx_fuel_operation ON fuel_consumption(operation_id);
CREATE INDEX IF NOT EXISTS idx_fuel_verified ON fuel_consumption(is_verified);
CREATE INDEX IF NOT EXISTS idx_monthly_fuel_month ON monthly_fuel_summary(month);

-- Enable RLS
ALTER TABLE fuel_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_fuel_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all on fuel_consumption" ON fuel_consumption FOR ALL USING (TRUE);
CREATE POLICY "Allow all on monthly_fuel_summary" ON monthly_fuel_summary FOR ALL USING (TRUE);

COMMIT;

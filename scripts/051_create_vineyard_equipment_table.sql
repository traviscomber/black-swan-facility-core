-- Create vineyard_equipment table for tracking vineyard equipment and tools
CREATE TABLE IF NOT EXISTS public.vineyard_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_name VARCHAR(255) NOT NULL,
  equipment_type VARCHAR(100),
  purchase_date DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  condition VARCHAR(50) DEFAULT 'operational',
  storage_location VARCHAR(255),
  location_id UUID REFERENCES public.locations(id),
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.vineyard_equipment ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for all operations
CREATE POLICY "Allow all on vineyard_equipment" ON public.vineyard_equipment
  FOR ALL USING (true) WITH CHECK (true);

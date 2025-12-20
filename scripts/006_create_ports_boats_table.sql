-- Create ports_boats table
CREATE TABLE IF NOT EXISTS public.ports_boats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('port', 'boat')),
  location TEXT NOT NULL,
  capacity TEXT,
  status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'inactive')),
  description TEXT,
  last_maintenance TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ports_boats ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for now (allow all operations)
CREATE POLICY "Allow all on ports_boats" ON public.ports_boats FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster searches
CREATE INDEX idx_ports_boats_name ON public.ports_boats(name);
CREATE INDEX idx_ports_boats_type ON public.ports_boats(type);
CREATE INDEX idx_ports_boats_location ON public.ports_boats(location);

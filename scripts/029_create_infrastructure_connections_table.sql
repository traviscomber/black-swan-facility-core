-- Create infrastructure_connections table for storing connection lines between infrastructure points
CREATE TABLE IF NOT EXISTS public.infrastructure_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_infrastructure_id UUID NOT NULL REFERENCES public.infrastructure_plans(id) ON DELETE CASCADE,
  to_infrastructure_id UUID NOT NULL REFERENCES public.infrastructure_plans(id) ON DELETE CASCADE,
  connection_type TEXT DEFAULT 'line',
  description TEXT,
  color TEXT DEFAULT '#ffffff',
  line_style TEXT DEFAULT 'dashed',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_by UUID,
  CONSTRAINT different_endpoints CHECK (from_infrastructure_id != to_infrastructure_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_connections_from ON public.infrastructure_connections(from_infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON public.infrastructure_connections(to_infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_connections_created_at ON public.infrastructure_connections(created_at);

-- Enable Row Level Security
ALTER TABLE public.infrastructure_connections ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all on infrastructure_connections" ON public.infrastructure_connections
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment to the table
COMMENT ON TABLE public.infrastructure_connections IS 'Stores connection lines between infrastructure points for visualization on the GIS map';

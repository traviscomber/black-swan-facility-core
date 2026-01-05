-- Create kitchens table
CREATE TABLE IF NOT EXISTS public.kitchens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  location TEXT NOT NULL,
  capacity TEXT,
  equipment TEXT,
  status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance', 'inactive')),
  description TEXT,
  last_cleaning DATE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on kitchens" ON public.kitchens
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX idx_kitchens_location_id ON public.kitchens(location_id);
CREATE INDEX idx_kitchens_status ON public.kitchens(status);

-- Add photo_url column to ports_boats table
ALTER TABLE public.ports_boats ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ports_boats_photo ON public.ports_boats(photo_url);

-- Create gis_overlays table to store KMZ file metadata
CREATE TABLE IF NOT EXISTS gis_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_path TEXT NOT NULL, -- Storage path: gis-overlays/{filename}
  file_size INTEGER, -- File size in bytes
  file_type TEXT DEFAULT 'kmz', -- kmz or kml
  uploaded_by UUID REFERENCES auth.users(id),
  is_visible BOOLEAN DEFAULT true,
  layer_order INTEGER DEFAULT 0,
  opacity NUMERIC DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1),
  bounds JSONB, -- Store bounding box coordinates
  metadata JSONB, -- Additional KMZ metadata (placemarks, etc.)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE gis_overlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on gis_overlays" ON gis_overlays
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_gis_overlays_visible ON gis_overlays(is_visible);
CREATE INDEX idx_gis_overlays_created_at ON gis_overlays(created_at DESC);

-- Add comment
COMMENT ON TABLE gis_overlays IS 'Stores metadata for KMZ/KML overlay files used in GIS mapping';

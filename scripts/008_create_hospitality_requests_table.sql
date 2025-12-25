-- Hospitality Requests System
-- Guests submit requests via tablet in their rooms/houses
-- Manager portal displays and manages requests

CREATE TABLE IF NOT EXISTS hospitality_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  request_type TEXT NOT NULL, -- blankets, towels, cleaning, activities, maintenance, other
  category TEXT NOT NULL, -- pre-defined category selected
  description TEXT, -- free text details
  priority TEXT DEFAULT 'normal', -- low, normal, high
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, declined
  assigned_to UUID REFERENCES employees(id),
  notes TEXT, -- internal notes from staff
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITHOUT TIME ZONE,
  whatsapp_sent_at TIMESTAMP WITHOUT TIME ZONE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_hospitality_requests_room_id ON hospitality_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_requests_location_id ON hospitality_requests(location_id);
CREATE INDEX IF NOT EXISTS idx_hospitality_requests_status ON hospitality_requests(status);
CREATE INDEX IF NOT EXISTS idx_hospitality_requests_created_at ON hospitality_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospitality_requests_assigned_to ON hospitality_requests(assigned_to);

-- Enable RLS
ALTER TABLE hospitality_requests ENABLE ROW LEVEL SECURITY;

-- Allow all access (you can restrict later)
DROP POLICY IF EXISTS "Allow all on hospitality_requests" ON hospitality_requests;
CREATE POLICY "Allow all on hospitality_requests" ON hospitality_requests FOR ALL USING (true);

-- Black Swan Concierge Agent System
-- WhatsApp Lead Management + Message Tracking + Audit Log

-- Leads table: Track incoming WhatsApp inquiries
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'whatsapp',
  stage TEXT NOT NULL DEFAULT 'new', -- new, qualified, contacted, converted, lost
  dates_requested TEXT,
  checkin DATE,
  checkout DATE,
  num_guests INTEGER,
  unit_preference TEXT, -- cabin name preference
  pets BOOLEAN DEFAULT false,
  arrival_time TEXT,
  notes TEXT,
  last_msg_at TIMESTAMPTZ DEFAULT NOW(),
  converted_to_reservation_id UUID REFERENCES reservations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table: WhatsApp conversation log
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  direction TEXT NOT NULL, -- inbound, outbound
  text TEXT NOT NULL,
  ts TIMESTAMPTZ DEFAULT NOW(),
  intent TEXT, -- booking_inquiry, question, change_request, complaint, directions
  sentiment TEXT, -- positive, neutral, negative
  reservation_id UUID REFERENCES reservations(id),
  lead_id UUID REFERENCES leads(id),
  needs_human_review BOOLEAN DEFAULT false,
  agent_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents table: Issues and problems
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  unit_id UUID REFERENCES rooms(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, investigating, resolved, closed
  photos TEXT[], -- array of photo URLs
  reported_by TEXT, -- phone or employee
  assigned_to UUID REFERENCES employees(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Actions table: Track agent decisions
CREATE TABLE IF NOT EXISTS audit_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL DEFAULT 'agent', -- agent, human, system
  action_type TEXT NOT NULL, -- message_sent, lead_created, task_created, approval_requested
  payload JSONB,
  phone TEXT,
  reservation_id UUID REFERENCES reservations(id),
  lead_id UUID REFERENCES leads(id),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  ts TIMESTAMPTZ DEFAULT NOW()
);

-- Add bedbooking_ref to reservations for external system tracking
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS bedbooking_ref TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_last_msg ON leads(last_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts DESC);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_audit_actions_ts ON audit_actions(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actions_actor ON audit_actions(actor);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow all operations on leads" ON leads;
CREATE POLICY "Allow all operations on leads" ON leads FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on incidents" ON incidents;
CREATE POLICY "Allow all operations on incidents" ON incidents FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on audit_actions" ON audit_actions;
CREATE POLICY "Allow all operations on audit_actions" ON audit_actions FOR ALL USING (true);

-- Units view (simpler name for rooms)
CREATE OR REPLACE VIEW units AS
SELECT 
  id,
  room_number as name,
  capacity,
  room_type,
  status,
  location,
  notes
FROM rooms;

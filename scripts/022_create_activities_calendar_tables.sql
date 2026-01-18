-- Activities Calendar Management System
-- Complete CRUD for facility activities with color coding and recurring events

CREATE TABLE IF NOT EXISTS activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  description TEXT,
  location TEXT,
  capacity INT,
  current_attendees INT DEFAULT 0,
  color_override TEXT,
  recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern TEXT, -- 'daily', 'weekly', 'monthly'
  recurring_end_date DATE,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'no_show', 'cancelled')),
  registered_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changes JSONB,
  user_id UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(start_date);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_attendees_activity ON activity_attendees(activity_id);

-- Enable RLS
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all on activity_types" ON activity_types FOR ALL USING (TRUE);
CREATE POLICY "Allow all on activities" ON activities FOR ALL USING (TRUE);
CREATE POLICY "Allow all on activity_attendees" ON activity_attendees FOR ALL USING (TRUE);
CREATE POLICY "Allow all on activity_logs" ON activity_logs FOR ALL USING (TRUE);

-- Sample activity types with predefined colors and icons
INSERT INTO activity_types (name, color, icon, description) VALUES
  ('Fiesta', '#FF6B6B', '🎉', 'Social gathering and celebration'),
  ('Motos', '#FF8C00', '🏍️', 'Motorcycle rides and events'),
  ('Kayaks', '#4A90E2', '🚣', 'Water sports and kayaking'),
  ('Yoga', '#9B59B6', '🧘', 'Yoga classes and wellness'),
  ('Cena', '#F39C12', '🍽️', 'Dinner and dining events'),
  ('Aventura', '#27AE60', '⛰️', 'Adventure and outdoor activities'),
  ('Cine', '#E74C3C', '🎬', 'Movie nights'),
  ('Concierto', '#1ABC9C', '🎵', 'Music and concerts'),
  ('Deporte', '#3498DB', '⚽', 'Sports and games'),
  ('Bienestar', '#95A5A6', '💆', 'Spa and wellness'),
  ('Reunion', '#34495E', '👥', 'Meetings and gatherings'),
  ('Tours', '#E67E22', '🗺️', 'Tours and excursions')
ON CONFLICT DO NOTHING;

COMMIT;

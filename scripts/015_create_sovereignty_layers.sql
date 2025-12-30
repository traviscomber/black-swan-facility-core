-- Sovereignty Hierarchy Layers Table
-- Maps the 5-layer pyramid of facility autonomy

CREATE TABLE IF NOT EXISTS sovereignty_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_number INTEGER NOT NULL UNIQUE,
  layer_name TEXT NOT NULL,
  description TEXT,
  color_code TEXT,
  icon_name TEXT,
  dependencies TEXT[],
  status TEXT DEFAULT 'planning',
  completion_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sovereignty_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id uuid NOT NULL REFERENCES sovereignty_layers(id),
  objective_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT,
  status TEXT DEFAULT 'planning',
  target_completion_date DATE,
  impact_score NUMERIC,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE sovereignty_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereignty_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on sovereignty_layers" ON sovereignty_layers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sovereignty_objectives" ON sovereignty_objectives FOR ALL USING (true) WITH CHECK (true);

-- Seed layers
INSERT INTO sovereignty_layers (layer_number, layer_name, description, color_code, icon_name, dependencies) VALUES
(1, 'Foundation: Farm, Food & Cattle', 'Survival essentials - food production, livestock management, basic nourishment', '#34d399', 'sprout', ARRAY[]::TEXT[]),
(2, 'Infrastructure: Landscaping & Communications', 'System support - land management, network connectivity, transportation', '#60a5fa', 'network', ARRAY['Farm, Food & Cattle']::TEXT[]),
(3, 'Services: Hospitality & Community', 'Guest/community experience - accommodations, hospitality, social engagement', '#a78bfa', 'users', ARRAY['Landscaping & Communications']::TEXT[]),
(4, 'Culture: Music, Art & Entertainment', 'Creative expression - cultural programs, artistic pursuits, entertainment', '#fbbf24', 'music', ARRAY['Hospitality & Community']::TEXT[]),
(5, 'Mind Sovereignty: Wellness & Education', 'Mental/spiritual independence - mental health, learning, philosophy, values', '#f87171', 'brain', ARRAY['Music, Art & Entertainment']::TEXT[]);

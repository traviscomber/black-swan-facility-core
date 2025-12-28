-- Sovereignty Metrics and Tracking Tables
-- Track self-sufficiency scores, dependencies, and historical progress

CREATE TABLE IF NOT EXISTS sovereignty_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  current_value NUMERIC,
  target_value NUMERIC,
  self_sufficiency_percentage NUMERIC,
  last_updated TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sovereignty_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  dependency_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  risk_level TEXT,
  mitigation_strategy TEXT,
  criticality TEXT,
  last_updated TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sovereignty_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  impact_area TEXT,
  before_percentage NUMERIC,
  after_percentage NUMERIC,
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE sovereignty_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereignty_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereignty_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on sovereignty_metrics" ON sovereignty_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sovereignty_dependencies" ON sovereignty_dependencies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sovereignty_timeline" ON sovereignty_timeline FOR ALL USING (true) WITH CHECK (true);

-- Seed initial sovereignty metrics
INSERT INTO sovereignty_metrics (category, metric_name, description, unit, current_value, target_value) VALUES
('Energy', 'Solar Energy Production', 'Percentage of energy from on-site renewables', '%', 0, 100),
('Energy', 'Battery Storage Capacity', 'Days of autonomy without grid power', 'days', 0, 7),
('Food', 'Local Food Production', 'Percentage of food grown on-site', '%', 0, 30),
('Water', 'Water Harvesting Efficiency', 'Percentage of water from rainwater/recycling', '%', 0, 50),
('People', 'Staff Self-Sufficiency', 'Percentage of skilled roles trained in-house', '%', 0, 80),
('People', 'Community Volunteers', 'Active volunteer count for operations', 'count', 0, 20),
('Software', 'System Sovereignty', 'Percentage of systems self-hosted vs cloud-dependent', '%', 0, 100),
('Assets', 'Maintenance Capability', 'Percentage of assets we can repair in-house', '%', 0, 70);

-- Black Swan Facility Core Database Schema
-- This script creates all tables for the facility management system

-- Assets table: stores all facility assets (equipment, infrastructure, etc.)
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  description TEXT,
  is_critical BOOLEAN DEFAULT false,
  qr_code_url TEXT,
  photo_url TEXT,
  manual_url TEXT,
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMP DEFAULT now()
);

-- Asset logs table: tracks all events and changes for assets
CREATE TABLE IF NOT EXISTS asset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  log_type TEXT,
  description TEXT,
  photo_url TEXT,
  created_by uuid,
  created_at TIMESTAMP DEFAULT now()
);

-- Employees table: manages facility staff
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Maintenance tasks table: scheduled and recurring maintenance
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT,
  next_run DATE,
  last_completed DATE,
  assigned_to uuid REFERENCES employees(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);

-- Issues table: tracks problems and incidents
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES employees(id),
  description TEXT,
  status TEXT DEFAULT 'open',
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Utilities table: monitors utility systems status
CREATE TABLE IF NOT EXISTS utilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  status TEXT,
  notes TEXT,
  last_update TIMESTAMP DEFAULT now()
);

-- Checklists table: recurring operational checklists
CREATE TABLE IF NOT EXISTS checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  frequency TEXT,
  assigned_to uuid REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Checklist items table: individual items within checklists
CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid REFERENCES checklists(id) ON DELETE CASCADE,
  item TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP
);

-- Enable Row Level Security on all tables
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (allow all operations)
-- In production, these should be restricted based on user roles

-- Assets policies
CREATE POLICY "Allow all on assets" ON assets FOR ALL USING (true) WITH CHECK (true);

-- Asset logs policies
CREATE POLICY "Allow all on asset_logs" ON asset_logs FOR ALL USING (true) WITH CHECK (true);

-- Employees policies
CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);

-- Maintenance tasks policies
CREATE POLICY "Allow all on maintenance_tasks" ON maintenance_tasks FOR ALL USING (true) WITH CHECK (true);

-- Issues policies
CREATE POLICY "Allow all on issues" ON issues FOR ALL USING (true) WITH CHECK (true);

-- Utilities policies
CREATE POLICY "Allow all on utilities" ON utilities FOR ALL USING (true) WITH CHECK (true);

-- Checklists policies
CREATE POLICY "Allow all on checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);

-- Checklist items policies
CREATE POLICY "Allow all on checklist_items" ON checklist_items FOR ALL USING (true) WITH CHECK (true);

-- Vineyard Tables

-- Vineyard Plots/Sections
CREATE TABLE IF NOT EXISTS vineyard_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  area_hectares DECIMAL(8,2),
  vine_variety TEXT,
  planted_year INT,
  rootstock TEXT,
  spacing_meters DECIMAL(4,2),
  vine_density_per_hectare INT,
  trellis_system TEXT,
  orientation TEXT,
  aspect TEXT,
  soil_type TEXT,
  ph_level DECIMAL(3,1),
  drainage_quality TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vineyard Vines (Individual vine records)
CREATE TABLE IF NOT EXISTS vineyard_vines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES vineyard_plots(id) ON DELETE CASCADE,
  vine_number TEXT NOT NULL,
  position_row INT,
  position_col INT,
  variety TEXT NOT NULL,
  age_years INT,
  rootstock TEXT,
  grafted_year INT,
  health_status TEXT DEFAULT 'healthy',
  last_pruned_date DATE,
  disease_history TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Harvest Records
CREATE TABLE IF NOT EXISTS vineyard_harvest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES vineyard_plots(id) ON DELETE CASCADE,
  harvest_date DATE NOT NULL,
  quantity_kg DECIMAL(10,2),
  quantity_tons DECIMAL(8,2),
  sugar_level_brix DECIMAL(4,1),
  acidity_ph DECIMAL(3,2),
  alcohol_potential DECIMAL(4,1),
  color_analysis TEXT,
  maturity_assessment TEXT,
  yield_per_hectare DECIMAL(8,2),
  quality_rating INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vineyard Care Logs (Pruning, fertilizing, irrigation)
CREATE TABLE IF NOT EXISTS vineyard_care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES vineyard_plots(id) ON DELETE CASCADE,
  care_type TEXT NOT NULL,
  activity_date DATE NOT NULL,
  description TEXT,
  pruning_method TEXT,
  pruning_severity TEXT,
  fertilizer_type TEXT,
  fertilizer_amount_kg DECIMAL(8,2),
  irrigation_mm INT,
  irrigation_duration_hours DECIMAL(4,1),
  labor_hours DECIMAL(5,2),
  equipment_used TEXT,
  cost DECIMAL(10,2),
  effectiveness_rating INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pest and Disease Logs
CREATE TABLE IF NOT EXISTS vineyard_pest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES vineyard_plots(id) ON DELETE CASCADE,
  pest_disease_name TEXT NOT NULL,
  detection_date DATE NOT NULL,
  severity_level TEXT,
  affected_area_percent DECIMAL(5,2),
  treatment_applied TEXT,
  treatment_date DATE,
  active_ingredient TEXT,
  dosage TEXT,
  application_method TEXT,
  labor_hours DECIMAL(5,2),
  cost DECIMAL(10,2),
  effectiveness_rating INT,
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soil Amendments and Management
CREATE TABLE IF NOT EXISTS vineyard_soil_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES vineyard_plots(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL,
  application_date DATE NOT NULL,
  material_name TEXT,
  quantity_kg DECIMAL(10,2),
  cost DECIMAL(10,2),
  nitrogen_percent DECIMAL(4,2),
  phosphorus_percent DECIMAL(4,2),
  potassium_percent DECIMAL(4,2),
  organic_matter_percent DECIMAL(4,2),
  ph_adjustment DECIMAL(3,1),
  application_method TEXT,
  labor_hours DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vineyard Analytics and Metrics
CREATE TABLE IF NOT EXISTS vineyard_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES vineyard_plots(id) ON DELETE CASCADE,
  metric_year INT NOT NULL,
  total_yield_kg DECIMAL(12,2),
  yield_per_hectare DECIMAL(8,2),
  average_brix DECIMAL(4,1),
  average_ph DECIMAL(3,2),
  average_quality_rating DECIMAL(3,1),
  total_care_cost DECIMAL(12,2),
  total_labor_hours DECIMAL(8,1),
  pest_disease_incidents INT,
  pest_disease_cost DECIMAL(10,2),
  total_harvested_vines INT,
  total_healthy_vines INT,
  vine_mortality_rate DECIMAL(5,2),
  roi_percent DECIMAL(6,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE vineyard_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vineyard_vines ENABLE ROW LEVEL SECURITY;
ALTER TABLE vineyard_harvest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vineyard_care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vineyard_pest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vineyard_soil_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vineyard_analytics ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX idx_vineyard_plots_status ON vineyard_plots(status);
CREATE INDEX idx_vineyard_vines_plot_id ON vineyard_vines(plot_id);
CREATE INDEX idx_vineyard_vines_health ON vineyard_vines(health_status);
CREATE INDEX idx_vineyard_harvest_plot_date ON vineyard_harvest_records(plot_id, harvest_date);
CREATE INDEX idx_vineyard_care_plot_date ON vineyard_care_logs(plot_id, activity_date);
CREATE INDEX idx_vineyard_pest_plot_date ON vineyard_pest_logs(plot_id, detection_date);
CREATE INDEX idx_vineyard_soil_plot_date ON vineyard_soil_amendments(plot_id, application_date);
CREATE INDEX idx_vineyard_analytics_plot_year ON vineyard_analytics(plot_id, metric_year);

-- Orchard Farm Management System
-- Tables for managing vegetable gardens and orchards at Valdivia location

-- Main orchard/garden plots table
CREATE TABLE IF NOT EXISTS orchard_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_id UUID REFERENCES locations(id),
  description TEXT,
  plot_type VARCHAR(50) NOT NULL CHECK (plot_type IN ('vegetable_garden', 'fruit_orchard', 'herb_garden', 'mixed')),
  size_sqm DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planning', 'prepared', 'active', 'fallow', 'maintenance', 'abandoned')),
  soil_type VARCHAR(100),
  ph_level DECIMAL(3, 2),
  sunlight_hours DECIMAL(3, 1),
  irrigation_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crops/vegetables planted table
CREATE TABLE IF NOT EXISTS orchard_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES orchard_plots(id) ON DELETE CASCADE,
  crop_name VARCHAR(100) NOT NULL,
  scientific_name VARCHAR(100),
  crop_type VARCHAR(50) NOT NULL CHECK (crop_type IN ('vegetable', 'fruit', 'herb', 'legume', 'root', 'leafy')),
  variety VARCHAR(100),
  planting_date DATE NOT NULL,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  quantity_planted INTEGER,
  planting_unit VARCHAR(50),
  status VARCHAR(50) DEFAULT 'growing' CHECK (status IN ('seed', 'seedling', 'growing', 'mature', 'harvesting', 'harvested', 'replanting')),
  estimated_yield DECIMAL(10, 2),
  actual_yield DECIMAL(10, 2),
  yield_unit VARCHAR(50),
  spacing_cm DECIMAL(5, 2),
  depth_cm DECIMAL(5, 2),
  water_frequency VARCHAR(100),
  fertilizer_schedule TEXT,
  companion_plants TEXT,
  pest_control_methods TEXT,
  climate_zone VARCHAR(50),
  days_to_harvest INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily care log
CREATE TABLE IF NOT EXISTS orchard_care_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES orchard_crops(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_type VARCHAR(100) NOT NULL CHECK (activity_type IN ('watering', 'fertilizing', 'weeding', 'pruning', 'pest_control', 'harvesting', 'inspection', 'mulching', 'composting')),
  hours_spent DECIMAL(5, 2),
  description TEXT,
  weather_conditions VARCHAR(100),
  temperature_c DECIMAL(4, 1),
  humidity_percent DECIMAL(5, 2),
  observations TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Harvest records
CREATE TABLE IF NOT EXISTS orchard_harvest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES orchard_crops(id) ON DELETE CASCADE,
  harvest_date DATE NOT NULL,
  quantity_harvested DECIMAL(10, 2),
  harvest_unit VARCHAR(50),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  storage_method VARCHAR(100),
  storage_location VARCHAR(100),
  shelf_life_days INTEGER,
  market_value_per_unit DECIMAL(10, 2),
  total_market_value DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pest and disease tracking
CREATE TABLE IF NOT EXISTS orchard_pest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES orchard_crops(id) ON DELETE CASCADE,
  observation_date DATE NOT NULL,
  pest_type VARCHAR(100),
  disease_name VARCHAR(100),
  severity_level VARCHAR(50) CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
  affected_percentage DECIMAL(5, 2),
  treatment_applied VARCHAR(200),
  treatment_date DATE,
  treatment_effectiveness VARCHAR(50) CHECK (treatment_effectiveness IN ('not_effective', 'partially_effective', 'effective', 'very_effective')),
  prevention_methods TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soil amendments and nutrients
CREATE TABLE IF NOT EXISTS orchard_soil_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES orchard_plots(id) ON DELETE CASCADE,
  amendment_date DATE NOT NULL,
  amendment_type VARCHAR(100) NOT NULL CHECK (amendment_type IN ('compost', 'manure', 'peat', 'lime', 'sulfur', 'organic_fertilizer', 'chemical_fertilizer', 'mulch', 'biochar')),
  product_name VARCHAR(100),
  quantity_kg DECIMAL(10, 2),
  npk_ratio VARCHAR(20),
  application_method VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tools and equipment inventory for orchard
CREATE TABLE IF NOT EXISTS orchard_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id),
  equipment_name VARCHAR(100) NOT NULL,
  equipment_type VARCHAR(100),
  purchase_date DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  condition VARCHAR(50) CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  storage_location VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Yield analytics
CREATE TABLE IF NOT EXISTS orchard_yield_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES orchard_crops(id) ON DELETE CASCADE,
  calculation_date DATE,
  total_yield_kg DECIMAL(10, 2),
  yield_per_sqm DECIMAL(8, 3),
  waste_percentage DECIMAL(5, 2),
  market_value_total DECIMAL(12, 2),
  production_cost_total DECIMAL(12, 2),
  profit_loss DECIMAL(12, 2),
  water_usage_liters DECIMAL(12, 2),
  fertilizer_usage_kg DECIMAL(10, 2),
  labor_hours DECIMAL(10, 2),
  sustainability_score DECIMAL(3, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_orchard_plots_location ON orchard_plots(location_id);
CREATE INDEX idx_orchard_plots_status ON orchard_plots(status);
CREATE INDEX idx_orchard_crops_plot ON orchard_crops(plot_id);
CREATE INDEX idx_orchard_crops_status ON orchard_crops(status);
CREATE INDEX idx_orchard_care_logs_crop ON orchard_care_logs(crop_id);
CREATE INDEX idx_orchard_care_logs_date ON orchard_care_logs(activity_date);
CREATE INDEX idx_orchard_harvest_crop ON orchard_harvest_records(crop_id);
CREATE INDEX idx_orchard_pest_crop ON orchard_pest_logs(crop_id);
CREATE INDEX idx_orchard_pest_date ON orchard_pest_logs(observation_date);
CREATE INDEX idx_orchard_soil_amendments_plot ON orchard_soil_amendments(plot_id);
CREATE INDEX idx_orchard_equipment_location ON orchard_equipment(location_id);
CREATE INDEX idx_orchard_yield_crop ON orchard_yield_analytics(crop_id);

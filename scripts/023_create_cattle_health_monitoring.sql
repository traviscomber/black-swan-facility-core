-- Tabla para animales individuales del rebaño
CREATE TABLE IF NOT EXISTS cattle_animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL,
  animal_id TEXT NOT NULL UNIQUE, -- ID único del animal (ej: 22027424)
  name TEXT,
  breed TEXT, -- Raza
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  acquisition_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'deceased', 'retired')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para registros de parámetros bioquímicos
CREATE TABLE IF NOT EXISTS cattle_biometric_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES cattle_animals(id) ON DELETE CASCADE,
  test_date DATE NOT NULL,
  
  -- Parámetros clave de salud
  bhb FLOAT, -- Beta-hydroxybutyrate (cetosis) - normal: <0.5, alert: 0.5-0.99, critical: >1.0
  total_protein FLOAT, -- g/L - normal: 70-90
  albumin FLOAT, -- g/L - normal: 35-45
  urea FLOAT, -- mg/dL - normal: 15-45
  glucose FLOAT, -- mg/dL - normal: 40-100
  
  -- Minerales
  calcium FLOAT, -- mmol/L - normal: 2.0-2.5
  magnesium FLOAT, -- mmol/L - normal: 0.85-1.05
  phosphorus FLOAT, -- mmol/L - normal: 1.6-2.3
  potassium FLOAT, -- mmol/L - normal: 3.5-4.5
  
  -- Otros
  hematocrit FLOAT, -- % - normal: 24-46
  white_blood_cells FLOAT, -- 10^3/µL
  hemoglobin FLOAT, -- g/dL - normal: 8-15
  
  -- Observaciones
  clinical_signs TEXT,
  lab_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para alertas de salud automáticas
CREATE TABLE IF NOT EXISTS cattle_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES cattle_animals(id) ON DELETE CASCADE,
  record_id UUID REFERENCES cattle_biometric_records(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'ketosis', 'hypomagnesemia', 'malnutrition', 'infection'
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  parameter_name TEXT,
  parameter_value FLOAT,
  normal_range TEXT,
  recommendation TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para planes de intervención/tratamiento
CREATE TABLE IF NOT EXISTS cattle_treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES cattle_animals(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES cattle_health_alerts(id) ON DELETE SET NULL,
  treatment_type TEXT NOT NULL, -- 'supplementation', 'medication', 'feeding_adjustment', 'isolation'
  description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  dosage TEXT,
  frequency TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued')),
  outcome TEXT,
  cost_usd NUMERIC(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para histórico de condición corporal
CREATE TABLE IF NOT EXISTS cattle_body_condition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES cattle_animals(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  body_condition_score FLOAT CHECK (body_condition_score BETWEEN 1 AND 5), -- 1=thin, 5=obese
  weight_kg FLOAT,
  height_cm FLOAT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para recomendaciones de alimentación estacional
CREATE TABLE IF NOT EXISTS cattle_feeding_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season IN ('spring', 'summer', 'fall', 'winter')),
  region TEXT, -- 'valdivia' para tu fundo
  animal_category TEXT, -- 'pregnant', 'lactating', 'growing', 'maintenance'
  
  -- Requerimientos nutricionales
  min_protein_percent FLOAT,
  min_energy_mcal_kg FLOAT,
  min_magnesium_g_day FLOAT,
  min_calcium_g_day FLOAT,
  
  -- Recomendaciones
  forage_type TEXT,
  supplement_recommendations TEXT,
  feeding_schedule TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE cattle_animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_biometric_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_body_condition_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_feeding_recommendations ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX idx_cattle_animals_farm ON cattle_animals(farm_id);
CREATE INDEX idx_biometric_animal ON cattle_biometric_records(animal_id);
CREATE INDEX idx_biometric_date ON cattle_biometric_records(test_date);
CREATE INDEX idx_health_alerts_animal ON cattle_health_alerts(animal_id);
CREATE INDEX idx_health_alerts_severity ON cattle_health_alerts(severity);
CREATE INDEX idx_treatment_animal ON cattle_treatment_plans(animal_id);
CREATE INDEX idx_body_condition_animal ON cattle_body_condition_history(animal_id);

-- Create fuel_consumption_anomalies table to track detected anomalies
CREATE TABLE IF NOT EXISTS fuel_consumption_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_consumption_id UUID NOT NULL REFERENCES fuel_consumption(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL, -- 'unusual_consumption', 'duplicate', 'invalid_vehicle', 'invalid_person', 'non_operational_hour', 'suspicious_pattern'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  description TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_consumption_id ON fuel_consumption_anomalies(fuel_consumption_id);
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_type ON fuel_consumption_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_severity ON fuel_consumption_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_confirmed ON fuel_consumption_anomalies(confirmed);

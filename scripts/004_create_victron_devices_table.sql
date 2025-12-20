-- Create victron_devices table to track Victron Energy equipment
CREATE TABLE IF NOT EXISTS victron_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('charge_controller', 'inverter', 'battery', 'monitor', 'other')),
  model VARCHAR(255) NOT NULL,
  serial_number VARCHAR(255),
  location VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'warning', 'error')),
  firmware_version VARCHAR(50),
  vrm_device_id VARCHAR(255),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  specifications JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_victron_devices_location ON victron_devices(location);
CREATE INDEX idx_victron_devices_device_type ON victron_devices(device_type);
CREATE INDEX idx_victron_devices_status ON victron_devices(status);

-- Insert Prairie House 2 equipment
INSERT INTO victron_devices (device_name, device_type, model, location, status, specifications) VALUES
('Prairie House 2 - SmartSolar MPPT', 'charge_controller', 'SmartSolar MPPT 250|100 - Tr VE.Can', 'Prairie House 2', 'online', '{"voltage": "48V", "current": "100A", "power": "5800W max"}'),
('Prairie House 2 - Pylontech Battery 1', 'battery', 'Pylontech UP5000', 'Prairie House 2', 'online', '{"voltage": "48V", "capacity": "5kWh per unit"}'),
('Prairie House 2 - Pylontech Battery 2', 'battery', 'Pylontech UP5000', 'Prairie House 2', 'online', '{"voltage": "48V", "capacity": "5kWh per unit"}'),
('Prairie House 2 - Pylontech Battery 3', 'battery', 'Pylontech UP5000', 'Prairie House 2', 'online', '{"voltage": "48V", "capacity": "5kWh per unit"}'),
('Prairie House 2 - Cerbo GX', 'monitor', 'Cerbo GX', 'Prairie House 2', 'online', '{"connectivity": "WiFi, Bluetooth, VE.Direct, VE.Can, VE.Bus"}'),
('Prairie House 2 - MultiPlus-II', 'inverter', 'MultiPlus-II 48|5000|70', 'Prairie House 2', 'online', '{"voltage": "48V", "power": "5000W", "current": "70A charger, 50A AC transfer"}'
);

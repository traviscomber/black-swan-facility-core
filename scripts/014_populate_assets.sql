-- Populate Assets with comprehensive facility infrastructure
-- This adds 15+ critical and non-critical assets to help the team manage their sovereignty

INSERT INTO assets (name, type, location, description, is_critical) VALUES
-- Energy Generation & Storage
('Main Generator 1', 'Generator', 'Equipment Building', 'Primary diesel backup generator 50kW capacity for emergency power supply', true),
('Solar Panel Array Block A', 'Solar Panel', 'Roof - Main Building', '100 panels generating 25kW peak power for renewable energy independence', true),
('Battery Storage System', 'Battery Bank', 'Equipment Building', 'LiFePO4 battery system 200kWh capacity for energy storage and grid buffering', true),
('Backup Generator 2', 'Generator', 'South Facility', 'Secondary propane generator 30kW for load sharing and redundancy', true),

-- Water & Irrigation
('Main Water Tank', 'Water Tank', 'North Plateau', 'Primary potable water storage 50,000 gallons concrete tank', true),
('Rainwater Harvesting System', 'Irrigation', 'Roof Systems', 'Collects rainwater from 15,000 sq ft of roof area for water sovereignty', false),
('Well Pump #1', 'Pump', 'Water Station Alpha', 'Deep well pump for groundwater extraction 15 GPM capacity', true),
('Agricultural Irrigation Network', 'Irrigation System', 'South Farm', 'Drip irrigation covering 50 acres for food production', false),

-- Network & Communication
('Network Router Primary', 'Networking', 'Server Room', 'Enterprise-grade edge router handling facility-wide connectivity', true),
('Satellite Internet Terminal', 'Communication', 'Tower Site', 'Backup satellite communication for off-grid internet independence', false),
('Solar WiFi Access Points', 'Networking', 'Multiple Locations', '12 solar-powered WiFi access points distributed across facility', false),

-- Food Production
('Greenhouse Complex', 'Greenhouse', 'Central Farm Area', 'Climate-controlled greenhouse 5,000 sq ft for year-round food production', false),
('Composting System', 'Composting', 'Waste Management Area', 'Commercial composting system processing 500kg/week for soil enrichment', false),

-- Infrastructure Monitoring
('Environmental Monitoring Sensors', 'Sensors', 'Distributed Network', 'IoT sensors monitoring temperature, humidity, and air quality across facility', false),
('Security Camera System', 'Security', 'Perimeter & Interior', 'Solar-powered camera system with 90-day local storage independence', false),

-- Maintenance & Tools
('Equipment Maintenance Workshop', 'Workshop', 'Equipment Building', 'Fully equipped workshop for in-house maintenance and repairs reducing external dependencies', false),
('Medical Supply Clinic', 'Medical', 'Central Building', 'Basic medical facility equipped for first aid and remote telehealth capabilities', false);

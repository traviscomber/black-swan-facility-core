-- Delete existing January fuel records to reimport completely
DELETE FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';

-- Create placeholder employee for .hector
INSERT INTO employees (name, email, phone, role, is_active, created_at, updated_at)
SELECT 'WhatsApp_.hector', 'whatsapp.hector@facility.local', NULL, 'Operario', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'WhatsApp_.hector');

-- Show current employees
SELECT name FROM employees ORDER BY name;

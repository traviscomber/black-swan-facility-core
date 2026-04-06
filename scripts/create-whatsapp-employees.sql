-- Create placeholder employees with WhatsApp_ prefix for names that don't match exactly
-- Based on analyzing the original data, create entries for employees not found in database

-- First check what we have
SELECT name FROM employees WHERE name LIKE 'WhatsApp_%' OR name LIKE '.%'
ORDER BY name;

-- If no WhatsApp employees exist yet, create placeholder entries
-- These can be edited later with real names
INSERT INTO employees (name, email, phone, role, is_active, created_at, updated_at)
SELECT 'WhatsApp_hector', 'whatsapp.hector@facility.local', NULL, 'Operario', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'WhatsApp_hector');

-- Summary
SELECT COUNT(*) as total_employees FROM employees;

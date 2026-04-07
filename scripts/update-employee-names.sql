-- Update employee names
-- Seba Corcovado -> Sebastian Manfler
-- Titan -> Cristian XXX

UPDATE employees 
SET name = 'Sebastian Manfler'
WHERE name = 'Manfred Corcovado';

UPDATE employees 
SET name = 'Cristian XXX'
WHERE name = 'Cristian xxx';

-- Verify updates
SELECT id, name, role, is_active FROM employees WHERE name IN ('Sebastian Manfler', 'Cristian XXX');

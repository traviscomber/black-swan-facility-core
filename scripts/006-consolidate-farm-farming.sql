-- Consolidate Farm and Farming into a single "Farming" division
-- Move all categories and budgets from Farm to Farming

-- Update all categories from Farm to Farming
UPDATE budget_categories
SET division_id = (SELECT id FROM budget_divisions WHERE name = 'Farming')
WHERE division_id = (SELECT id FROM budget_divisions WHERE name = 'Farm');

-- Update all budgets from Farm to Farming
UPDATE budgets
SET division_id = (SELECT id FROM budget_divisions WHERE name = 'Farming')
WHERE division_id = (SELECT id FROM budget_divisions WHERE name = 'Farm');

-- Delete the Farm division
DELETE FROM budget_divisions WHERE name = 'Farm';

-- Verify consolidation
SELECT name, COUNT(*) as count FROM budget_divisions GROUP BY name ORDER BY name;

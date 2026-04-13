-- Consolidate Farm and Farming into a single "Farming" division
-- Move all categories and budgets from Farm to Farming

-- Get the IDs
WITH divisions_info AS (
  SELECT id, name FROM budget_divisions WHERE name IN ('Farm', 'Farming')
)

-- Update all categories from Farm to Farming
UPDATE budget_categories
SET division_id = (SELECT id FROM divisions_info WHERE name = 'Farming')
WHERE division_id = (SELECT id FROM divisions_info WHERE name = 'Farm');

-- Update all budgets from Farm to Farming
UPDATE budgets
SET division_id = (SELECT id FROM divisions_info WHERE name = 'Farming')
WHERE division_id = (SELECT id FROM divisions_info WHERE name = 'Farm');

-- Delete the Farm division
DELETE FROM budget_divisions WHERE name = 'Farm';

-- Verify consolidation
SELECT name, COUNT(*) as categories FROM budget_categories GROUP BY name ORDER BY name;
SELECT name, COUNT(*) as budgets FROM budgets GROUP BY name ORDER BY name;

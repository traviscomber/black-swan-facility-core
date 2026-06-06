-- Consolidate "Admin General" into "Admin / General"
UPDATE budget_categories
SET division_id = (
  SELECT id FROM budget_divisions WHERE name = 'Admin / General' LIMIT 1
)
WHERE division_id = (
  SELECT id FROM budget_divisions WHERE name = 'Admin General' LIMIT 1
);

UPDATE budgets
SET division_id = (
  SELECT id FROM budget_divisions WHERE name = 'Admin / General' LIMIT 1
)
WHERE division_id = (
  SELECT id FROM budget_divisions WHERE name = 'Admin General' LIMIT 1
);

-- Delete the old "Admin General" division
DELETE FROM budget_divisions WHERE name = 'Admin General';

-- Verify final cleanup
SELECT name, COUNT(*) as count FROM budget_divisions GROUP BY name ORDER BY name;

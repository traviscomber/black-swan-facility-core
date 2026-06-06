-- Remove duplicate divisions and their orphaned data
-- Create temp table of IDs to keep (first instance of each division name)
CREATE TEMP TABLE keep_ids AS
SELECT DISTINCT ON (name) id
FROM budget_divisions
ORDER BY name, created_at ASC;

-- Delete budget records associated with duplicate divisions
DELETE FROM budgets
WHERE category_id IN (
  SELECT id FROM budget_categories
  WHERE division_id NOT IN (SELECT id FROM keep_ids)
);

-- Delete categories from duplicate divisions
DELETE FROM budget_categories
WHERE division_id NOT IN (SELECT id FROM keep_ids);

-- Delete duplicate divisions
DELETE FROM budget_divisions
WHERE id NOT IN (SELECT id FROM keep_ids);

-- Verify cleanup
SELECT name, COUNT(*) as count FROM budget_divisions GROUP BY name ORDER BY name;

DROP TABLE keep_ids;

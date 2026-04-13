-- Remove duplicate divisions, keeping only one per name
DELETE FROM budget_divisions
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM budget_divisions
  ORDER BY name, created_at
);

-- Verify cleanup
SELECT name, COUNT(*) as count FROM budget_divisions GROUP BY name ORDER BY name;

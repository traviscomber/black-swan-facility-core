-- Import Real Budget 2026 Data
-- Based on Budget & PnL 26 - Budget 26 CSV

-- Insert Divisions
INSERT INTO budget_divisions (id, name, type, description, is_active, created_at, updated_at) VALUES
(gen_random_uuid(), 'Admin / General', 'P&L', 'Administrative and general operations', true, NOW(), NOW()),
(gen_random_uuid(), 'Hospitality', 'P&L', 'Hospitality services', true, NOW(), NOW()),
(gen_random_uuid(), 'Farm', 'P&L', 'Farm operations', true, NOW(), NOW()),
(gen_random_uuid(), 'Torobayo', 'P&L', 'Torobayo division', true, NOW(), NOW()),
(gen_random_uuid(), 'Landscaping', 'P&L', 'Landscaping operations', true, NOW(), NOW()),
(gen_random_uuid(), 'Farming', 'P&L', 'Farming operations', true, NOW(), NOW()),
(gen_random_uuid(), 'Cattle', 'P&L', 'Cattle operations', true, NOW(), NOW()),
(gen_random_uuid(), 'Vineyard', 'P&L', 'Vineyard operations', true, NOW(), NOW());

-- Get the division IDs and insert categories
WITH divisions AS (
  SELECT id, name FROM budget_divisions
  WHERE name IN ('Admin / General', 'Hospitality', 'Farm', 'Torobayo', 'Landscaping', 'Farming', 'Cattle', 'Vineyard')
)
INSERT INTO budget_categories (id, division_id, name, category_type, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  d.id,
  cat.name,
  cat.type,
  true,
  NOW(),
  NOW()
FROM divisions d,
  (VALUES
    ('Cost', 'Operational'),
    ('HR', 'Operational'),
    ('Buildings', 'Operational'),
    ('Vehicles / Machines / Fuel', 'Operational'),
    ('Variable Cost / Consumables / Tools', 'Operational'),
    ('Legal & Financial', 'Operational'),
    ('Planning Investments HR', 'Operational'),
    ('Realising Investments', 'Operational'),
    ('Income', 'Revenue')
  ) cat(name, type)
WHERE d.name = 'Admin / General'

UNION ALL

SELECT 
  gen_random_uuid(),
  d.id,
  cat.name,
  cat.type,
  true,
  NOW(),
  NOW()
FROM divisions d,
  (VALUES
    ('Cost', 'Operational'),
    ('HR', 'Operational'),
    ('Buildings', 'Operational'),
    ('Vehicles / Machines / Fuel', 'Operational'),
    ('Variable Cost / Consumables / Tools', 'Operational'),
    ('Legal & Financial', 'Operational'),
    ('Income', 'Revenue')
  ) cat(name, type)
WHERE d.name IN ('Hospitality', 'Farm');

-- Insert year-based budgets for 2026
WITH divisions AS (
  SELECT id, name FROM budget_divisions
  WHERE name IN ('Admin / General', 'Hospitality', 'Farm', 'Torobayo', 'Landscaping', 'Farming', 'Cattle', 'Vineyard')
),
divisions_with_cats AS (
  SELECT d.id as div_id, d.name as div_name, bc.id as cat_id, bc.name as cat_name
  FROM divisions d
  LEFT JOIN budget_categories bc ON bc.division_id = d.id
  WHERE bc.id IS NOT NULL
)
INSERT INTO budgets (id, division_id, category_id, year, month, budgeted_amount, actual_amount, variance, created_at, updated_at)
SELECT
  gen_random_uuid(),
  dwc.div_id,
  dwc.cat_id,
  2026,
  1,
  CASE 
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Cost' THEN 80376
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'HR' THEN 7900
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Buildings' THEN 307
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Vehicles / Machines / Fuel' THEN 2866
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Variable Cost / Consumables / Tools' THEN 4000
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Legal & Financial' THEN 3745
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Planning Investments HR' THEN 6552
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Realising Investments' THEN 46686
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Income' THEN 1083
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Cost' THEN 12271
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'HR' THEN 3500
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Buildings' THEN 1019
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Vehicles / Machines / Fuel' THEN 1912
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Variable Cost / Consumables / Tools' THEN 9331
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Legal & Financial' THEN 113
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Income' THEN 4108
    ELSE 0
  END,
  0,
  CASE 
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Cost' THEN 80376
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'HR' THEN 7900
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Buildings' THEN 307
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Vehicles / Machines / Fuel' THEN 2866
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Variable Cost / Consumables / Tools' THEN 4000
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Legal & Financial' THEN 3745
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Planning Investments HR' THEN 6552
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Realising Investments' THEN 46686
    WHEN dwc.div_name = 'Admin / General' AND dwc.cat_name = 'Income' THEN 1083
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Cost' THEN 12271
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'HR' THEN 3500
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Buildings' THEN 1019
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Vehicles / Machines / Fuel' THEN 1912
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Variable Cost / Consumables / Tools' THEN 9331
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Legal & Financial' THEN 113
    WHEN dwc.div_name = 'Hospitality' AND dwc.cat_name = 'Income' THEN 4108
    ELSE 0
  END,
  NOW(),
  NOW()
FROM divisions_with_cats dwc;

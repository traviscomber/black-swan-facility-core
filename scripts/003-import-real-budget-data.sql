-- Import Real Budget 2026 Data
-- Based on Budget & PnL 26 - Budget 26 CSV

-- Clear existing data (optional, comment out to preserve)
-- DELETE FROM budget_actuals;
-- DELETE FROM budget_categories;
-- DELETE FROM budget_divisions;

-- Insert Divisions
INSERT INTO budget_divisions (name, type, revenue_target) VALUES
('Admin / General', 'P&L', 852172),
('Hospitality', 'P&L', 147294),
('Farm', 'P&L', 152427),
('Torobayo', 'P&L', 5133),
('Landscaping', 'P&L', 82865),
('Farming', 'P&L', 338250),
('Cattle', 'P&L', 264804),
('Vineyard', 'P&L', 25574)
ON CONFLICT (name) DO UPDATE SET revenue_target = EXCLUDED.revenue_target;

-- Get division IDs for use in categories
WITH divisions AS (
  SELECT id, name FROM budget_divisions 
  WHERE name IN ('Admin / General', 'Hospitality', 'Farm', 'Torobayo', 'Landscaping', 'Farming', 'Cattle', 'Vineyard')
)

-- Insert Categories for Admin / General
INSERT INTO budget_categories (division_id, name, type, monthly_amount, annual_amount) 
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Cost', 'Operational', 80376, 865172
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'HR', 'Operational', 7900, 95299
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Buildings', 'Operational', 307, 3683
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Vehicles / Machines / Fuel', 'Operational', 2866, 34390
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Variable Cost / Consumables / Tools', 'Operational', 4000, 48005
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Legal & Financial', 'Operational', 3745, 44941
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Planning Investments HR', 'Operational', 6552, 78622
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Realising Investments', 'Operational', 46686, 560233
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Admin / General'), 'Income', 'Revenue', 1083, 13000

-- Insert Categories for Hospitality
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'Cost', 'Operational', 12271, 147294
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'HR', 'Operational', 3500, 42000
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'Buildings', 'Operational', 1019, 12228
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'Vehicles / Machines / Fuel', 'Operational', 1912, 22941
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'Variable Cost / Consumables / Tools', 'Operational', 9331, 111977
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'Legal & Financial', 'Operational', 113, 1357
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Hospitality'), 'Income', 'Revenue', 4108, 49300

-- Insert Categories for Farm
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'Cost', 'Operational', 16814, 201727
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'HR', 'Operational', 4435, 53226
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'Buildings', 'Operational', 1019, 12226
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'Vehicles / Machines / Fuel', 'Operational', 1912, 22941
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'Variable Cost / Consumables / Tools', 'Operational', 9331, 111977
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'Legal & Financial', 'Operational', 113, 1357
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farm'), 'Income', 'Revenue', 4108, 49300

-- Insert Categories for Torobayo
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'Cost', 'Operational', 2592, 31109
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'HR', 'Operational', 1362, 16339
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'Buildings', 'Operational', 189, 2268
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'Vehicles / Machines / Fuel', 'Operational', 8, 100
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'Variable Cost / Consumables / Tools', 'Operational', 702, 8428
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'Legal & Financial', 'Operational', 331, 3974
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Torobayo'), 'Income', 'Revenue', 3020, 36242

-- Insert Categories for Landscaping
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Landscaping'), 'Cost', 'Operational', 6905, 82865
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Landscaping'), 'HR', 'Operational', 3504, 42050
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Landscaping'), 'Buildings', 'Operational', 0, 0
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Landscaping'), 'Vehicles / Machines / Fuel', 'Operational', 1439, 17268
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Landscaping'), 'Variable Cost / Consumables / Tools', 'Operational', 1962, 23547
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Landscaping'), 'Legal & Financial', 'Operational', 0, 0

-- Insert Categories for Farming
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'Cost', 'Operational', 31635, 379718
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'HR', 'Operational', 5040, 60489
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'Buildings', 'Operational', 0, 0
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'Vehicles / Machines / Fuel', 'Operational', 1565, 18779
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'Variable Cost / Consumables / Tools', 'Operational', 25038, 300450
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'Legal & Financial', 'Operational', 0, 0
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Farming'), 'Income', 'Revenue', 9576, 114914

-- Insert Categories for Cattle
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Cattle'), 'Cost', 'Operational', 31635, 379718
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Cattle'), 'HR', 'Operational', 5040, 60489
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Cattle'), 'Buildings', 'Operational', 0, 0
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Cattle'), 'Vehicles / Machines / Fuel', 'Operational', 1565, 18779
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Cattle'), 'Variable Cost / Consumables / Tools', 'Operational', 25038, 300450
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Cattle'), 'Legal & Financial', 'Operational', 0, 0

-- Insert Categories for Vineyard
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Vineyard'), 'Cost', 'Operational', 2131, 25574
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Vineyard'), 'HR', 'Operational', 1197, 14366
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Vineyard'), 'Buildings', 'Operational', 0, 0
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Vineyard'), 'Vehicles / Machines / Fuel', 'Operational', 143, 1716
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Vineyard'), 'Variable Cost / Consumables / Tools', 'Operational', 1396, 16758
UNION ALL
SELECT (SELECT id FROM divisions WHERE name = 'Vineyard'), 'Legal & Financial', 'Operational', 0, 0
ON CONFLICT (division_id, name) DO UPDATE SET 
  monthly_amount = EXCLUDED.monthly_amount,
  annual_amount = EXCLUDED.annual_amount;

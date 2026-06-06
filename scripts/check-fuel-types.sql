-- Check valid fuel types
SELECT DISTINCT fuel_type FROM fuel_consumption LIMIT 10;

-- Check table constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'fuel_consumption';

-- Get check constraint details
SELECT con.conname as constraint_name, pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
WHERE con.conrelid = 'fuel_consumption'::regclass
AND con.contype = 'c';

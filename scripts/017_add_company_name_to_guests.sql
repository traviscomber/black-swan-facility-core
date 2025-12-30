-- Add company_name field to guests table
ALTER TABLE guests ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Add comment
COMMENT ON COLUMN guests.company_name IS 'Company or organization name for business guests';

-- Add last_audit_date column to assets table if it doesn't exist
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_audit_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP;

-- Create index for better query performance on audit dates
CREATE INDEX IF NOT EXISTS idx_assets_last_audit_date ON assets(last_audit_date DESC);

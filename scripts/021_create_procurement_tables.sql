-- Procurement Database Tables (already exists in 015_create_procurement_schema.sql)
-- This script ensures all procurement tables are properly indexed and configured

-- Verify suppliers table exists and has proper indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Verify procurement_items table exists and has proper indexes  
CREATE INDEX IF NOT EXISTS idx_procurement_status ON procurement_items(status);
CREATE INDEX IF NOT EXISTS idx_procurement_supplier ON procurement_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_category ON procurement_items(category);
CREATE INDEX IF NOT EXISTS idx_procurement_delivery ON procurement_items(expected_delivery);
CREATE INDEX IF NOT EXISTS idx_procurement_created ON procurement_items(created_at);

-- Verify procurement_history table exists
CREATE INDEX IF NOT EXISTS idx_history_procurement ON procurement_history(procurement_id);
CREATE INDEX IF NOT EXISTS idx_history_changed ON procurement_history(changed_at);

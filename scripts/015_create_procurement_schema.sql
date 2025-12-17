-- Procurement and Acquisitions Management Schema
-- Manages suppliers, purchase orders, and acquisition tracking

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  payment_terms TEXT,
  rating FLOAT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price DECIMAL(12,2),
  quantity INTEGER DEFAULT 1,
  total_cost DECIMAL(12,2),
  status TEXT DEFAULT 'pending',
  budget_code TEXT,
  order_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id uuid REFERENCES procurement_items(id) ON DELETE CASCADE,
  status_change TEXT,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  changed_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on suppliers" ON suppliers FOR ALL USING (true);
CREATE POLICY "Allow all operations on procurement_items" ON procurement_items FOR ALL USING (true);
CREATE POLICY "Allow all operations on procurement_history" ON procurement_history FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_procurement_status ON procurement_items(status);
CREATE INDEX idx_procurement_supplier ON procurement_items(supplier_id);
CREATE INDEX idx_procurement_category ON procurement_items(category);
CREATE INDEX idx_procurement_delivery ON procurement_items(expected_delivery);

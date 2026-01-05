CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  payment_terms TEXT,
  rating NUMERIC DEFAULT 3.5,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers are visible to authenticated users" 
  ON suppliers FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Suppliers can be created by authenticated users" 
  ON suppliers FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Suppliers can be updated by authenticated users" 
  ON suppliers FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Suppliers can be deleted by authenticated users" 
  ON suppliers FOR DELETE 
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);

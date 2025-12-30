-- Invoices table for detailed invoice management
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
  
  -- Customer info
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_address text,
  
  -- Line items (stored as JSONB for flexibility)
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Financial details - all editable
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  discount_percentage numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  additional_fees numeric DEFAULT 0,
  total_amount numeric NOT NULL,
  
  -- Payment tracking
  payment_status text DEFAULT 'pending', -- pending, partial, paid, overdue
  amount_paid numeric DEFAULT 0,
  payment_date timestamp with time zone,
  payment_method text,
  
  -- Notes and customization
  notes text,
  terms_conditions text,
  company_info jsonb, -- company details, logo, etc.
  
  -- Audit trail
  created_by uuid REFERENCES employees(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES employees(id)
);

-- Invoice payments tracking
CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text,
  transaction_id text,
  payment_date timestamp with time zone DEFAULT now(),
  notes text,
  created_by uuid REFERENCES employees(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Invoice templates for quick creation
CREATE TABLE IF NOT EXISTS invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  company_info jsonb,
  default_terms text,
  tax_rate numeric DEFAULT 0,
  line_items_template jsonb,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES employees(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true);
CREATE POLICY "Allow all on invoice_payments" ON invoice_payments FOR ALL USING (true);
CREATE POLICY "Allow all on invoice_templates" ON invoice_templates FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_invoices_reservation_id ON invoices(reservation_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);

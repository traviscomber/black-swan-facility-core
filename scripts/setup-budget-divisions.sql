-- Create Budget Divisions table
CREATE TABLE IF NOT EXISTS public.budget_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50), -- 'P&L' or 'PNL' (non-profit)
  manager_id UUID REFERENCES public.employees(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Budget Categories table
CREATE TABLE IF NOT EXISTS public.budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  division_id UUID REFERENCES public.budget_divisions(id),
  description TEXT,
  category_type VARCHAR(50), -- 'expense' or 'revenue'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Budget table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.budget_divisions(id),
  category_id UUID REFERENCES public.budget_categories(id),
  year INTEGER NOT NULL,
  month INTEGER, -- NULL for annual budget
  budgeted_amount DECIMAL(12, 2) NOT NULL,
  actual_amount DECIMAL(12, 2),
  variance DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Actuals Tracking table
CREATE TABLE IF NOT EXISTS public.cost_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.budget_divisions(id),
  category_id UUID REFERENCES public.budget_categories(id),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL,
  reference_table VARCHAR(100), -- 'employees', 'combustibles', etc
  reference_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default divisions
INSERT INTO public.budget_divisions (name, description, type) VALUES
  ('Admin General', 'Administrative and general operations', 'P&L'),
  ('Hospitality', 'Guest hospitality and accommodations', 'P&L'),
  ('Landscaping', 'Landscaping and grounds maintenance', 'PNL'),
  ('Farming', 'Agricultural and farming operations', 'PNL')
ON CONFLICT DO NOTHING;

-- Insert default expense categories
INSERT INTO public.budget_categories (name, division_id, category_type, description) 
SELECT 'Personnel', bd.id, 'expense', 'Employee salaries and benefits'
FROM public.budget_divisions bd WHERE bd.name = 'Admin General'
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_categories (name, division_id, category_type, description)
SELECT 'Fuel & Combustibles', bd.id, 'expense', 'Fuel consumption tracking'
FROM public.budget_divisions bd WHERE bd.name = 'Farming'
ON CONFLICT DO NOTHING;

INSERT INTO public.budget_categories (name, division_id, category_type, description)
SELECT 'Guest Services', bd.id, 'expense', 'Guest-related expenses'
FROM public.budget_divisions bd WHERE bd.name = 'Hospitality'
ON CONFLICT DO NOTHING;

-- Add RLS policies
ALTER TABLE public.budget_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_actuals ENABLE ROW LEVEL SECURITY;

-- Allow all access (development mode)
CREATE POLICY "Allow all" ON public.budget_divisions FOR ALL USING (true);
CREATE POLICY "Allow all" ON public.budget_categories FOR ALL USING (true);
CREATE POLICY "Allow all" ON public.budgets FOR ALL USING (true);
CREATE POLICY "Allow all" ON public.cost_actuals FOR ALL USING (true);

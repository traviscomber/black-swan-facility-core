-- Booking system database tables

-- Rooms table already exists, but let's add any missing fields if needed
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS max_guests integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS floor text,
ADD COLUMN IF NOT EXISTS bed_type text;

-- Pricing rules table for dynamic pricing
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  season_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  rate_multiplier numeric DEFAULT 1.0,
  min_stay integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Booking status history for tracking changes
CREATE TABLE IF NOT EXISTS reservation_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  status_change text NOT NULL,
  changed_by uuid REFERENCES employees(id),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Payment tracking
CREATE TABLE IF NOT EXISTS payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text,
  payment_status text DEFAULT 'pending',
  transaction_id text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Guest profiles for repeat customers
CREATE TABLE IF NOT EXISTS guests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  address text,
  notes text,
  vip_status boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Link reservations to guest profiles
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES guests(id);

-- Reviews and ratings
CREATE TABLE IF NOT EXISTS reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Create policies for all access (you can restrict later)
CREATE POLICY "Allow all on pricing_rules" ON pricing_rules FOR ALL USING (true);
CREATE POLICY "Allow all on reservation_history" ON reservation_history FOR ALL USING (true);
CREATE POLICY "Allow all on payments" ON payments FOR ALL USING (true);
CREATE POLICY "Allow all on guests" ON guests FOR ALL USING (true);
CREATE POLICY "Allow all on reviews" ON reviews FOR ALL USING (true);

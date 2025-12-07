-- Hospitality Management Schema for Black Swan Facility Core
-- Tables for rooms, reservations, guests, and housekeeping

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL, -- cabin, suite, dorm, tent
  capacity INTEGER NOT NULL DEFAULT 2,
  status TEXT DEFAULT 'clean', -- clean, occupied, dirty, maintenance
  location TEXT, -- building or area
  amenities TEXT[], -- wifi, kitchen, bathroom, etc
  rate_per_night DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status TEXT DEFAULT 'confirmed', -- confirmed, checked-in, checked-out, cancelled
  num_guests INTEGER DEFAULT 1,
  special_requests TEXT,
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT now()
);

-- Housekeeping tasks
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- cleaning, linen-change, inspection, maintenance
  status TEXT DEFAULT 'pending', -- pending, in-progress, completed
  assigned_to uuid REFERENCES employees(id),
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  notes TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Guest requests/services
CREATE TABLE IF NOT EXISTS guest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- maintenance, amenity, service, complaint
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open, in-progress, resolved
  assigned_to uuid REFERENCES employees(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now)
CREATE POLICY "Allow all on rooms" ON rooms FOR ALL USING (true);
CREATE POLICY "Allow all on reservations" ON reservations FOR ALL USING (true);
CREATE POLICY "Allow all on housekeeping_tasks" ON housekeeping_tasks FOR ALL USING (true);
CREATE POLICY "Allow all on guest_requests" ON guest_requests FOR ALL USING (true);

-- Seed sample data
INSERT INTO rooms (room_number, room_type, capacity, status, location, rate_per_night) VALUES
('Cabin-1', 'cabin', 4, 'clean', 'North Woods', 150.00),
('Cabin-2', 'cabin', 4, 'occupied', 'North Woods', 150.00),
('Cabin-3', 'cabin', 6, 'clean', 'North Woods', 200.00),
('Suite-1', 'suite', 2, 'occupied', 'Main Lodge', 250.00),
('Suite-2', 'suite', 2, 'dirty', 'Main Lodge', 250.00),
('Tent-1', 'tent', 2, 'clean', 'South Field', 80.00),
('Tent-2', 'tent', 2, 'clean', 'South Field', 80.00),
('Dorm-1', 'dorm', 8, 'occupied', 'East Building', 40.00);

INSERT INTO reservations (room_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests) 
SELECT id, 'John Smith', 'john@example.com', '+1-555-0101', CURRENT_DATE, CURRENT_DATE + 3, 'checked-in', 2 
FROM rooms WHERE room_number = 'Cabin-2' LIMIT 1;

INSERT INTO reservations (room_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests) 
SELECT id, 'Maria Garcia', 'maria@example.com', '+1-555-0102', CURRENT_DATE, CURRENT_DATE + 2, 'checked-in', 2 
FROM rooms WHERE room_number = 'Suite-1' LIMIT 1;

INSERT INTO reservations (room_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests) 
SELECT id, 'David Lee', 'david@example.com', '+1-555-0103', CURRENT_DATE + 1, CURRENT_DATE + 4, 'confirmed', 4 
FROM rooms WHERE room_number = 'Cabin-3' LIMIT 1;

INSERT INTO housekeeping_tasks (room_id, task_type, status, priority) 
SELECT id, 'cleaning', 'pending', 'high' FROM rooms WHERE room_number = 'Suite-2' LIMIT 1;

INSERT INTO guest_requests (reservation_id, request_type, description, status)
SELECT id, 'service', 'Need extra towels and firewood', 'open'
FROM reservations WHERE guest_name = 'John Smith' LIMIT 1;

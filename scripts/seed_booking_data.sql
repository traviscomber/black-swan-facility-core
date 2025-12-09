-- Seed data for booking system

-- Add some sample rooms if they don't exist
INSERT INTO rooms (room_number, room_type, capacity, rate_per_night, status, location, amenities, max_guests, floor, bed_type)
VALUES
  ('101', 'Standard', 2, 120.00, 'available', 'Building A - Floor 1', ARRAY['WiFi', 'TV', 'Air Conditioning'], 2, '1', 'Queen'),
  ('102', 'Standard', 2, 120.00, 'available', 'Building A - Floor 1', ARRAY['WiFi', 'TV', 'Air Conditioning'], 2, '1', 'Queen'),
  ('201', 'Deluxe', 3, 180.00, 'available', 'Building A - Floor 2', ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 3, '2', 'King'),
  ('202', 'Deluxe', 3, 180.00, 'available', 'Building A - Floor 2', ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'], 3, '2', 'King'),
  ('301', 'Suite', 4, 280.00, 'available', 'Building B - Floor 3', ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Jacuzzi'], 4, '3', 'King + Sofa Bed')
ON CONFLICT DO NOTHING;

-- Add sample guests
INSERT INTO guests (name, email, phone, vip_status)
VALUES
  ('John Smith', 'john.smith@email.com', '+1-555-0101', false),
  ('Sarah Johnson', 'sarah.j@email.com', '+1-555-0102', true),
  ('Mike Davis', 'mike.davis@email.com', '+1-555-0103', false),
  ('Emma Wilson', 'emma.w@email.com', '+1-555-0104', true)
ON CONFLICT (email) DO NOTHING;

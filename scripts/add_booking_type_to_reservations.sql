-- Add booking_type and location_id to reservations table for dual booking modes
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'BED' CHECK (booking_type IN ('LOCATION', 'BED'));

ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Make bed_id nullable since location bookings don't need a specific bed
ALTER TABLE reservations 
ALTER COLUMN bed_id DROP NOT NULL;

-- Create index for location bookings
CREATE INDEX IF NOT EXISTS idx_reservations_location_id ON reservations(location_id);
CREATE INDEX IF NOT EXISTS idx_reservations_booking_type ON reservations(booking_type);

COMMENT ON COLUMN reservations.booking_type IS 'LOCATION = whole house rental (customers), BED = individual bed booking (staff/volunteers)';
COMMENT ON COLUMN reservations.location_id IS 'Reference to location when booking_type is LOCATION';

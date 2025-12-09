-- Sistema de reservas basado en CAMAS individuales

-- Tabla de camas (beds) dentro de cada pieza/habitación
CREATE TABLE IF NOT EXISTS beds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number text NOT NULL, -- Ej: "Cama 1", "Cama A", "Litera Superior 1"
  bed_type text NOT NULL, -- Ej: "individual", "matrimonial", "litera superior", "litera inferior"
  is_available boolean DEFAULT true,
  status text DEFAULT 'available', -- available, occupied, maintenance
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(room_id, bed_number)
);

-- Modificar reservations para que sea por CAMA en vez de por habitación
ALTER TABLE reservations 
DROP COLUMN IF EXISTS room_id,
ADD COLUMN IF NOT EXISTS bed_id uuid REFERENCES beds(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS num_guests integer DEFAULT 1,
DROP COLUMN IF EXISTS num_guests;

-- Volver a agregar num_guests con el default correcto
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS num_guests integer DEFAULT 1;

-- Tabla para manejar múltiples personas en una reserva de cama
CREATE TABLE IF NOT EXISTS reservation_guests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text,
  guest_phone text,
  guest_id_number text, -- Para identificación oficial
  is_primary boolean DEFAULT false, -- Huésped principal de la reserva
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_guests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all on beds" ON beds FOR ALL USING (true);
CREATE POLICY "Allow all on reservation_guests" ON reservation_guests FOR ALL USING (true);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
CREATE INDEX IF NOT EXISTS idx_reservations_bed_id ON reservations(bed_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_reservation_id ON reservation_guests(reservation_id);

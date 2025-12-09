-- Datos de ejemplo para el sistema de camas

-- Primero, asegurarse que existen habitaciones
INSERT INTO rooms (id, room_number, room_type, capacity, status, rate_per_night, location)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Dormitorio 1', 'Dormitorio Compartido', 8, 'available', 15000, 'Piso 1'),
  ('22222222-2222-2222-2222-222222222222', 'Dormitorio 2', 'Dormitorio Compartido', 6, 'available', 15000, 'Piso 1'),
  ('33333333-3333-3333-3333-333333333333', 'Habitación Privada 1', 'Privada Doble', 2, 'available', 35000, 'Piso 2'),
  ('44444444-4444-4444-4444-444444444444', 'Habitación Privada 2', 'Privada Individual', 1, 'available', 25000, 'Piso 2')
ON CONFLICT (id) DO UPDATE 
SET room_type = EXCLUDED.room_type, 
    capacity = EXCLUDED.capacity;

-- Crear camas para Dormitorio 1 (8 camas tipo litera)
INSERT INTO beds (room_id, bed_number, bed_type, status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Litera 1 Superior', 'litera superior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 1 Inferior', 'litera inferior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 2 Superior', 'litera superior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 2 Inferior', 'litera inferior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 3 Superior', 'litera superior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 3 Inferior', 'litera inferior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 4 Superior', 'litera superior', 'available'),
  ('11111111-1111-1111-1111-111111111111', 'Litera 4 Inferior', 'litera inferior', 'available')
ON CONFLICT (room_id, bed_number) DO NOTHING;

-- Crear camas para Dormitorio 2 (6 camas tipo litera)
INSERT INTO beds (room_id, bed_number, bed_type, status)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'Litera A Superior', 'litera superior', 'available'),
  ('22222222-2222-2222-2222-222222222222', 'Litera A Inferior', 'litera inferior', 'available'),
  ('22222222-2222-2222-2222-222222222222', 'Litera B Superior', 'litera superior', 'available'),
  ('22222222-2222-2222-2222-222222222222', 'Litera B Inferior', 'litera inferior', 'available'),
  ('22222222-2222-2222-2222-222222222222', 'Litera C Superior', 'litera superior', 'available'),
  ('22222222-2222-2222-2222-222222222222', 'Litera C Inferior', 'litera inferior', 'available')
ON CONFLICT (room_id, bed_number) DO NOTHING;

-- Crear camas para Habitación Privada 1 (2 camas individuales)
INSERT INTO beds (room_id, bed_number, bed_type, status)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 'Cama 1', 'individual', 'available'),
  ('33333333-3333-3333-3333-333333333333', 'Cama 2', 'individual', 'available')
ON CONFLICT (room_id, bed_number) DO NOTHING;

-- Crear cama para Habitación Privada 2 (1 cama matrimonial)
INSERT INTO beds (room_id, bed_number, bed_type, status)
VALUES 
  ('44444444-4444-4444-4444-444444444444', 'Cama Matrimonial', 'matrimonial', 'available')
ON CONFLICT (room_id, bed_number) DO NOTHING;

-- Insertar algunos huéspedes de ejemplo
INSERT INTO guests (id, name, email, phone, vip_status)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Juan Pérez', 'juan@example.com', '+56912345678', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'María González', 'maria@example.com', '+56987654321', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Pedro Silva', 'pedro@example.com', '+56955555555', false)
ON CONFLICT (email) DO NOTHING;

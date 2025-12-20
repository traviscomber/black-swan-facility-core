-- Seed ports_boats with initial data
INSERT INTO public.ports_boats (name, type, location, capacity, status, description, last_maintenance) VALUES
  ('Embarcadero Rebelin', 'port', 'Rebelin', '4 boats', 'operational', 'Primary docking facility', '14-12-2024'),
  ('Corovado', 'boat', 'Rebelin', '10 meters', 'operational', 'Main transport vessel', '10-12-2024'),
  ('Embarcadero Puerto Claro', 'port', 'Puerto Claro', '6 boats', 'operational', 'Secondary port facility', '12-12-2024'),
  ('Nativa', 'boat', 'Rebelin', '15 meters', 'operational', 'Secondary transport vessel', '08-12-2024')
ON CONFLICT DO NOTHING;

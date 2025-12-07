-- Update asset coordinates to Fundo El Corcovado, Valdivia, Chile
-- Center coordinates: -39.8140, -73.2458

UPDATE assets SET 
  latitude = -39.8140,
  longitude = -73.2458
WHERE name = 'Main Generator';

UPDATE assets SET 
  latitude = -39.8135,
  longitude = -73.2465
WHERE name = 'Well Pump #1';

UPDATE assets SET 
  latitude = -39.8145,
  longitude = -73.2450
WHERE name = 'Network Router';

UPDATE assets SET 
  latitude = -39.8138,
  longitude = -73.2455
WHERE name = 'Solar Panel Array';

UPDATE assets SET 
  latitude = -39.8142,
  longitude = -73.2462
WHERE name = 'Water Storage Tank';

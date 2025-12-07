-- Update asset coordinates to Isla Rialejo, Valdivia, Chile
-- Center coordinates: -39.76, -73.23 (exact location from map)

-- Updated to exact Isla Rialejo coordinates from map image
UPDATE assets SET 
  latitude = -39.7600,
  longitude = -73.2300
WHERE name = 'Main Generator';

UPDATE assets SET 
  latitude = -39.7595,
  longitude = -73.2310
WHERE name = 'Well Pump #1';

UPDATE assets SET 
  latitude = -39.7605,
  longitude = -73.2295
WHERE name = 'Network Router';

UPDATE assets SET 
  latitude = -39.7610,
  longitude = -73.2305
WHERE name = 'Solar Panel Array';

UPDATE assets SET 
  latitude = -39.7590,
  longitude = -73.2290
WHERE name = 'Water Storage Tank';

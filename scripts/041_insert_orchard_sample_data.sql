-- Sample data for Orchard Farm at Valdivia
-- Common vegetables suitable for Valdivia's climate (Zone 9, Cool temperate)

-- Get the Valdivia location ID (assuming it exists in locations table)
-- Using a placeholder UUID that should be updated with real Valdivia location ID
DO $$
DECLARE
  valdivia_location_id UUID;
  plot_1_id UUID;
  plot_2_id UUID;
  plot_3_id UUID;
BEGIN
  -- Get or use a default Valdivia location
  SELECT id INTO valdivia_location_id FROM locations WHERE name ILIKE '%valdivia%' LIMIT 1;
  
  IF valdivia_location_id IS NULL THEN
    -- If no Valdivia location exists, use a placeholder
    valdivia_location_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Insert orchard plots
  INSERT INTO orchard_plots (name, location_id, description, plot_type, size_sqm, status, soil_type, ph_level, sunlight_hours, irrigation_type)
  VALUES 
    ('Main Vegetable Garden', valdivia_location_id, 'Primary vegetable garden with mixed seasonal crops', 'vegetable_garden', 250, 'active', 'loamy-rich', 6.5, 6, 'drip-irrigation'),
    ('Herb & Leafy Garden', valdivia_location_id, 'Protected area for herbs and leafy greens', 'herb_garden', 80, 'active', 'sandy-loam', 6.8, 5, 'sprinkler'),
    ('Root Vegetables Section', valdivia_location_id, 'Dedicated area for potatoes, carrots, and root crops', 'vegetable_garden', 120, 'active', 'loamy', 6.3, 4, 'drip-irrigation')
  RETURNING id INTO plot_1_id, plot_2_id, plot_3_id;

  -- Main garden vegetables - Summer/Fall crops
  INSERT INTO orchard_crops (plot_id, crop_name, scientific_name, crop_type, variety, planting_date, expected_harvest_date, quantity_planted, planting_unit, status, spacing_cm, depth_cm, water_frequency, fertilizer_schedule, companion_plants, pest_control_methods, climate_zone, days_to_harvest)
  VALUES
    (plot_1_id, 'Tomato', 'Solanum lycopersicum', 'vegetable', 'Beefsteak', CURRENT_DATE, CURRENT_DATE + INTERVAL '80 days', 24, 'plants', 'seedling', 60, 2, 'daily-morning', 'bi-weekly-NPK-10-10-10', 'basil, carrot, onion', 'neem-oil, companion-planting', '9', 75),
    (plot_1_id, 'Lettuce', 'Lactuca sativa', 'leafy', 'Romaine', CURRENT_DATE, CURRENT_DATE + INTERVAL '45 days', 200, 'seeds', 'seedling', 20, 1, 'every-2-days', 'weekly-compost', 'radish, carrot', 'row-covers, companion', '9', 45),
    (plot_1_id, 'Bell Pepper', 'Capsicum annuum', 'vegetable', 'California Wonder', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 18, 'plants', 'growing', 45, 2, 'daily-morning', 'bi-weekly-balanced', 'basil, onion', 'organic-spray', '9', 90),
    (plot_1_id, 'Carrot', 'Daucus carota', 'root', 'Nantes', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '70 days', 300, 'seeds', 'growing', 8, 3, 'every-3-days', 'monthly-compost', 'lettuce, tomato', 'mulching', '9', 70),
    (plot_1_id, 'Zucchini', 'Cucurbita pepo', 'vegetable', 'Early Green', CURRENT_DATE, CURRENT_DATE + INTERVAL '50 days', 8, 'plants', 'seedling', 90, 2, 'daily-morning', 'weekly-NPK-5-10-10', 'corn, beans', 'row-covers', '9', 50),
    (plot_1_id, 'Onion', 'Allium cepa', 'vegetable', 'Yellow Spanish', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '30 days', 200, 'sets', 'growing', 15, 4, 'every-2-days', 'monthly-balanced', 'carrot, lettuce', 'organic-sulfur', '9', 120),
    (plot_2_id, 'Basil', 'Ocimum basilicum', 'herb', 'Genovese', CURRENT_DATE - INTERVAL '45 days', 'ongoing', 50, 'plants', 'mature', 20, 1, 'daily-morning', 'weekly-light', 'tomato, carrot', 'none', '9', 21),
    (plot_2_id, 'Parsley', 'Petroselinum crispum', 'herb', 'Italian Flat-Leaf', CURRENT_DATE - INTERVAL '60 days', 'ongoing', 80, 'seeds', 'mature', 15, 1, 'every-2-days', 'bi-weekly-compost', 'various', 'none', '9', 70),
    (plot_2_id, 'Spinach', 'Spinacia oleracea', 'leafy', 'Bloomsdale', CURRENT_DATE, CURRENT_DATE + INTERVAL '40 days', 300, 'seeds', 'seedling', 10, 2, 'every-2-days', 'weekly-compost', 'strawberry, radish', 'row-covers', '9', 40),
    (plot_2_id, 'Arugula', 'Eruca sativa', 'leafy', 'Astro', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '25 days', 200, 'seeds', 'growing', 10, 1, 'daily-morning', 'weekly-compost', 'lettuce, carrot', 'companion-planting', '9', 35),
    (plot_3_id, 'Potato', 'Solanum tuberosum', 'root', 'Red Pontevedra', CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '45 days', 50, 'kg-seed', 'growing', 30, 10, 'every-3-days', 'bi-weekly-NPK-8-10-10', 'corn, beans', 'hilling, mulching', '9', 90),
    (plot_3_id, 'Beet', 'Beta vulgaris', 'root', 'Detroit Dark Red', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '50 days', 300, 'seeds', 'growing', 10, 4, 'every-3-days', 'monthly-compost', 'lettuce, spinach', 'mulching', '9', 60),
    (plot_3_id, 'Radish', 'Raphanus sativus', 'root', 'French Breakfast', CURRENT_DATE, CURRENT_DATE + INTERVAL '25 days', 400, 'seeds', 'seedling', 5, 2, 'daily-morning', 'no-fertilizer', 'lettuce, carrot', 'companion-planting', '9', 25);

  -- Sample care logs
  INSERT INTO orchard_care_logs (crop_id, activity_date, activity_type, hours_spent, description, weather_conditions, temperature_c, humidity_percent, observations)
  SELECT id, CURRENT_DATE - INTERVAL '1 day', 'watering', 1.5, 'Morning watering with drip system', 'Partly cloudy', 18.5, 65, 'Plants looking healthy' 
  FROM orchard_crops WHERE crop_name = 'Tomato' LIMIT 1
  UNION ALL
  SELECT id, CURRENT_DATE - INTERVAL '2 days', 'fertilizing', 2, 'Applied compost-based fertilizer', 'Sunny', 20.0, 50, 'Good soil absorption'
  FROM orchard_crops WHERE crop_name = 'Basil' LIMIT 1
  UNION ALL
  SELECT id, CURRENT_DATE - INTERVAL '3 days', 'pest_control', 1.5, 'Sprayed neem oil on affected leaves', 'Cloudy', 17.0, 75, 'Found 5 aphids, treated immediately'
  FROM orchard_crops WHERE crop_name = 'Bell Pepper' LIMIT 1;

  -- Sample soil amendments
  INSERT INTO orchard_soil_amendments (plot_id, amendment_date, amendment_type, product_name, quantity_kg, npk_ratio, application_method)
  VALUES
    (plot_1_id, CURRENT_DATE - INTERVAL '15 days', 'compost', 'Homemade Garden Compost', 500, '3-2-1', 'surface-mixed'),
    (plot_1_id, CURRENT_DATE - INTERVAL '30 days', 'organic_fertilizer', 'Fish Emulsion', 50, '5-1-1', 'foliar-spray'),
    (plot_2_id, CURRENT_DATE - INTERVAL '20 days', 'peat', 'Peat Moss', 100, '0-0-0', 'mulch-layer'),
    (plot_3_id, CURRENT_DATE - INTERVAL '45 days', 'manure', 'Aged Horse Manure', 800, '2-1-2', 'soil-incorporation');

  -- Sample equipment
  INSERT INTO orchard_equipment (location_id, equipment_name, equipment_type, purchase_date, last_maintenance_date, condition, storage_location)
  VALUES
    (valdivia_location_id, 'Drip Irrigation System', 'irrigation', '2023-03-15', CURRENT_DATE - INTERVAL '30 days', 'good', 'tool-shed-1'),
    (valdivia_location_id, 'Rotary Tiller', 'soil-preparation', '2022-06-20', CURRENT_DATE - INTERVAL '60 days', 'good', 'equipment-storage'),
    (valdivia_location_id, 'Garden Fork Set', 'hand-tools', '2024-01-10', NULL, 'excellent', 'tool-rack-a'),
    (valdivia_location_id, 'Wheelbarrow', 'transport', '2023-11-05', NULL, 'good', 'tool-shed-1'),
    (valdivia_location_id, 'Pruning Shears Set', 'maintenance', '2024-02-01', NULL, 'excellent', 'tool-rack-b'),
    (valdivia_location_id, 'Hose & Nozzle', 'irrigation', '2023-08-15', CURRENT_DATE - INTERVAL '15 days', 'fair', 'tool-shed-1');
END $$;

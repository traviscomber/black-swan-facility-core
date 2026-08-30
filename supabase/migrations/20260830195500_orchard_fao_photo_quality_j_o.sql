-- Upgrade J-O Orchard photography using FAO WCA crop identity as the canonical
-- crop reference, with clearer agricultural imagery for the visual catalog.
update public.orchard_crop_photo_registry set
  photo_url = case crop_name
    when 'Jerusalem artichoke' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Jerusalem_artichoke.jpg'
    when 'Jowar (sorghum)' then 'https://commons.wikimedia.org/wiki/Special:FilePath/SorghumBicolorField.jpg'
    when 'Jute' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Jute_field.jpg'
    when 'Kapok' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Ceiba_pentandra_fruit_in_hg.jpg'
    when 'Kava' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Starr_070515-7054_Piper_methysticum.jpg'
    when 'Kiwi fruit' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Kiwi_fruits_orchard.jpg'
    when 'Lavender' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lavender_Field.jpg'
    when 'Lemon' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lemon_tree_with_fruit_and_flowers.jpg'
    when 'Lentil' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lens_culinaris.jpg'
    when 'Lime, sour' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Citrus_aurantiifolia_at_Kadavoor.jpg'
    when 'Litchi' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lychee_Fruit.jpg'
    when 'Loquat' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Loquat_fruit_tree.jpg'
    when 'Macadamia (Queensland nut)' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Macadamia_nuts.jpg'
    when 'Mace' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Nutmeg_fruit_with_mace.jpg'
    when 'Mango' then 'https://commons.wikimedia.org/wiki/Special:FilePath/A_photo_of_a_mango_tree_with_fruits.jpg'
    when 'Mangosteen/Mangostano' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Mangosteen_fruit_on_the_tree.jpg'
    when 'Millet, proso' then 'https://commons.wikimedia.org/wiki/Special:FilePath/LPCC-1028-Camp_de_mill.jpg'
    when 'Nectarine' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Nectarines.jpg'
    when 'Nutmeg' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Nutmeg_on_Tree.jpg'
    when 'Oats, for fodder' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Oats_in_a_field.jpg'
    when 'Oats, for grain' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Oats_in_a_field.jpg'
    when 'Oil palm' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Fresh_oil_palm_fruit.jpg'
    when 'Okra' then 'https://commons.wikimedia.org/wiki/Special:FilePath/An_okra_field.jpg'
    when 'Olive' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Olive_grove.jpg'
    when 'Onion seed' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Seed_onion.jpg'
    when 'Onion, dry' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Onion_field.jpg'
    when 'Orange' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Orange_on_the_tree.jpg'
    when 'Orange, bitter' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Citrus-aurantium-fruit.JPG'
    else photo_url end,
  source_page = case crop_name
    when 'Jerusalem artichoke' then 'https://commons.wikimedia.org/wiki/File:Jerusalem_artichoke.jpg'
    when 'Jowar (sorghum)' then 'https://commons.wikimedia.org/wiki/File:SorghumBicolorField.jpg'
    when 'Jute' then 'https://commons.wikimedia.org/wiki/File:Jute_field.jpg'
    when 'Kapok' then 'https://commons.wikimedia.org/wiki/File:Ceiba_pentandra_fruit_in_hg.jpg'
    when 'Kava' then 'https://commons.wikimedia.org/wiki/File:Starr_070515-7054_Piper_methysticum.jpg'
    when 'Kiwi fruit' then 'https://commons.wikimedia.org/wiki/File:Kiwi_fruits_orchard.jpg'
    when 'Lavender' then 'https://commons.wikimedia.org/wiki/File:Lavender_Field.jpg'
    when 'Lemon' then 'https://commons.wikimedia.org/wiki/File:Lemon_tree_with_fruit_and_flowers.jpg'
    when 'Lentil' then 'https://commons.wikimedia.org/wiki/File:Lens_culinaris.jpg'
    when 'Lime, sour' then 'https://commons.wikimedia.org/wiki/File:Citrus_aurantiifolia_at_Kadavoor.jpg'
    when 'Litchi' then 'https://commons.wikimedia.org/wiki/File:Lychee_Fruit.jpg'
    when 'Loquat' then 'https://commons.wikimedia.org/wiki/File:Loquat_fruit_tree.jpg'
    when 'Macadamia (Queensland nut)' then 'https://commons.wikimedia.org/wiki/File:Macadamia_nuts.jpg'
    when 'Mace' then 'https://commons.wikimedia.org/wiki/File:Nutmeg_fruit_with_mace.jpg'
    when 'Mango' then 'https://commons.wikimedia.org/wiki/File:A_photo_of_a_mango_tree_with_fruits.jpg'
    when 'Mangosteen/Mangostano' then 'https://commons.wikimedia.org/wiki/File:Mangosteen_fruit_on_the_tree.jpg'
    when 'Millet, proso' then 'https://commons.wikimedia.org/wiki/File:LPCC-1028-Camp_de_mill.jpg'
    when 'Nectarine' then 'https://commons.wikimedia.org/wiki/File:Nectarines.jpg'
    when 'Nutmeg' then 'https://commons.wikimedia.org/wiki/File:Nutmeg_on_Tree.jpg'
    when 'Oats, for fodder' then 'https://commons.wikimedia.org/wiki/File:Oats_in_a_field.jpg'
    when 'Oats, for grain' then 'https://commons.wikimedia.org/wiki/File:Oats_in_a_field.jpg'
    when 'Oil palm' then 'https://commons.wikimedia.org/wiki/File:Fresh_oil_palm_fruit.jpg'
    when 'Okra' then 'https://commons.wikimedia.org/wiki/File:An_okra_field.jpg'
    when 'Olive' then 'https://commons.wikimedia.org/wiki/File:Olive_grove.jpg'
    when 'Onion seed' then 'https://commons.wikimedia.org/wiki/File:Seed_onion.jpg'
    when 'Onion, dry' then 'https://commons.wikimedia.org/wiki/File:Onion_field.jpg'
    when 'Orange' then 'https://commons.wikimedia.org/wiki/File:Orange_on_the_tree.jpg'
    when 'Orange, bitter' then 'https://commons.wikimedia.org/wiki/File:Citrus-aurantium-fruit.JPG'
    else source_page end,
  verification_status = 'verified',
  verified_at = now(),
  updated_at = now(),
  notes = 'FAO WCA identity aligned; photo upgraded for agricultural clarity and higher visual quality.'
where crop_name in (
  'Jerusalem artichoke','Jowar (sorghum)','Jute','Kapok','Kava','Kiwi fruit','Lavender','Lemon','Lentil','Lime, sour',
  'Litchi','Loquat','Macadamia (Queensland nut)','Mace','Mango','Mangosteen/Mangostano','Millet, proso','Nectarine',
  'Nutmeg','Oats, for fodder','Oats, for grain','Oil palm','Okra','Olive','Onion seed','Onion, dry','Orange','Orange, bitter'
);
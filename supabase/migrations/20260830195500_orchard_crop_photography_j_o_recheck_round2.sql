-- Finish the J-O photography recheck using live Wikimedia Commons file pages.
update public.orchard_crop_photo_registry set
  photo_url = case crop_name
    when 'Lavender' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lavandula_angustifolia_lavender_Lavendel_01.jpg'
    when 'Lentil' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Green_lentils.jpg'
    when 'Lettuce' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lettuce_Mini_Heads_(7331119710).jpg'
    when 'Lime, sweet' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Citrus_limettioides_-_Palestine_sweet_lime.jpg'
    when 'Loquat' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Japanese_loquat_fruit.jpg'
    when 'Maguey' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Agave_salmiana_(maguey_pulquero)_Gto.jpg'
    when 'Maslin (mixed cereals)' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Les_Massards_Bl%C3%A9_Seigle.jpg'
    when 'Millet, finger' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Eleusine_coracana.JPG'
    when 'Millet, foxtail' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Setaria_italica_(4656382577).jpg'
    when 'Oil palm' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Oil_Palm_Fruit.JPG'
    else photo_url end,
  source_page = case crop_name
    when 'Lavender' then 'https://commons.wikimedia.org/wiki/File:Lavandula_angustifolia_lavender_Lavendel_01.jpg'
    when 'Lentil' then 'https://commons.wikimedia.org/wiki/File:Green_lentils.jpg'
    when 'Lettuce' then 'https://commons.wikimedia.org/wiki/File:Lettuce_Mini_Heads_(7331119710).jpg'
    when 'Lime, sweet' then 'https://commons.wikimedia.org/wiki/File:Citrus_limettioides_-_Palestine_sweet_lime.jpg'
    when 'Loquat' then 'https://commons.wikimedia.org/wiki/File:Japanese_loquat_fruit.jpg'
    when 'Maguey' then 'https://commons.wikimedia.org/wiki/File:Agave_salmiana_(maguey_pulquero)_Gto.jpg'
    when 'Maslin (mixed cereals)' then 'https://commons.wikimedia.org/wiki/File:Les_Massards_Bl%C3%A9_Seigle.jpg'
    when 'Millet, finger' then 'https://commons.wikimedia.org/wiki/File:Eleusine_coracana.JPG'
    when 'Millet, foxtail' then 'https://commons.wikimedia.org/wiki/File:Setaria_italica_(4656382577).jpg'
    when 'Oil palm' then 'https://commons.wikimedia.org/wiki/File:Oil_Palm_Fruit.JPG'
    else source_page end,
  verification_status='verified',
  verified_at=now(),
  updated_at=now(),
  notes='Revalidated against live Wikimedia Commons file page after rendered-image QA.'
where crop_name in (
  'Lavender','Lentil','Lettuce','Lime, sweet','Loquat','Maguey','Maslin (mixed cereals)','Millet, finger','Millet, foxtail','Oil palm'
);
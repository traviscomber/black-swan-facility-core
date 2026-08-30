-- Persist verified Orchard crop photography for G-I so fresh environments
-- receive the same registry coverage as production.

insert into public.orchard_crop_photo_registry
  (crop_name, photo_url, source_page, verification_status, verified_at, notes, updated_at)
values
  ('Garlic, dry', 'https://commons.wikimedia.org/wiki/Special:FilePath/Garlic_bulbs.jpg', 'https://commons.wikimedia.org/wiki/File:Garlic_bulbs.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Garlic, green', 'https://commons.wikimedia.org/wiki/Special:FilePath/Green_garlic.jpg', 'https://commons.wikimedia.org/wiki/File:Green_garlic.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Geranium', 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Geranium.png', 'https://commons.wikimedia.org/wiki/File:The_Geranium.png', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Ginger', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ginger_root.jpg', 'https://commons.wikimedia.org/wiki/File:Ginger_root.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Ginseng', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ginsengpflanze.jpg', 'https://commons.wikimedia.org/wiki/File:Ginsengpflanze.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Gooseberry (all varieties)', 'https://commons.wikimedia.org/wiki/Special:FilePath/Gooseberry.jpg', 'https://commons.wikimedia.org/wiki/File:Gooseberry.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Gourd', 'https://commons.wikimedia.org/wiki/Special:FilePath/Gourd.JPG', 'https://commons.wikimedia.org/wiki/File:Gourd.JPG', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Gram pea (chickpea)', 'https://commons.wikimedia.org/wiki/Special:FilePath/Cicer_arietinum_sl38.jpg', 'https://commons.wikimedia.org/wiki/File:Cicer_arietinum_sl38.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grape', 'https://commons.wikimedia.org/wiki/Special:FilePath/Grape_fruit.jpg', 'https://commons.wikimedia.org/wiki/File:Grape_fruit.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grapefruit', 'https://commons.wikimedia.org/wiki/Special:FilePath/Grapefruit-Whole-%26-Split.jpg', 'https://commons.wikimedia.org/wiki/File:Grapefruit-Whole-%26-Split.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grapes for raisins', 'https://commons.wikimedia.org/wiki/Special:FilePath/Raisins.jpg', 'https://commons.wikimedia.org/wiki/File:Raisins.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grapes for table use', 'https://commons.wikimedia.org/wiki/Special:FilePath/Table_grapes_on_white.jpg', 'https://commons.wikimedia.org/wiki/File:Table_grapes_on_white.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grapes for wine', 'https://commons.wikimedia.org/wiki/Special:FilePath/Wine_grapes.jpg', 'https://commons.wikimedia.org/wiki/File:Wine_grapes.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grass esparto', 'https://commons.wikimedia.org/wiki/Special:FilePath/Stipa_tenacissima.jpg', 'https://commons.wikimedia.org/wiki/File:Stipa_tenacissima.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grass, orchard', 'https://commons.wikimedia.org/wiki/Special:FilePath/An_Orchard_grass.jpg', 'https://commons.wikimedia.org/wiki/File:An_Orchard_grass.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Grass, Sudan', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sorghum_sudanense_(D%C3%A9but_XX%C3%A8me_si%C3%A8cle)_-_btv1b101206910_(1_of_2).jpg', 'https://commons.wikimedia.org/wiki/File:Sorghum_sudanense_(D%C3%A9but_XX%C3%A8me_si%C3%A8cle)_-_btv1b101206910_(1_of_2).jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Groundnut (peanut)', 'https://commons.wikimedia.org/wiki/Special:FilePath/Peanut_plant.jpg', 'https://commons.wikimedia.org/wiki/File:Peanut_plant.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Guarana', 'https://commons.wikimedia.org/wiki/Special:FilePath/Guaran%C3%A1_(Paullinia_cupana)_fruits_(29055398276).jpg', 'https://commons.wikimedia.org/wiki/File:Guaran%C3%A1_(Paullinia_cupana)_fruits_(29055398276).jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Guava', 'https://commons.wikimedia.org/wiki/Special:FilePath/Guava_fruit.jpg', 'https://commons.wikimedia.org/wiki/File:Guava_fruit.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Guinea corn (sorghum)', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sorghum_bicolor_plant.jpg', 'https://commons.wikimedia.org/wiki/File:Sorghum_bicolor_plant.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Guinea pepper', 'https://commons.wikimedia.org/wiki/Special:FilePath/Aframomum_melegueta.jpg', 'https://commons.wikimedia.org/wiki/File:Aframomum_melegueta.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hazelnut (filbert)', 'https://commons.wikimedia.org/wiki/Special:FilePath/Hazelnut_Tree.jpg', 'https://commons.wikimedia.org/wiki/File:Hazelnut_Tree.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hemp fibre', 'https://commons.wikimedia.org/wiki/Special:FilePath/Hennepvezel_Cannabis_sativa_fibre.jpg', 'https://commons.wikimedia.org/wiki/File:Hennepvezel_Cannabis_sativa_fibre.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hemp, Manila (abaca)', 'https://commons.wikimedia.org/wiki/Special:FilePath/Abac%C3%A0_planta.jpg', 'https://commons.wikimedia.org/wiki/File:Abac%C3%A0_planta.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hemp, sun', 'https://commons.wikimedia.org/wiki/Special:FilePath/Crotalaria_juncea.jpg', 'https://commons.wikimedia.org/wiki/File:Crotalaria_juncea.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hempseed', 'https://commons.wikimedia.org/wiki/Special:FilePath/Hempseed.jpg', 'https://commons.wikimedia.org/wiki/File:Hempseed.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Henequen', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lanzarote_-_Agave_fourcroydes.jpg', 'https://commons.wikimedia.org/wiki/File:Lanzarote_-_Agave_fourcroydes.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Henna', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lawsonia_inermis.jpg', 'https://commons.wikimedia.org/wiki/File:Lawsonia_inermis.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hop', 'https://commons.wikimedia.org/wiki/Special:FilePath/Humulus_lupulus_-_hops.jpg', 'https://commons.wikimedia.org/wiki/File:Humulus_lupulus_-_hops.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Horse bean', 'https://commons.wikimedia.org/wiki/Special:FilePath/Vicia_faba_Broad_Beans_(7419934092).jpg', 'https://commons.wikimedia.org/wiki/File:Vicia_faba_Broad_Beans_(7419934092).jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Horseradish', 'https://commons.wikimedia.org/wiki/Special:FilePath/Armoracia_rusticana.jpg', 'https://commons.wikimedia.org/wiki/File:Armoracia_rusticana.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Hybrid maize', 'https://commons.wikimedia.org/wiki/Special:FilePath/Corn_field.jpg', 'https://commons.wikimedia.org/wiki/File:Corn_field.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now()),
  ('Indigo', 'https://commons.wikimedia.org/wiki/Special:FilePath/Indigofera_tinctoria.jpg', 'https://commons.wikimedia.org/wiki/File:Indigofera_tinctoria.jpg', 'verified', now(), 'Verified crop-specific Wikimedia Commons image.', now())
on conflict (crop_name) do update set
  photo_url = excluded.photo_url,
  source_page = excluded.source_page,
  verification_status = excluded.verification_status,
  verified_at = excluded.verified_at,
  notes = excluded.notes,
  updated_at = excluded.updated_at;
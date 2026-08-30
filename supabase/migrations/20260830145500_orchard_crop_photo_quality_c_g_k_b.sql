-- Final crop-photo quality corrections from production visual QA.
-- Canonical crop identity follows the FAO WCA crop list; imagery is a real crop/plant photograph.
insert into public.orchard_crop_photo_registry
  (crop_name, photo_url, source_page, verification_status, verified_at, notes, updated_at)
values
  ('Chili, fresh (all varieties)',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Red_chilli_plant_bearing_ripe_fruits.jpg',
   'https://commons.wikimedia.org/wiki/File:Red_chilli_plant_bearing_ripe_fruits.jpg',
   'verified', now(),
   'FAO WCA Chili, fresh (all varieties) = Capsicum spp. (annuum); living Capsicum annuum plant bearing ripe fruit.', now()),
  ('Grass, Sudan',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Sudangras%2CSudan_grass%2C-Sorghum_bicolor_%28L.%29_Moench_nothosubsp._drummondii_%28Steud.%29_de_Wet_ex_Davidse-.jpg',
   'https://commons.wikimedia.org/wiki/File:Sudangras,Sudan_grass,-Sorghum_bicolor_(L.)_Moench_nothosubsp._drummondii_(Steud.)_de_Wet_ex_Davidse-.jpg',
   'verified', now(),
   'FAO WCA Sudan grass; living domesticated Sorghum bicolor nothosubsp. drummondii forage cultivar.', now()),
  ('Kola nut',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Fruits_of_Cola_nitida.JPG',
   'https://commons.wikimedia.org/wiki/File:Fruits_of_Cola_nitida.JPG',
   'verified', now(),
   'FAO-aligned kola nut identity; Cola nitida fruits on tree rather than processed powder.', now()),
  ('Brussels sprouts',
   'https://commons.wikimedia.org/wiki/Special:FilePath/Brussels_sprouts_J1.jpg',
   'https://commons.wikimedia.org/wiki/File:Brussels_sprouts_J1.jpg',
   'verified', now(),
   'Production screenshot showed a blank card; verified Brussels sprouts forming on a living plant.', now())
on conflict (crop_name) do update set
  photo_url = excluded.photo_url,
  source_page = excluded.source_page,
  verification_status = excluded.verification_status,
  verified_at = excluded.verified_at,
  notes = excluded.notes,
  updated_at = excluded.updated_at;
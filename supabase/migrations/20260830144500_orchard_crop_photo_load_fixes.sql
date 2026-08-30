-- Final load fixes found during visual QA of the FAO-aligned Orchard crop catalog.
insert into public.orchard_crop_photo_registry
  (crop_name, photo_url, source_page, verification_status, verified_at, notes, updated_at)
values
  ('Sapodilla','https://commons.wikimedia.org/wiki/Special:FilePath/Manilkara_zapota_fruits.jpg','https://commons.wikimedia.org/wiki/File:Manilkara_zapota_fruits.jpg','verified',now(),'Final load-fix: verified Manilkara zapota fruits Commons file.',now()),
  ('Shea tree (shea butter or karite nut)','https://commons.wikimedia.org/wiki/Special:FilePath/Vitellaria_paradoxa_MS_3765.jpg','https://commons.wikimedia.org/wiki/File:Vitellaria_paradoxa_MS_3765.jpg','verified',now(),'Final load-fix: verified Vitellaria paradoxa fruit Commons file.',now()),
  ('Redtop','https://commons.wikimedia.org/wiki/Special:FilePath/Agrostis_gigantea_sl1.jpg','https://commons.wikimedia.org/wiki/File:Agrostis_gigantea_sl1.jpg','verified',now(),'Final load-fix: verified Agrostis gigantea Commons file.',now()),
  ('Sweet lime','https://commons.wikimedia.org/wiki/Special:FilePath/Citrus_limetta.jpeg','https://commons.wikimedia.org/wiki/File:Citrus_limetta.jpeg','verified',now(),'Final load-fix: verified Citrus limetta Commons file.',now())
on conflict (crop_name) do update set
  photo_url = excluded.photo_url,
  source_page = excluded.source_page,
  verification_status = excluded.verification_status,
  verified_at = excluded.verified_at,
  notes = excluded.notes,
  updated_at = excluded.updated_at;
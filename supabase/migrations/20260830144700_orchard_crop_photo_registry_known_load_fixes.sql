-- Known broken-image visual QA fixes are expected to remain exact and verified.
do $$
begin
  if exists (
    select 1 from (values
      ('Sapodilla','https://commons.wikimedia.org/wiki/Special:FilePath/Manilkara_zapota_fruits.jpg'),
      ('Shea tree (shea butter or karite nut)','https://commons.wikimedia.org/wiki/Special:FilePath/Vitellaria_paradoxa_MS_3765.jpg'),
      ('Redtop','https://commons.wikimedia.org/wiki/Special:FilePath/Agrostis_gigantea_sl1.jpg'),
      ('Sweet lime','https://commons.wikimedia.org/wiki/Special:FilePath/Citrus_limetta.jpeg')
    ) as expected(crop_name, photo_url)
    left join public.orchard_crop_photo_registry p
      on p.crop_name = expected.crop_name and p.photo_url = expected.photo_url and p.verification_status = 'verified'
    where p.crop_name is null
  ) then
    raise exception 'Orchard known crop photo load fixes drifted';
  end if;
end $$;
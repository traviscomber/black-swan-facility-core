update public.orchard_crop_photo_registry
set photo_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Oryza_sativa_subsp_paddy_field.jpg',
    source_page = 'https://commons.wikimedia.org/wiki/File:Oryza_sativa_subsp_paddy_field.jpg',
    verification_status = 'verified',
    verified_at = now(),
    notes = 'Final load-fix: verified Oryza sativa paddy field Commons file.',
    updated_at = now()
where crop_name = 'Rice';
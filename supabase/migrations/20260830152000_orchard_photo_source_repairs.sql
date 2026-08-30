-- Source-photo repairs found during the final cache population pass.
update public.orchard_crop_photo_registry
set source_photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Peach_tree.jpg',
    photo_url=case when storage_public_url is null then 'https://commons.wikimedia.org/wiki/Special:FilePath/Peach_tree.jpg' else photo_url end,
    source_page='https://commons.wikimedia.org/wiki/File:Peach_tree.jpg',
    verification_status='verified',
    verified_at=now(),
    notes='FAO-aligned Peach / Prunus persica; verified Commons photo showing peach fruits on the tree.',
    updated_at=now()
where crop_name='Peach';

update public.orchard_crop_photo_registry
set source_photo_url='https://commons.wikimedia.org/wiki/Special:FilePath/Cucurbita_pepo%2C_fruit.jpg',
    photo_url=case when storage_public_url is null then 'https://commons.wikimedia.org/wiki/Special:FilePath/Cucurbita_pepo%2C_fruit.jpg' else photo_url end,
    source_page='https://commons.wikimedia.org/wiki/File:Cucurbita_pepo%2C_fruit.jpg',
    verification_status='verified',
    verified_at=now(),
    notes='FAO-aligned Squash / Cucurbita pepo; verified Commons fruit photograph.',
    updated_at=now()
where crop_name='Squash';

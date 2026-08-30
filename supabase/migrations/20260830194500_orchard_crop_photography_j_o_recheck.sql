-- Correct J-O registry entries that were marked verified but did not render reliably.
update public.orchard_crop_photo_registry set
  photo_url = case crop_name
    when 'Jojoba' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Simmondsia_chinensis_or_Jojoba.jpg'
    when 'Kapok' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Ceiba_pentandra_kapok_hg.jpg'
    when 'Kava' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Kava_Kava.jpg'
    when 'Kenaf' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Kenaf(Hibiscus_cannabinus).jpg'
    when 'Kola nut' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Kola_Nut.jpg'
    when 'Lemon grass' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lemongrass_(Cymbopogon_citratus).jpg'
    when 'Lespedeza (all varieties)' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Lespedeza_cuneata.JPG'
    when 'Liquorice' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Glycyrrhiza_glabra_(Licorice)_(28726871121).jpg'
    when 'Macadamia (Queensland nut)' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Macadamia_nuts.jpg'
    when 'Mace' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Nutmeg_fruit_seed_and_aril.jpg'
    when 'Mangosteen/Mangostano' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Mangosteen.jpg'
    when 'Manioc (cassava)' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Cassava_Plant.jpg'
    when 'Medlar' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Medlar_(Mespilus_germanica)_fruit,_Barrmill_Park,_North_Ayrshire,_Scotland.jpg'
    when 'Millet, Japanese' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Echinochloa_frumentacea.jpg'
    when 'Mulberry for silkworms' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Morus_alba-leaves.jpg'
    when 'Mushrooms' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Agaricus_bisporus_mushroom.jpg'
    when 'Nectarine' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Nectarines.jpg'
    when 'Oats, for fodder' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Green_oat_field.jpg'
    when 'Oats, for grain' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Green_oat_field.jpg'
    when 'Olive' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Olea_europaea_g9.jpg'
    when 'Onion seed' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Onion_Seeds_Plants_1.jpg'
    when 'Opium' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Papaversomniferum.jpg'
    when 'Orange, bitter' then 'https://commons.wikimedia.org/wiki/Special:FilePath/Citrus_aurantium_-_Bitter_orange_01.JPG'
    else photo_url end,
  source_page = case crop_name
    when 'Jojoba' then 'https://commons.wikimedia.org/wiki/File:Simmondsia_chinensis_or_Jojoba.jpg'
    when 'Kapok' then 'https://commons.wikimedia.org/wiki/File:Ceiba_pentandra_kapok_hg.jpg'
    when 'Kava' then 'https://commons.wikimedia.org/wiki/File:Kava_Kava.jpg'
    when 'Kenaf' then 'https://commons.wikimedia.org/wiki/File:Kenaf(Hibiscus_cannabinus).jpg'
    when 'Kola nut' then 'https://commons.wikimedia.org/wiki/File:Kola_Nut.jpg'
    when 'Lemon grass' then 'https://commons.wikimedia.org/wiki/File:Lemongrass_(Cymbopogon_citratus).jpg'
    when 'Lespedeza (all varieties)' then 'https://commons.wikimedia.org/wiki/File:Lespedeza_cuneata.JPG'
    when 'Liquorice' then 'https://commons.wikimedia.org/wiki/File:Glycyrrhiza_glabra_(Licorice)_(28726871121).jpg'
    when 'Macadamia (Queensland nut)' then 'https://commons.wikimedia.org/wiki/File:Macadamia_nuts.jpg'
    when 'Mace' then 'https://commons.wikimedia.org/wiki/File:Nutmeg_fruit_seed_and_aril.jpg'
    when 'Mangosteen/Mangostano' then 'https://commons.wikimedia.org/wiki/File:Mangosteen.jpg'
    when 'Manioc (cassava)' then 'https://commons.wikimedia.org/wiki/File:Cassava_Plant.jpg'
    when 'Medlar' then 'https://commons.wikimedia.org/wiki/File:Medlar_(Mespilus_germanica)_fruit,_Barrmill_Park,_North_Ayrshire,_Scotland.jpg'
    when 'Millet, Japanese' then 'https://commons.wikimedia.org/wiki/File:Echinochloa_frumentacea.jpg'
    when 'Mulberry for silkworms' then 'https://commons.wikimedia.org/wiki/File:Morus_alba-leaves.jpg'
    when 'Mushrooms' then 'https://commons.wikimedia.org/wiki/File:Agaricus_bisporus_mushroom.jpg'
    when 'Nectarine' then 'https://commons.wikimedia.org/wiki/File:Nectarines.jpg'
    when 'Oats, for fodder' then 'https://commons.wikimedia.org/wiki/File:Green_oat_field.jpg'
    when 'Oats, for grain' then 'https://commons.wikimedia.org/wiki/File:Green_oat_field.jpg'
    when 'Olive' then 'https://commons.wikimedia.org/wiki/File:Olea_europaea_g9.jpg'
    when 'Onion seed' then 'https://commons.wikimedia.org/wiki/File:Onion_Seeds_Plants_1.jpg'
    when 'Opium' then 'https://commons.wikimedia.org/wiki/File:Papaversomniferum.jpg'
    when 'Orange, bitter' then 'https://commons.wikimedia.org/wiki/File:Citrus_aurantium_-_Bitter_orange_01.JPG'
    else source_page end,
  verification_status='verified',
  verified_at=now(),
  updated_at=now(),
  notes='Revalidated against live Wikimedia Commons file page after rendered-image QA.'
where crop_name in (
  'Jojoba','Kapok','Kava','Kenaf','Kola nut','Lemon grass','Lespedeza (all varieties)','Liquorice',
  'Macadamia (Queensland nut)','Mace','Mangosteen/Mangostano','Manioc (cassava)','Medlar','Millet, Japanese',
  'Mulberry for silkworms','Mushrooms','Nectarine','Oats, for fodder','Oats, for grain','Olive','Onion seed','Opium','Orange, bitter'
);
alter table public.orchard_crops
  alter column planting_date drop not null;

update public.orchard_crops
set planting_date = null,
    notes = replace(notes, 'planting evidence=unknown-placeholder', 'planting evidence=not-recorded')
where notes ilike '%planting evidence=unknown-placeholder%';

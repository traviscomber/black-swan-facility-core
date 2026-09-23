alter table public.booking_settings
  add column if not exists property_profile jsonb not null default '{}'::jsonb;

update public.booking_settings s
set property_profile = bir.payload
from lateral (
  select payload
  from public.booking_import_records
  where source_system='bedbooking'
    and entity_type='profile_snapshot'
  order by observed_at desc
  limit 1
) bir
where s.id='default'
  and s.property_profile='{}'::jsonb;

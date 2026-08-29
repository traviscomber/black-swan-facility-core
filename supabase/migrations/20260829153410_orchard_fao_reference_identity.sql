alter table public.orchard_crop_library
  add column if not exists external_source text,
  add column if not exists external_id text;

create unique index if not exists orchard_crop_library_external_identity_unique
  on public.orchard_crop_library(external_source, external_id)
  where external_source is not null and external_id is not null;

alter table public.orchard_cultivar_library
  add column if not exists external_source text,
  add column if not exists external_id text;

create unique index if not exists orchard_cultivar_library_external_identity_unique
  on public.orchard_cultivar_library(external_source, external_id)
  where external_source is not null and external_id is not null;

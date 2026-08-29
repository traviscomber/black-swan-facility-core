alter table public.orchard_crop_library
  add column if not exists classification_scheme text,
  add column if not exists classification_code text;

create index if not exists orchard_crop_library_classification_idx
  on public.orchard_crop_library(classification_scheme, classification_code)
  where classification_scheme is not null and classification_code is not null;

alter table public.orchard_farm_settings
  add column if not exists nursery_usable_surface_m2 numeric;

alter table public.orchard_farm_settings
  drop constraint if exists orchard_farm_settings_nursery_usable_surface_m2_check;

alter table public.orchard_farm_settings
  add constraint orchard_farm_settings_nursery_usable_surface_m2_check
  check (nursery_usable_surface_m2 is null or nursery_usable_surface_m2 >= 0);

comment on column public.orchard_farm_settings.nursery_usable_surface_m2 is
  'Operator-confirmed usable nursery tray surface in square metres. Includes usable surface across multiple levels; null means not yet confirmed.';

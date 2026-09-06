alter table public.orchard_farm_settings
  add column if not exists farm_city text,
  add column if not exists farm_state text,
  add column if not exists postal_code text,
  add column if not exists first_weekday text;

comment on column public.orchard_farm_settings.farm_city is 'Canonical farm city used by Orchard settings.';
comment on column public.orchard_farm_settings.farm_state is 'Canonical farm state/region used by Orchard settings.';
comment on column public.orchard_farm_settings.postal_code is 'Canonical farm postal code used by Orchard settings.';
comment on column public.orchard_farm_settings.first_weekday is 'Optional first weekday preference for Orchard calendars; null means not configured.';

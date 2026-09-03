create table if not exists public.orchard_farm_settings (
  id uuid primary key default gen_random_uuid(),
  farm_key text not null unique,
  farm_name text not null,
  country_code text not null default 'CL',
  currency text not null default 'CLP',
  farm_address text,
  latitude double precision,
  longitude double precision,
  measurement_system text not null default 'metric' check (measurement_system in ('metric','imperial')),
  temperature_unit text not null default 'celsius' check (temperature_unit in ('celsius','fahrenheit')),
  planting_amount_unit text not null default 'bed_meter' check (planting_amount_unit in ('bed','bed_meter')),
  standard_bed_width_cm numeric not null check (standard_bed_width_cm > 0),
  standard_bed_length_m numeric not null check (standard_bed_length_m > 0),
  standard_path_width_cm numeric not null check (standard_path_width_cm >= 0),
  last_hard_frost_md text check (last_hard_frost_md is null or last_hard_frost_md ~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$'),
  last_light_frost_md text check (last_light_frost_md is null or last_light_frost_md ~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$'),
  first_light_frost_md text check (first_light_frost_md is null or first_light_frost_md ~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$'),
  first_hard_frost_md text check (first_hard_frost_md is null or first_hard_frost_md ~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$'),
  frost_source text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orchard_farm_settings enable row level security;

drop policy if exists orchard_farm_settings_read on public.orchard_farm_settings;
create policy orchard_farm_settings_read on public.orchard_farm_settings
for select using (public.can_access_orchard_global());

drop policy if exists orchard_farm_settings_write on public.orchard_farm_settings;
create policy orchard_farm_settings_write on public.orchard_farm_settings
for all using (public.can_access_orchard_global())
with check (public.can_access_orchard_global());

grant select, insert, update on public.orchard_farm_settings to authenticated;

create or replace function public.touch_orchard_farm_settings()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_touch_orchard_farm_settings on public.orchard_farm_settings;
create trigger trg_touch_orchard_farm_settings
before update on public.orchard_farm_settings
for each row execute function public.touch_orchard_farm_settings();

insert into public.orchard_farm_settings (
  farm_key,
  farm_name,
  country_code,
  currency,
  farm_address,
  latitude,
  longitude,
  measurement_system,
  temperature_unit,
  planting_amount_unit,
  standard_bed_width_cm,
  standard_bed_length_m,
  standard_path_width_cm,
  last_hard_frost_md,
  last_light_frost_md,
  frost_source
) values (
  'black_swan_orchard',
  'Black Swan Orchard',
  'CL',
  'CLP',
  'Black Swan Farm, Fundo Corcovado, Valdivia, Region de Los Rios, Chile',
  -39.699435,
  -73.205363,
  'metric',
  'celsius',
  'bed_meter',
  76,
  10,
  40,
  '29/08',
  '24/09',
  'heirloom_account_reference'
)
on conflict (farm_key) do nothing;

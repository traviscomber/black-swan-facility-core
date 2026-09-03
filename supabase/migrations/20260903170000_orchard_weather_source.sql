alter table public.orchard_farm_settings
  add column if not exists weather_provider text not null default 'open_meteo',
  add column if not exists weather_timezone text not null default 'America/Santiago',
  add column if not exists weather_enabled boolean not null default true;

update public.orchard_farm_settings
set weather_provider = 'open_meteo',
    weather_timezone = 'America/Santiago',
    weather_enabled = true
where farm_key = 'black_swan_orchard';

alter table public.orchard_farm_map_objects
  add column if not exists satellite_lat double precision,
  add column if not exists satellite_lng double precision,
  add column if not exists satellite_position_source text;

alter table public.orchard_farm_map_objects
  drop constraint if exists orchard_farm_map_objects_satellite_lat_check,
  add constraint orchard_farm_map_objects_satellite_lat_check
    check (satellite_lat is null or (satellite_lat >= -90 and satellite_lat <= 90)),
  drop constraint if exists orchard_farm_map_objects_satellite_lng_check,
  add constraint orchard_farm_map_objects_satellite_lng_check
    check (satellite_lng is null or (satellite_lng >= -180 and satellite_lng <= 180)),
  drop constraint if exists orchard_farm_map_objects_satellite_position_source_check,
  add constraint orchard_farm_map_objects_satellite_position_source_check
    check (
      satellite_position_source is null
      or satellite_position_source = any (
        array['provisional_transform'::text, 'operator'::text, 'surveyed'::text]
      )
    );

comment on column public.orchard_farm_map_objects.satellite_lat is
  'Operator-adjusted or surveyed satellite latitude for the geospatial Farm Map. Null falls back to the provisional x/y transform.';
comment on column public.orchard_farm_map_objects.satellite_lng is
  'Operator-adjusted or surveyed satellite longitude for the geospatial Farm Map. Null falls back to the provisional x/y transform.';
comment on column public.orchard_farm_map_objects.satellite_position_source is
  'Provenance for satellite_lat/lng: provisional_transform, operator, or surveyed.';

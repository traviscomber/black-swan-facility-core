alter table public.gis_overlays
  add column if not exists derived_geojson_url text,
  add column if not exists derived_source_version text,
  add column if not exists derived_feature_count integer,
  add column if not exists derived_generated_at timestamptz;

comment on column public.gis_overlays.derived_geojson_url is
  'Versioned runtime GeoJSON derivative. Original file_url remains authoritative.';

comment on column public.gis_overlays.derived_source_version is
  'Source version used to generate the current runtime derivative.';

comment on column public.gis_overlays.derived_feature_count is
  'Feature count of the current runtime GeoJSON derivative.';

comment on column public.gis_overlays.derived_generated_at is
  'Timestamp when the current runtime GeoJSON derivative was generated.';

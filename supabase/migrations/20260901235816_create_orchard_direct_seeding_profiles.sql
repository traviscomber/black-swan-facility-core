-- Direct-seeding reference profiles for Orchard.
--
-- This migration is intentionally additive. It does not mutate existing crop
-- successions, seed lots, inventory movements, or nursery batches.
--
-- Canonical use case: preserve Black Swan Crop Chart / Ds Chart recipes with
-- their native units instead of coercing grams or tubers into quantity_seeds.

create table if not exists public.orchard_direct_seeding_profiles (
  id uuid primary key default gen_random_uuid(),
  crop_library_id uuid not null references public.orchard_crop_library(id) on delete cascade,
  cultivar_library_id uuid references public.orchard_cultivar_library(id) on delete set null,

  seeding_method text not null default 'direct_sow',
  seeder_name text,
  rows_per_bed numeric,
  row_spacing_cm numeric,
  plant_spacing_cm numeric,
  calibration_setting text,

  demand_value numeric,
  demand_unit text,
  reference_bed_m numeric not null default 30,

  source_name text,
  source_sheet text,
  source_row integer,
  source_url text,
  provenance_type text not null default 'reference',
  source_verified_at timestamptz,
  conflict_status text not null default 'none',
  conflict_notes text,
  notes text,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orchard_direct_seeding_profiles_method_check
    check (seeding_method in ('direct_sow', 'by_hand', 'transplanter', 'other')),
  constraint orchard_direct_seeding_profiles_demand_unit_check
    check (demand_unit is null or demand_unit in ('seed_count', 'g', 'kg', 'tuber_count')),
  constraint orchard_direct_seeding_profiles_reference_bed_check
    check (reference_bed_m > 0),
  constraint orchard_direct_seeding_profiles_demand_check
    check (demand_value is null or demand_value >= 0),
  constraint orchard_direct_seeding_profiles_rows_check
    check (rows_per_bed is null or rows_per_bed > 0),
  constraint orchard_direct_seeding_profiles_spacing_check
    check ((row_spacing_cm is null or row_spacing_cm > 0) and (plant_spacing_cm is null or plant_spacing_cm > 0)),
  constraint orchard_direct_seeding_profiles_provenance_check
    check (provenance_type in ('manual', 'observed', 'reference')),
  constraint orchard_direct_seeding_profiles_conflict_check
    check (conflict_status in ('none', 'source_conflict', 'needs_review'))
);

create index if not exists orchard_direct_seeding_profiles_crop_idx
  on public.orchard_direct_seeding_profiles(crop_library_id)
  where is_active;

create index if not exists orchard_direct_seeding_profiles_cultivar_idx
  on public.orchard_direct_seeding_profiles(cultivar_library_id)
  where is_active and cultivar_library_id is not null;

create index if not exists orchard_direct_seeding_profiles_source_idx
  on public.orchard_direct_seeding_profiles(source_name, source_sheet, source_row);

create unique index if not exists orchard_direct_seeding_profiles_source_row_uniq
  on public.orchard_direct_seeding_profiles(crop_library_id, coalesce(cultivar_library_id, '00000000-0000-0000-0000-000000000000'::uuid), source_name, source_sheet, source_row)
  where source_name is not null and source_sheet is not null and source_row is not null;

alter table public.orchard_direct_seeding_profiles enable row level security;

create policy orchard_direct_seeding_profiles_scoped
  on public.orchard_direct_seeding_profiles
  for all
  to authenticated
  using (public.can_access_orchard_global())
  with check (public.can_access_orchard_global());

comment on table public.orchard_direct_seeding_profiles is
  'Unit-aware direct-seeding operating references. Preserves Crop Chart / Ds Chart provenance and conflicts without coercing grams or tubers into seed-count inventory.';

comment on column public.orchard_direct_seeding_profiles.demand_value is
  'Reference material demand for reference_bed_m. Interpret only together with demand_unit.';

comment on column public.orchard_direct_seeding_profiles.demand_unit is
  'Native planning unit: seed_count, g, kg, or tuber_count. Unlike units must never be summed together.';

comment on column public.orchard_direct_seeding_profiles.conflict_status is
  'Marks unresolved disagreement between canonical workbook sources; source_conflict must not be auto-applied.';

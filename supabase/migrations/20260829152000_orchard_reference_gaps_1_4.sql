begin;

create table if not exists public.orchard_crop_library (
  id uuid primary key default gen_random_uuid(),
  crop_name text not null,
  scientific_name text,
  crop_family text,
  category text,
  default_cycle_type text check (default_cycle_type is null or default_cycle_type in ('direct_sow','transplant','perennial','cover_crop')),
  days_to_maturity integer check (days_to_maturity is null or days_to_maturity > 0),
  nursery_days integer check (nursery_days is null or nursery_days >= 0),
  plant_spacing_cm numeric check (plant_spacing_cm is null or plant_spacing_cm > 0),
  row_spacing_cm numeric check (row_spacing_cm is null or row_spacing_cm > 0),
  germination_rate_pct numeric check (germination_rate_pct is null or (germination_rate_pct > 0 and germination_rate_pct <= 100)),
  seeds_per_plant numeric check (seeds_per_plant is null or seeds_per_plant > 0),
  target_yield_per_sqm numeric check (target_yield_per_sqm is null or target_yield_per_sqm >= 0),
  yield_unit text,
  min_temp_c numeric,
  max_temp_c numeric,
  sun_hours numeric check (sun_hours is null or sun_hours >= 0),
  water_notes text,
  soil_notes text,
  rotation_notes text,
  source_name text,
  source_url text,
  source_verified_at timestamptz,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_crop_library_temp_order check (min_temp_c is null or max_temp_c is null or max_temp_c >= min_temp_c)
);
create unique index if not exists orchard_crop_library_name_unique on public.orchard_crop_library (lower(crop_name));

create table if not exists public.orchard_cultivar_library (
  id uuid primary key default gen_random_uuid(),
  crop_library_id uuid not null references public.orchard_crop_library(id) on delete cascade,
  variety text not null,
  days_to_maturity integer check (days_to_maturity is null or days_to_maturity > 0),
  nursery_days integer check (nursery_days is null or nursery_days >= 0),
  plant_spacing_cm numeric check (plant_spacing_cm is null or plant_spacing_cm > 0),
  row_spacing_cm numeric check (row_spacing_cm is null or row_spacing_cm > 0),
  germination_rate_pct numeric check (germination_rate_pct is null or (germination_rate_pct > 0 and germination_rate_pct <= 100)),
  seeds_per_plant numeric check (seeds_per_plant is null or seeds_per_plant > 0),
  target_yield_per_sqm numeric check (target_yield_per_sqm is null or target_yield_per_sqm >= 0),
  notes text,
  source_name text,
  source_url text,
  source_verified_at timestamptz,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists orchard_cultivar_library_unique on public.orchard_cultivar_library (crop_library_id, lower(variety));

create table if not exists public.orchard_sales_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel_type text not null default 'other' check (channel_type in ('farm_gate','restaurant','wholesale','market','subscription','internal','other')),
  status text not null default 'active' check (status in ('active','inactive')),
  default_price_per_unit numeric check (default_price_per_unit is null or default_price_per_unit >= 0),
  default_unit text,
  currency text not null default 'CLP',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists orchard_sales_channels_name_unique on public.orchard_sales_channels (lower(name));

create table if not exists public.orchard_revenue_targets (
  id uuid primary key default gen_random_uuid(),
  crop_succession_id uuid not null references public.orchard_crop_successions(id) on delete cascade,
  sales_channel_id uuid references public.orchard_sales_channels(id) on delete set null,
  planned_quantity numeric not null check (planned_quantity >= 0),
  unit text not null,
  target_price_per_unit numeric not null check (target_price_per_unit >= 0),
  planned_revenue numeric generated always as (planned_quantity * target_price_per_unit) stored,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orchard_revenue_targets_succession on public.orchard_revenue_targets(crop_succession_id);
create index if not exists idx_orchard_revenue_targets_channel on public.orchard_revenue_targets(sales_channel_id);

alter table public.orchard_harvest_records add column if not exists sales_channel_id uuid references public.orchard_sales_channels(id) on delete set null;
create index if not exists idx_orchard_harvest_records_sales_channel on public.orchard_harvest_records(sales_channel_id);

create table if not exists public.orchard_chart_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dataset text not null check (dataset in ('harvest','care','health','nursery','performance','commercial')),
  metric text not null,
  dimension text not null,
  crop_filter text,
  variety_filter text,
  unit_filter text,
  is_shared boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orchard_chart_definitions_creator on public.orchard_chart_definitions(created_by, updated_at desc);

alter table public.orchard_crop_library enable row level security;
alter table public.orchard_cultivar_library enable row level security;
alter table public.orchard_sales_channels enable row level security;
alter table public.orchard_revenue_targets enable row level security;
alter table public.orchard_chart_definitions enable row level security;

drop policy if exists orchard_crop_library_scoped on public.orchard_crop_library;
create policy orchard_crop_library_scoped on public.orchard_crop_library for all to authenticated using (public.can_access_orchard_global()) with check (public.can_access_orchard_global());
drop policy if exists orchard_cultivar_library_scoped on public.orchard_cultivar_library;
create policy orchard_cultivar_library_scoped on public.orchard_cultivar_library for all to authenticated using (public.can_access_orchard_global()) with check (public.can_access_orchard_global());
drop policy if exists orchard_sales_channels_scoped on public.orchard_sales_channels;
create policy orchard_sales_channels_scoped on public.orchard_sales_channels for all to authenticated using (public.can_access_orchard_global()) with check (public.can_access_orchard_global());
drop policy if exists orchard_revenue_targets_scoped on public.orchard_revenue_targets;
create policy orchard_revenue_targets_scoped on public.orchard_revenue_targets for all to authenticated using (public.can_access_orchard_succession(crop_succession_id)) with check (public.can_access_orchard_succession(crop_succession_id));
drop policy if exists orchard_chart_definitions_scoped on public.orchard_chart_definitions;
create policy orchard_chart_definitions_scoped on public.orchard_chart_definitions for all to authenticated using (created_by = auth.uid() or (is_shared and public.can_access_orchard_global()) or public.current_app_role() = 'admin') with check (created_by = auth.uid() and public.can_access_orchard_global());

create or replace function public.orchard_auto_place_succession(
  p_succession_id uuid,
  p_plot_id uuid,
  p_start_date date,
  p_end_date date,
  p_required_area_sqm numeric default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_remaining numeric;
  v_bed record;
  v_area numeric;
  v_created uuid[] := array[]::uuid[];
  v_created_id uuid;
begin
  if not public.can_access_orchard_succession(p_succession_id) then raise exception 'Not authorized for succession'; end if;
  if not public.can_access_orchard_plot(p_plot_id) then raise exception 'Not authorized for plot'; end if;
  if p_end_date < p_start_date then raise exception 'End date must be on or after start date'; end if;
  select coalesce(p_required_area_sqm, s.planned_area_sqm, 0) into v_remaining from public.orchard_crop_successions s where s.id = p_succession_id;
  if v_remaining <= 0 then raise exception 'A positive required area is needed'; end if;

  for v_bed in
    select b.id, b.area_sqm, b.length_m, b.width_m
    from public.orchard_beds b
    where b.plot_id = p_plot_id and b.status = 'active'
      and not exists (
        select 1 from public.orchard_bed_allocations a
        where a.bed_id = b.id
          and daterange(a.planned_start_date, a.planned_end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
      )
    order by coalesce(b.code, b.name), b.id
    for update
  loop
    v_area := coalesce(v_bed.area_sqm, coalesce(v_bed.length_m,0) * coalesce(v_bed.width_m,0));
    if v_area <= 0 then continue; end if;
    v_area := least(v_area, v_remaining);
    insert into public.orchard_bed_allocations(bed_id, crop_succession_id, planned_start_date, planned_end_date, allocated_area_sqm, notes)
    values(v_bed.id, p_succession_id, p_start_date, p_end_date, v_area, 'Auto-placed across available beds')
    returning id into v_created_id;
    v_created := array_append(v_created, v_created_id);
    v_remaining := v_remaining - v_area;
    exit when v_remaining <= 0;
  end loop;

  if v_remaining > 0 then raise exception 'Insufficient conflict-free bed area in selected plot'; end if;
  return jsonb_build_object('allocation_ids', to_jsonb(v_created), 'allocated_area_sqm', coalesce(p_required_area_sqm, (select planned_area_sqm from public.orchard_crop_successions where id=p_succession_id)));
end;
$$;
revoke all on function public.orchard_auto_place_succession(uuid,uuid,date,date,numeric) from public, anon;
grant execute on function public.orchard_auto_place_succession(uuid,uuid,date,date,numeric) to authenticated;

commit;

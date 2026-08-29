create extension if not exists btree_gist;

create table if not exists public.orchard_beds (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.orchard_plots(id) on delete cascade,
  name text not null,
  code text,
  length_m numeric check (length_m is null or length_m > 0),
  width_m numeric check (width_m is null or width_m > 0),
  area_sqm numeric generated always as (case when length_m is not null and width_m is not null then length_m * width_m else null end) stored,
  status text not null default 'active' check (status in ('active', 'resting', 'cover_crop', 'out_of_service')),
  orientation text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_beds_plot_name_unique unique (plot_id, name)
);

create table if not exists public.orchard_bed_allocations (
  id uuid primary key default gen_random_uuid(),
  bed_id uuid not null references public.orchard_beds(id) on delete cascade,
  crop_succession_id uuid not null references public.orchard_crop_successions(id) on delete cascade,
  planned_start_date date not null,
  planned_end_date date not null,
  allocated_area_sqm numeric check (allocated_area_sqm is null or allocated_area_sqm > 0),
  planned_plants integer check (planned_plants is null or planned_plants >= 0),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_bed_allocations_date_order check (planned_end_date >= planned_start_date),
  constraint orchard_bed_allocations_no_overlap exclude using gist (
    bed_id with =,
    daterange(planned_start_date, planned_end_date, '[]') with &&
  )
);

create index if not exists orchard_beds_plot_idx on public.orchard_beds(plot_id);
create index if not exists orchard_bed_allocations_succession_idx on public.orchard_bed_allocations(crop_succession_id);
create index if not exists orchard_bed_allocations_bed_idx on public.orchard_bed_allocations(bed_id);

alter table public.orchard_beds enable row level security;
alter table public.orchard_bed_allocations enable row level security;
grant select, insert, update, delete on public.orchard_beds to authenticated;
grant select, insert, update, delete on public.orchard_bed_allocations to authenticated;

drop policy if exists "Internal staff can manage orchard_beds" on public.orchard_beds;
create policy "Internal staff can manage orchard_beds" on public.orchard_beds for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));

drop policy if exists "Internal staff can manage orchard_bed_allocations" on public.orchard_bed_allocations;
create policy "Internal staff can manage orchard_bed_allocations" on public.orchard_bed_allocations for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));
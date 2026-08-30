-- Orchard food-demand planning: demand scenarios and crop-level consumption targets.
-- Demand assumptions live here; supply and import gaps remain derived from canonical Orchard tables.

create table if not exists public.orchard_demand_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  resident_people integer not null default 0 check (resident_people >= 0),
  staff_people integer not null default 0 check (staff_people >= 0),
  manual_people integer not null default 0 check (manual_people >= 0),
  include_bookings boolean not null default true,
  self_sufficiency_target_pct numeric(5,2) not null default 100 check (self_sufficiency_target_pct between 0 and 100),
  waste_pct numeric(5,2) not null default 10 check (waste_pct between 0 and 100),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.orchard_demand_crop_targets (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.orchard_demand_scenarios(id) on delete cascade,
  crop_name text not null,
  consumption_kg_per_person_week numeric(10,4) not null default 0 check (consumption_kg_per_person_week >= 0),
  target_share_pct numeric(5,2) not null default 100 check (target_share_pct between 0 and 100),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scenario_id, crop_name)
);

create index if not exists orchard_demand_scenarios_window_idx
  on public.orchard_demand_scenarios (start_date, end_date, status);
create index if not exists orchard_demand_crop_targets_scenario_idx
  on public.orchard_demand_crop_targets (scenario_id);

alter table public.orchard_demand_scenarios enable row level security;
alter table public.orchard_demand_crop_targets enable row level security;

drop policy if exists orchard_demand_scenarios_scoped on public.orchard_demand_scenarios;
create policy orchard_demand_scenarios_scoped
  on public.orchard_demand_scenarios
  for all
  using (public.can_access_orchard_global())
  with check (public.can_access_orchard_global());

drop policy if exists orchard_demand_crop_targets_scoped on public.orchard_demand_crop_targets;
create policy orchard_demand_crop_targets_scoped
  on public.orchard_demand_crop_targets
  for all
  using (public.can_access_orchard_global())
  with check (public.can_access_orchard_global());

comment on table public.orchard_demand_scenarios is
  'Demand assumptions for residents, staff, manual headcount and future bookings. Supply is derived from canonical Orchard planning/execution tables.';
comment on table public.orchard_demand_crop_targets is
  'Crop-level weekly consumption assumptions attached to an Orchard demand scenario.';

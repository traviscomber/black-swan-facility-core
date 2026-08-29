create table if not exists public.orchard_game_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  objective text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_game_plans_date_order check (end_date >= start_date)
);

create table if not exists public.orchard_crop_cycles (
  id uuid primary key default gen_random_uuid(),
  game_plan_id uuid not null references public.orchard_game_plans(id) on delete cascade,
  orchard_crop_id uuid references public.orchard_crops(id) on delete set null,
  crop_name text not null,
  variety text,
  cycle_type text not null default 'direct_sow' check (cycle_type in ('direct_sow', 'transplant', 'perennial', 'cover_crop')),
  planned_start_date date not null,
  target_harvest_date date,
  status text not null default 'planned' check (status in ('planned', 'nursery', 'planted', 'growing', 'harvest_ready', 'completed', 'cancelled')),
  planned_area_sqm numeric check (planned_area_sqm is null or planned_area_sqm >= 0),
  target_quantity numeric check (target_quantity is null or target_quantity >= 0),
  target_unit text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_crop_cycles_date_order check (target_harvest_date is null or target_harvest_date >= planned_start_date)
);

create index if not exists orchard_crop_cycles_game_plan_idx on public.orchard_crop_cycles(game_plan_id);
create index if not exists orchard_crop_cycles_status_idx on public.orchard_crop_cycles(status);
create index if not exists orchard_crop_cycles_target_harvest_idx on public.orchard_crop_cycles(target_harvest_date);

alter table public.orchard_game_plans enable row level security;
alter table public.orchard_crop_cycles enable row level security;

grant select, insert, update, delete on public.orchard_game_plans to authenticated;
grant select, insert, update, delete on public.orchard_crop_cycles to authenticated;

drop policy if exists "Internal staff can manage orchard_game_plans" on public.orchard_game_plans;
create policy "Internal staff can manage orchard_game_plans"
on public.orchard_game_plans
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));

drop policy if exists "Internal staff can manage orchard_crop_cycles" on public.orchard_crop_cycles;
create policy "Internal staff can manage orchard_crop_cycles"
on public.orchard_crop_cycles
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));
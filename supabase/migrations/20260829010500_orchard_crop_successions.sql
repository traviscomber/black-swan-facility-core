create table if not exists public.orchard_crop_successions (
  id uuid primary key default gen_random_uuid(),
  crop_cycle_id uuid not null references public.orchard_crop_cycles(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  planned_sow_date date not null,
  planned_transplant_date date,
  planned_first_harvest_date date,
  planned_last_harvest_date date,
  days_to_maturity integer check (days_to_maturity is null or days_to_maturity > 0),
  planned_plants integer check (planned_plants is null or planned_plants >= 0),
  planned_area_sqm numeric check (planned_area_sqm is null or planned_area_sqm >= 0),
  plant_spacing_cm numeric check (plant_spacing_cm is null or plant_spacing_cm > 0),
  row_spacing_cm numeric check (row_spacing_cm is null or row_spacing_cm > 0),
  germination_rate_pct numeric default 85 check (germination_rate_pct is null or (germination_rate_pct > 0 and germination_rate_pct <= 100)),
  seeds_per_plant numeric default 1 check (seeds_per_plant is null or seeds_per_plant > 0),
  status text not null default 'planned' check (status in ('planned', 'sown', 'transplanted', 'harvesting', 'completed', 'cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_crop_successions_unique_sequence unique (crop_cycle_id, sequence_no),
  constraint orchard_crop_successions_transplant_order check (planned_transplant_date is null or planned_transplant_date >= planned_sow_date),
  constraint orchard_crop_successions_first_harvest_order check (planned_first_harvest_date is null or planned_first_harvest_date >= planned_sow_date),
  constraint orchard_crop_successions_last_harvest_order check (planned_last_harvest_date is null or (planned_first_harvest_date is not null and planned_last_harvest_date >= planned_first_harvest_date))
);

create index if not exists orchard_crop_successions_cycle_idx on public.orchard_crop_successions(crop_cycle_id);
create index if not exists orchard_crop_successions_sow_date_idx on public.orchard_crop_successions(planned_sow_date);
create index if not exists orchard_crop_successions_harvest_date_idx on public.orchard_crop_successions(planned_first_harvest_date);
create index if not exists orchard_crop_successions_status_idx on public.orchard_crop_successions(status);

alter table public.orchard_crop_successions enable row level security;
grant select, insert, update, delete on public.orchard_crop_successions to authenticated;

drop policy if exists "Internal staff can manage orchard_crop_successions" on public.orchard_crop_successions;
create policy "Internal staff can manage orchard_crop_successions"
on public.orchard_crop_successions
for all
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));
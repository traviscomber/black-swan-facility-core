create table if not exists public.orchard_seed_lots (
  id uuid primary key default gen_random_uuid(),
  crop_name text not null,
  variety text,
  lot_code text,
  supplier text,
  quantity_seeds integer not null default 0 check (quantity_seeds >= 0),
  germination_rate_pct numeric check (germination_rate_pct is null or (germination_rate_pct > 0 and germination_rate_pct <= 100)),
  received_date date,
  expiry_date date,
  storage_location text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orchard_nursery_batches (
  id uuid primary key default gen_random_uuid(),
  crop_succession_id uuid not null references public.orchard_crop_successions(id) on delete cascade,
  seed_lot_id uuid references public.orchard_seed_lots(id) on delete set null,
  sow_date date not null,
  cells_sown integer check (cells_sown is null or cells_sown >= 0),
  seeds_sown integer not null default 0 check (seeds_sown >= 0),
  emerged_count integer check (emerged_count is null or emerged_count >= 0),
  ready_count integer check (ready_count is null or ready_count >= 0),
  transplanted_count integer check (transplanted_count is null or transplanted_count >= 0),
  expected_ready_date date,
  actual_ready_date date,
  transplant_date date,
  status text not null default 'sown' check (status in ('planned','sown','germinating','growing','ready','transplanted','completed','failed','cancelled')),
  location text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orchard_nursery_counts_valid check (
    (emerged_count is null or emerged_count <= seeds_sown) and
    (ready_count is null or emerged_count is null or ready_count <= emerged_count) and
    (transplanted_count is null or ready_count is null or transplanted_count <= ready_count)
  )
);

create index if not exists orchard_seed_lots_crop_idx on public.orchard_seed_lots(crop_name, variety);
create index if not exists orchard_nursery_batches_succession_idx on public.orchard_nursery_batches(crop_succession_id);
create index if not exists orchard_nursery_batches_status_idx on public.orchard_nursery_batches(status);

alter table public.orchard_seed_lots enable row level security;
alter table public.orchard_nursery_batches enable row level security;
grant select, insert, update, delete on public.orchard_seed_lots to authenticated;
grant select, insert, update, delete on public.orchard_nursery_batches to authenticated;

drop policy if exists "Internal staff can manage orchard_seed_lots" on public.orchard_seed_lots;
create policy "Internal staff can manage orchard_seed_lots" on public.orchard_seed_lots for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));

drop policy if exists "Internal staff can manage orchard_nursery_batches" on public.orchard_nursery_batches;
create policy "Internal staff can manage orchard_nursery_batches" on public.orchard_nursery_batches for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']))
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));
begin;

create table if not exists public.hospitality_shopping_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null default 'unit',
  notes text,
  status text not null default 'needed'
    check (status in ('needed','sourcing','orchard_requested','purchase_requested','ready','completed','cancelled')),
  source_strategy text not null default 'either'
    check (source_strategy in ('orchard','purchase','either')),
  assigned_to uuid references public.employees(id) on delete set null,
  orchard_crop_id uuid references public.orchard_crops(id) on delete set null,
  procurement_request_id uuid references public.procurement_requests(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  hospitality_request_id uuid references public.hospitality_requests(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  required_date date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hospitality_shopping_items_status_idx
  on public.hospitality_shopping_items(status, required_date);
create index if not exists hospitality_shopping_items_assigned_idx
  on public.hospitality_shopping_items(assigned_to);
create index if not exists hospitality_shopping_items_location_idx
  on public.hospitality_shopping_items(location_id);

alter table public.hospitality_shopping_items enable row level security;

revoke all on table public.hospitality_shopping_items from anon;
grant select, insert, update on table public.hospitality_shopping_items to authenticated;
grant all on table public.hospitality_shopping_items to service_role;

drop policy if exists hospitality_shopping_items_select_scoped on public.hospitality_shopping_items;
create policy hospitality_shopping_items_select_scoped
on public.hospitality_shopping_items
for select
to authenticated
using (can_access_operational_scope('hospitality', location_id));

drop policy if exists hospitality_shopping_items_insert_authorized on public.hospitality_shopping_items;
create policy hospitality_shopping_items_insert_authorized
on public.hospitality_shopping_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and can_app_action('hospitality.operate')
  and can_access_operational_scope('hospitality', location_id)
);

drop policy if exists hospitality_shopping_items_update_authorized on public.hospitality_shopping_items;
create policy hospitality_shopping_items_update_authorized
on public.hospitality_shopping_items
for update
to authenticated
using (
  can_app_action('hospitality.operate')
  and can_access_operational_scope('hospitality', location_id)
)
with check (
  can_app_action('hospitality.operate')
  and can_access_operational_scope('hospitality', location_id)
);

commit;

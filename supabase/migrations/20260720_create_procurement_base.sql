create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  rut text,
  address text,
  commune text default 'Valdivia',
  region text default 'Los Ríos',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_rut_unique_idx
  on public.suppliers(rut)
  where rut is not null;

create table if not exists public.procurement_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  total_cost numeric(16, 2) not null default 0 check (total_cost >= 0),
  status text not null default 'pending' check (status in ('pending', 'ordered', 'delivered', 'cancelled')),
  expected_delivery date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procurement_items_supplier_idx
  on public.procurement_items(supplier_id);

create index if not exists procurement_items_status_idx
  on public.procurement_items(status);

create or replace function public.set_procurement_base_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_procurement_base_updated_at();

drop trigger if exists procurement_items_set_updated_at on public.procurement_items;
create trigger procurement_items_set_updated_at
before update on public.procurement_items
for each row execute function public.set_procurement_base_updated_at();

grant select, insert, update, delete on public.suppliers to anon, authenticated;
grant select, insert, update, delete on public.procurement_items to anon, authenticated;

comment on table public.suppliers is
  'Supplier directory used by the procurement purchase-order workflow.';

comment on table public.procurement_items is
  'Existing purchase-order records used by the procurement UI and analytics.';
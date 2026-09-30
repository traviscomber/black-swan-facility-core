create table if not exists public.procurement_external_purchases (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'lider' check (provider in ('lider')),
  external_order_number text not null,
  purchased_at timestamptz not null,
  buyer_name text,
  total_clp numeric(14,2) not null check (total_clp >= 0),
  fulfillment_type text check (fulfillment_type is null or fulfillment_type in ('delivery','pickup')),
  cost_center text,
  document_url text,
  notes text,
  status text not null default 'purchased' check (status in ('purchased','received','reconciled')),
  source_type text not null default 'manual' check (source_type in ('manual','document','csv','email','api')),
  consolidated_at timestamptz not null default now(),
  consolidated_by uuid not null default auth.uid(),
  received_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_order_number)
);

create table if not exists public.procurement_external_purchase_items (
  id uuid primary key default gen_random_uuid(),
  external_purchase_id uuid not null references public.procurement_external_purchases(id) on delete cascade,
  product_name text not null,
  external_sku text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'unidad',
  unit_price_clp numeric(14,2) check (unit_price_clp is null or unit_price_clp >= 0),
  line_total_clp numeric(14,2) check (line_total_clp is null or line_total_clp >= 0),
  inventory_stock_item_id uuid references public.inventory_stock_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists procurement_external_purchases_date_idx
  on public.procurement_external_purchases(purchased_at desc);
create index if not exists procurement_external_purchases_status_idx
  on public.procurement_external_purchases(status, purchased_at desc);
create index if not exists procurement_external_purchase_items_purchase_idx
  on public.procurement_external_purchase_items(external_purchase_id);

alter table public.procurement_external_purchases enable row level security;
alter table public.procurement_external_purchase_items enable row level security;

revoke all on public.procurement_external_purchases from anon, authenticated;
revoke all on public.procurement_external_purchase_items from anon, authenticated;
grant select, insert, update on public.procurement_external_purchases to authenticated;
grant select, insert, update on public.procurement_external_purchase_items to authenticated;

create policy external_purchases_procurement_select
on public.procurement_external_purchases for select to authenticated
using (public.can_app_action('procurement.operate'));

create policy external_purchases_procurement_insert
on public.procurement_external_purchases for insert to authenticated
with check (
  public.can_app_action('procurement.operate')
  and consolidated_by = (select auth.uid())
);

create policy external_purchases_procurement_update
on public.procurement_external_purchases for update to authenticated
using (public.can_app_action('procurement.manage'))
with check (public.can_app_action('procurement.manage'));

create policy external_purchase_items_procurement_select
on public.procurement_external_purchase_items for select to authenticated
using (
  exists (
    select 1 from public.procurement_external_purchases p
    where p.id = external_purchase_id
      and public.can_app_action('procurement.operate')
  )
);

create policy external_purchase_items_procurement_insert
on public.procurement_external_purchase_items for insert to authenticated
with check (
  exists (
    select 1 from public.procurement_external_purchases p
    where p.id = external_purchase_id
      and public.can_app_action('procurement.operate')
  )
);

create policy external_purchase_items_procurement_update
on public.procurement_external_purchase_items for update to authenticated
using (public.can_app_action('procurement.manage'))
with check (public.can_app_action('procurement.manage'));

create or replace function public.set_external_purchase_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger procurement_external_purchases_updated_at
before update on public.procurement_external_purchases
for each row execute function public.set_external_purchase_updated_at();

comment on table public.procurement_external_purchases is
  'Canonical ledger of purchases executed outside Black Swan, initially Lider App.';
comment on column public.procurement_external_purchases.external_order_number is
  'Provider order identifier. Unique with provider to make consolidation idempotent.';

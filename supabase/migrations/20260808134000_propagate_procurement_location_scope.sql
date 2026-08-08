-- Stage 6: propagate canonical location identity through Procurement.
-- Legacy rows remain nullable. New authenticated requests must carry a scoped location_id.

alter table public.procurement_purchase_orders
  add column if not exists location_id uuid references public.locations(id) on delete restrict;

alter table public.procurement_receipts
  add column if not exists location_id uuid references public.locations(id) on delete restrict;

alter table public.procurement_inventory_intake
  add column if not exists location_id uuid references public.locations(id) on delete restrict;

create index if not exists idx_procurement_purchase_orders_location_id
  on public.procurement_purchase_orders(location_id);
create index if not exists idx_procurement_receipts_location_id
  on public.procurement_receipts(location_id);
create index if not exists idx_procurement_inventory_intake_location_id
  on public.procurement_inventory_intake(location_id);

create or replace function public.guard_procurement_request_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    if coalesce(auth.role(), '') = 'service_role' then
      return new;
    end if;
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' and new.location_id is null then
    raise exception 'Canonical procurement location is required';
  end if;

  if new.location_id is distinct from old.location_id or tg_op = 'INSERT' then
    if new.location_id is not null
       and not public.can_access_operational_scope('procurement', new.location_id) then
      raise exception 'Procurement location is outside your operational scope';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_procurement_request_location() from public, anon, authenticated;
grant execute on function public.guard_procurement_request_location() to service_role;

drop trigger if exists procurement_requests_guard_location on public.procurement_requests;
create trigger procurement_requests_guard_location
before insert or update of location_id on public.procurement_requests
for each row execute function public.guard_procurement_request_location();

create or replace function public.propagate_procurement_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'procurement_purchase_orders' then
    select r.location_id into new.location_id
    from public.procurement_requests r
    where r.id = new.request_id;
  elsif tg_table_name = 'procurement_receipts' then
    select po.location_id into new.location_id
    from public.procurement_purchase_orders po
    where po.id = new.purchase_order_id;
  elsif tg_table_name = 'procurement_inventory_intake' then
    select pr.location_id into new.location_id
    from public.procurement_receipt_items ri
    join public.procurement_receipts pr on pr.id = ri.receipt_id
    where ri.id = new.receipt_item_id;
  end if;
  return new;
end;
$$;

revoke all on function public.propagate_procurement_location() from public, anon, authenticated;
grant execute on function public.propagate_procurement_location() to service_role;

drop trigger if exists procurement_purchase_orders_propagate_location on public.procurement_purchase_orders;
create trigger procurement_purchase_orders_propagate_location
before insert or update of request_id on public.procurement_purchase_orders
for each row execute function public.propagate_procurement_location();

drop trigger if exists procurement_receipts_propagate_location on public.procurement_receipts;
create trigger procurement_receipts_propagate_location
before insert or update of purchase_order_id on public.procurement_receipts
for each row execute function public.propagate_procurement_location();

drop trigger if exists procurement_inventory_intake_propagate_location on public.procurement_inventory_intake;
create trigger procurement_inventory_intake_propagate_location
before insert or update of receipt_item_id on public.procurement_inventory_intake
for each row execute function public.propagate_procurement_location();

create or replace function public.get_procurement_location_directory()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id, l.name
  from public.locations l
  where auth.uid() is not null
    and public.can_access_operational_scope('procurement', l.id)
  order by l.name;
$$;

revoke all on function public.get_procurement_location_directory() from public, anon;
grant execute on function public.get_procurement_location_directory() to authenticated, service_role;

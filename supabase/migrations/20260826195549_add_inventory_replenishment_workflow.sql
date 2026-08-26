alter table public.procurement_requests drop constraint if exists procurement_requests_status_check;
alter table public.procurement_requests
  add constraint procurement_requests_status_check
  check (status in ('draft','submitted','under_review','approved','approved_for_quotation','final_approved','rejected','converted'));

alter table public.procurement_purchase_orders drop constraint if exists procurement_purchase_orders_status_check;
alter table public.procurement_purchase_orders
  add constraint procurement_purchase_orders_status_check
  check (status in ('draft','ready_to_issue','issued','acknowledged','confirmed','partially_received','received','cancelled'));

create unique index if not exists procurement_purchase_orders_one_active_per_request_uidx
  on public.procurement_purchase_orders(request_id)
  where status <> 'cancelled';

create table if not exists public.inventory_replenishment_needs (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.inventory_stock_items(id) on delete cascade,
  status text not null default 'open' check (status in ('open','requested','approved','ordered','receiving','fulfilled','rejected','cancelled')),
  trigger_quantity numeric not null check (trigger_quantity >= 0),
  minimum_stock numeric not null check (minimum_stock >= 0),
  suggested_quantity numeric not null check (suggested_quantity > 0),
  requested_quantity numeric check (requested_quantity is null or requested_quantity > 0),
  procurement_request_id uuid references public.procurement_requests(id) on delete set null,
  purchase_order_id uuid references public.procurement_purchase_orders(id) on delete set null,
  opened_at timestamptz not null default now(),
  requested_at timestamptz,
  approved_at timestamptz,
  ordered_at timestamptz,
  receiving_at timestamptz,
  fulfilled_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  last_event_at timestamptz not null default now(),
  resolution_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_replenishment_one_active_per_stock_uidx
  on public.inventory_replenishment_needs(stock_item_id)
  where status in ('open','requested','approved','ordered','receiving');
create index if not exists inventory_replenishment_request_idx on public.inventory_replenishment_needs(procurement_request_id) where procurement_request_id is not null;
create index if not exists inventory_replenishment_order_idx on public.inventory_replenishment_needs(purchase_order_id) where purchase_order_id is not null;
create index if not exists inventory_replenishment_status_idx on public.inventory_replenishment_needs(status, opened_at desc);

alter table public.inventory_replenishment_needs enable row level security;
revoke all on table public.inventory_replenishment_needs from anon, authenticated;
grant select on table public.inventory_replenishment_needs to authenticated;

drop policy if exists inventory_replenishment_needs_select_scoped on public.inventory_replenishment_needs;
create policy inventory_replenishment_needs_select_scoped
on public.inventory_replenishment_needs for select
to authenticated
using (
  exists (
    select 1
    from public.inventory_stock_items si
    join public.warehouse_locations wl on wl.id = si.warehouse_location_id
    join public.warehouses w on w.id = wl.warehouse_id
    where si.id = inventory_replenishment_needs.stock_item_id
      and (
        (public.can_app_action('inventory.process') and public.can_access_operational_scope('inventory', w.location_id))
        or
        (public.can_app_action('procurement.manage') and public.can_access_operational_scope('procurement', w.location_id))
      )
  )
);

create or replace function public.refresh_inventory_replenishment_need(p_stock_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.inventory_stock_items%rowtype;
  v_need public.inventory_replenishment_needs%rowtype;
  v_suggested numeric;
begin
  select * into v_item
  from public.inventory_stock_items
  where id = p_stock_item_id
  for update;
  if not found then return null; end if;

  v_suggested := greatest(v_item.reorder_quantity, v_item.minimum_stock - v_item.quantity_on_hand, 0);

  select * into v_need
  from public.inventory_replenishment_needs
  where stock_item_id = p_stock_item_id
    and status in ('open','requested','approved','ordered','receiving')
  order by opened_at desc
  limit 1
  for update;

  if v_item.is_active and v_item.quantity_on_hand <= v_item.minimum_stock and v_suggested > 0 then
    if v_need.id is null then
      insert into public.inventory_replenishment_needs(
        stock_item_id,status,trigger_quantity,minimum_stock,suggested_quantity,last_event_at
      ) values (
        v_item.id,'open',v_item.quantity_on_hand,v_item.minimum_stock,v_suggested,now()
      ) returning * into v_need;
    elsif v_need.status = 'open' then
      update public.inventory_replenishment_needs
      set trigger_quantity=v_item.quantity_on_hand,
          minimum_stock=v_item.minimum_stock,
          suggested_quantity=v_suggested,
          last_event_at=now(),
          updated_at=now()
      where id=v_need.id
      returning * into v_need;
    else
      update public.inventory_replenishment_needs
      set last_event_at=now(), updated_at=now()
      where id=v_need.id;
    end if;
    return v_need.id;
  end if;

  if v_need.id is not null and v_need.status = 'open' then
    update public.inventory_replenishment_needs
    set status='fulfilled', fulfilled_at=now(), last_event_at=now(), updated_at=now(),
        resolution_reason='Stock recovered before a purchase request was created.'
    where id=v_need.id;
  end if;

  return null;
end;
$function$;
revoke all on function public.refresh_inventory_replenishment_need(uuid) from public, anon, authenticated;
grant execute on function public.refresh_inventory_replenishment_need(uuid) to service_role;

create or replace function public.sync_inventory_replenishment_from_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.refresh_inventory_replenishment_need(new.id);
  return new;
end;
$function$;
revoke all on function public.sync_inventory_replenishment_from_stock() from public, anon, authenticated;

drop trigger if exists inventory_stock_replenishment_sync on public.inventory_stock_items;
create trigger inventory_stock_replenishment_sync
after insert or update of quantity_on_hand, minimum_stock, reorder_quantity, is_active
on public.inventory_stock_items
for each row execute function public.sync_inventory_replenishment_from_stock();

create or replace function public.create_procurement_request_from_replenishment(
  p_need_id uuid,
  p_requested_quantity numeric default null,
  p_required_date date default null,
  p_priority text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_need public.inventory_replenishment_needs%rowtype;
  v_item public.inventory_stock_items%rowtype;
  v_location_id uuid;
  v_location_name text;
  v_warehouse_name text;
  v_requested numeric;
  v_priority text;
  v_budget numeric;
  v_request_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;

  select * into v_need
  from public.inventory_replenishment_needs
  where id=p_need_id
  for update;
  if not found then raise exception 'Replenishment need not found'; end if;

  if v_need.procurement_request_id is not null then
    return v_need.procurement_request_id;
  end if;
  if v_need.status <> 'open' then raise exception 'Only open replenishment needs can create a purchase request'; end if;

  select * into v_item
  from public.inventory_stock_items
  where id=v_need.stock_item_id
  for update;
  if not found then raise exception 'Stock item not found'; end if;

  select w.location_id, wl.name, w.name
    into v_location_id, v_location_name, v_warehouse_name
  from public.warehouse_locations wl
  join public.warehouses w on w.id=wl.warehouse_id
  where wl.id=v_item.warehouse_location_id;
  if not found then raise exception 'Stock location not found'; end if;

  if not v_item.is_active then raise exception 'Inactive stock items cannot create replenishment requests'; end if;
  if v_item.quantity_on_hand > v_item.minimum_stock then raise exception 'Stock item no longer requires replenishment'; end if;
  if not public.can_access_operational_scope('inventory', v_location_id) then raise exception 'Inventory scope required for this location'; end if;
  if not public.can_access_operational_scope('procurement', v_location_id) then raise exception 'Procurement scope required for this location'; end if;

  v_requested := coalesce(p_requested_quantity, greatest(v_need.suggested_quantity, v_item.reorder_quantity, v_item.minimum_stock - v_item.quantity_on_hand));
  if v_requested <= 0 then raise exception 'Requested quantity must be greater than zero'; end if;

  v_priority := coalesce(p_priority, case when v_item.quantity_on_hand = 0 then 'high' else 'normal' end);
  if v_priority not in ('low','normal','high','critical') then raise exception 'Invalid procurement priority'; end if;
  v_budget := case when v_item.unit_cost is null then null else round(v_item.unit_cost * v_requested, 0) end;

  insert into public.procurement_requests(
    title,description,business_justification,category,quantity,unit,estimated_budget_clp,priority,status,
    required_date,region,commune,location_id,delivery_location,requested_by,automation_mode
  ) values (
    v_item.name,
    'Reposición vinculada al SKU '||v_item.item_code||'.',
    format('Stock actual: %s %s. Mínimo: %s. Reposición sugerida: %s. Necesidad de Inventario: %s.', v_item.quantity_on_hand, v_item.unit, v_item.minimum_stock, v_need.suggested_quantity, v_need.id),
    coalesce(v_item.category,'Supplies'),
    v_requested,
    v_item.unit,
    v_budget,
    v_priority,
    'submitted',
    p_required_date,
    'Los Ríos',
    'Valdivia',
    v_location_id,
    concat_ws(' · ',v_warehouse_name,v_location_name),
    v_user,
    'assisted'
  ) returning id into v_request_id;

  update public.inventory_replenishment_needs
  set status='requested', procurement_request_id=v_request_id, requested_quantity=v_requested,
      requested_at=now(), last_event_at=now(), updated_at=now()
  where id=v_need.id;

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request_id,'inventory_replenishment',v_need.id,'replenishment_request_created','user',v_user,
    jsonb_build_object('stock_item_id',v_item.id,'item_code',v_item.item_code,'requested_quantity',v_requested,'trigger_quantity',v_need.trigger_quantity,'minimum_stock',v_need.minimum_stock));

  return v_request_id;
end;
$function$;
revoke all on function public.create_procurement_request_from_replenishment(uuid,numeric,date,text) from public, anon, authenticated;
grant execute on function public.create_procurement_request_from_replenishment(uuid,numeric,date,text) to authenticated, service_role;

create or replace function public.sync_inventory_replenishment_from_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_need public.inventory_replenishment_needs%rowtype;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into v_need from public.inventory_replenishment_needs where procurement_request_id=new.id order by created_at desc limit 1 for update;
  if not found then return new; end if;

  if new.status in ('submitted','under_review') then
    update public.inventory_replenishment_needs set status='requested',last_event_at=now(),updated_at=now() where id=v_need.id and status not in ('fulfilled','cancelled','rejected');
  elsif new.status in ('approved','approved_for_quotation') then
    update public.inventory_replenishment_needs set status='approved',approved_at=coalesce(approved_at,now()),last_event_at=now(),updated_at=now() where id=v_need.id and status not in ('fulfilled','cancelled','rejected');
  elsif new.status in ('final_approved','converted') then
    update public.inventory_replenishment_needs set status='ordered',ordered_at=coalesce(ordered_at,now()),last_event_at=now(),updated_at=now() where id=v_need.id and status not in ('fulfilled','cancelled','rejected');
  elsif new.status='rejected' then
    update public.inventory_replenishment_needs set status='rejected',rejected_at=now(),last_event_at=now(),updated_at=now(),resolution_reason='Procurement request rejected.' where id=v_need.id;
    perform public.refresh_inventory_replenishment_need(v_need.stock_item_id);
  end if;
  return new;
end;
$function$;
revoke all on function public.sync_inventory_replenishment_from_request() from public, anon, authenticated;

drop trigger if exists procurement_request_replenishment_sync on public.procurement_requests;
create trigger procurement_request_replenishment_sync
after update of status on public.procurement_requests
for each row execute function public.sync_inventory_replenishment_from_request();

create or replace function public.sync_inventory_replenishment_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_need public.inventory_replenishment_needs%rowtype;
begin
  select * into v_need from public.inventory_replenishment_needs where procurement_request_id=new.request_id order by created_at desc limit 1 for update;
  if not found then return new; end if;

  if new.status in ('draft','ready_to_issue','issued','acknowledged','confirmed') then
    update public.inventory_replenishment_needs set status='ordered',purchase_order_id=new.id,ordered_at=coalesce(ordered_at,now()),last_event_at=now(),updated_at=now() where id=v_need.id and status not in ('fulfilled','cancelled','rejected');
  elsif new.status in ('partially_received','received') then
    update public.inventory_replenishment_needs set status='receiving',purchase_order_id=new.id,receiving_at=coalesce(receiving_at,now()),last_event_at=now(),updated_at=now() where id=v_need.id and status not in ('fulfilled','cancelled','rejected');
  elsif new.status='cancelled' then
    update public.inventory_replenishment_needs set status='cancelled',purchase_order_id=new.id,cancelled_at=now(),last_event_at=now(),updated_at=now(),resolution_reason='Purchase order cancelled.' where id=v_need.id and status not in ('fulfilled','rejected');
    perform public.refresh_inventory_replenishment_need(v_need.stock_item_id);
  end if;
  return new;
end;
$function$;
revoke all on function public.sync_inventory_replenishment_from_order() from public, anon, authenticated;

drop trigger if exists procurement_order_replenishment_sync on public.procurement_purchase_orders;
create trigger procurement_order_replenishment_sync
after insert or update of status on public.procurement_purchase_orders
for each row execute function public.sync_inventory_replenishment_from_order();

create or replace function public.sync_inventory_replenishment_from_intake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id uuid;
  v_need public.inventory_replenishment_needs%rowtype;
begin
  if new.status <> 'processed' or old.status is not distinct from new.status or new.intake_type <> 'consumable' then return new; end if;

  select ri.request_id into v_request_id
  from public.procurement_receipt_items ri
  where ri.id=new.receipt_item_id;

  select * into v_need
  from public.inventory_replenishment_needs
  where procurement_request_id=v_request_id
  order by created_at desc limit 1
  for update;
  if not found then return new; end if;

  if new.linked_stock_item_id = v_need.stock_item_id then
    update public.inventory_replenishment_needs
    set status='fulfilled',fulfilled_at=now(),last_event_at=now(),updated_at=now(),resolution_reason='Procurement intake processed into the originating stock item.'
    where id=v_need.id;
    perform public.refresh_inventory_replenishment_need(v_need.stock_item_id);
  else
    update public.inventory_replenishment_needs
    set status='receiving',last_event_at=now(),updated_at=now(),resolution_reason='Intake was processed to a different stock item; manual reconciliation required.'
    where id=v_need.id and status not in ('fulfilled','cancelled','rejected');
  end if;
  return new;
end;
$function$;
revoke all on function public.sync_inventory_replenishment_from_intake() from public, anon, authenticated;

drop trigger if exists procurement_intake_replenishment_sync on public.procurement_inventory_intake;
create trigger procurement_intake_replenishment_sync
after update of status, linked_stock_item_id on public.procurement_inventory_intake
for each row execute function public.sync_inventory_replenishment_from_intake();

create or replace function public.transition_procurement_purchase_order(p_order_id uuid,p_action text,p_notes text default null)
returns public.procurement_purchase_orders
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.procurement_purchase_orders%rowtype;
  v_next text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;

  select * into v_order from public.procurement_purchase_orders where id=p_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_access_operational_scope('procurement',v_order.location_id) then raise exception 'Procurement scope required for this location'; end if;

  if p_action='issue' and v_order.status='ready_to_issue' then v_next:='issued';
  elsif p_action='confirm' and v_order.status in ('issued','acknowledged') then v_next:='confirmed';
  elsif p_action='cancel' and v_order.status in ('draft','ready_to_issue','issued','acknowledged','confirmed') then v_next:='cancelled';
  else raise exception 'Invalid purchase order transition: % from %',p_action,v_order.status;
  end if;

  update public.procurement_purchase_orders
  set status=v_next,
      issued_by=case when v_next='issued' then v_user else issued_by end,
      issued_at=case when v_next='issued' then now() else issued_at end,
      updated_at=now()
  where id=p_order_id returning * into v_order;

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_order.request_id,'purchase_order',v_order.id,'purchase_order_'||p_action,'user',v_user,jsonb_build_object('status',v_next,'notes',nullif(trim(p_notes),'')));
  return v_order;
end;
$function$;
revoke all on function public.transition_procurement_purchase_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.transition_procurement_purchase_order(uuid,text,text) to authenticated, service_role;

create or replace function public.post_procurement_receipt(p_purchase_order_id uuid, p_received_quantity numeric, p_rejected_quantity numeric default 0, p_condition text default 'accepted', p_discrepancy_reason text default null, p_delivery_document text default null, p_evidence_url text default null, p_notes text default null, p_inventory_intake_required boolean default false, p_intake_type text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_po public.procurement_purchase_orders%rowtype;
  v_request public.procurement_requests%rowtype;
  v_receipt_id uuid;
  v_item_id uuid;
  v_total_received numeric;
  v_next_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;
  if p_inventory_intake_required and not public.can_app_action('inventory.process') then raise exception 'Inventory permission required to create an intake'; end if;
  if p_received_quantity < 0 or p_rejected_quantity < 0 then raise exception 'Invalid quantities'; end if;
  if p_received_quantity + p_rejected_quantity <= 0 then raise exception 'A receipt must include a quantity'; end if;
  if p_condition not in ('accepted','partial_damage','damaged','incorrect') then raise exception 'Invalid condition'; end if;
  if p_inventory_intake_required and p_intake_type not in ('asset','consumable') then raise exception 'Intake type is required'; end if;

  select * into v_po from public.procurement_purchase_orders where id=p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_access_operational_scope('procurement',v_po.location_id) then raise exception 'Procurement scope required for this location'; end if;
  if v_po.status not in ('issued','acknowledged','confirmed','partially_received') then raise exception 'Purchase order is not receivable'; end if;

  select * into v_request from public.procurement_requests where id=v_po.request_id;
  if not found then raise exception 'Purchase request not found'; end if;

  select coalesce(sum(ri.received_quantity + ri.rejected_quantity),0) into v_total_received
  from public.procurement_receipt_items ri
  join public.procurement_receipts r on r.id=ri.receipt_id
  where r.purchase_order_id=p_purchase_order_id and r.status='posted';
  if v_total_received + p_received_quantity + p_rejected_quantity > v_request.quantity then raise exception 'Receipt exceeds ordered quantity'; end if;

  insert into public.procurement_receipts(purchase_order_id,receipt_number,status,received_by,delivery_document,evidence_url,notes)
  values(p_purchase_order_id,'REC-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS-MS'),'posted',v_user,nullif(trim(p_delivery_document),''),nullif(trim(p_evidence_url),''),nullif(trim(p_notes),''))
  returning id into v_receipt_id;

  insert into public.procurement_receipt_items(receipt_id,request_id,ordered_quantity,received_quantity,rejected_quantity,condition,discrepancy_reason,inventory_intake_required,intake_type)
  values(v_receipt_id,v_request.id,v_request.quantity,p_received_quantity,p_rejected_quantity,p_condition,nullif(trim(p_discrepancy_reason),''),p_inventory_intake_required,case when p_inventory_intake_required then p_intake_type else null end)
  returning id into v_item_id;

  if p_inventory_intake_required then
    insert into public.procurement_inventory_intake(receipt_item_id,intake_type,status,location_id,notes)
    values(v_item_id,p_intake_type,'pending',v_po.location_id,'Ingreso generado desde recepción de compra.');
  end if;

  v_total_received := v_total_received + p_received_quantity + p_rejected_quantity;
  v_next_status := case when v_total_received >= v_request.quantity then 'received' else 'partially_received' end;
  update public.procurement_purchase_orders set status=v_next_status,updated_at=now() where id=p_purchase_order_id;

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request.id,'purchase_order',p_purchase_order_id,'receipt_posted','user',v_user,jsonb_build_object('receipt_id',v_receipt_id,'received_quantity',p_received_quantity,'rejected_quantity',p_rejected_quantity,'condition',p_condition,'inventory_intake_required',p_inventory_intake_required));
  return v_receipt_id;
end;
$function$;
revoke all on function public.post_procurement_receipt(uuid,numeric,numeric,text,text,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.post_procurement_receipt(uuid,numeric,numeric,text,text,text,text,text,boolean,text) to authenticated, service_role;

do $block$
declare v_id uuid;
begin
  for v_id in select id from public.inventory_stock_items loop
    perform public.refresh_inventory_replenishment_need(v_id);
  end loop;
end;
$block$;

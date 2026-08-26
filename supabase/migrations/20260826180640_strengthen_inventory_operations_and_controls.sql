alter table public.inventory_stock_items
  add column if not exists reorder_quantity numeric not null default 0,
  add column if not exists last_counted_at timestamptz,
  add column if not exists last_counted_by uuid references auth.users(id) on delete set null;

alter table public.inventory_stock_items
  add constraint inventory_stock_items_reorder_quantity_check check (reorder_quantity >= 0);

alter table public.inventory_stock_movements
  add column if not exists balance_before numeric,
  add column if not exists from_location_id uuid references public.warehouse_locations(id) on delete set null,
  add column if not exists to_location_id uuid references public.warehouse_locations(id) on delete set null,
  add column if not exists transfer_group_id uuid;

alter table public.inventory_stock_movements
  add constraint inventory_stock_movements_balance_before_check check (balance_before is null or balance_before >= 0);

create index if not exists idx_stock_items_cost_center on public.inventory_stock_items(cost_center_id) where cost_center_id is not null;
create index if not exists idx_stock_items_source_request on public.inventory_stock_items(source_request_id) where source_request_id is not null;
create index if not exists idx_stock_items_last_counted_at on public.inventory_stock_items(last_counted_at) where last_counted_at is not null;
create index if not exists idx_stock_movements_moved_at on public.inventory_stock_movements(moved_at desc);
create index if not exists idx_stock_movements_transfer_group on public.inventory_stock_movements(transfer_group_id) where transfer_group_id is not null;
create index if not exists idx_stock_movements_from_location on public.inventory_stock_movements(from_location_id) where from_location_id is not null;
create index if not exists idx_stock_movements_to_location on public.inventory_stock_movements(to_location_id) where to_location_id is not null;
create index if not exists idx_inventory_movements_from_location on public.inventory_movements(from_location_id) where from_location_id is not null;
create index if not exists idx_inventory_movements_to_location on public.inventory_movements(to_location_id) where to_location_id is not null;
create index if not exists idx_inventory_movements_moved_by on public.inventory_movements(moved_by) where moved_by is not null;

create or replace function public.execute_inventory_stock_operation(
  p_stock_item_id uuid,
  p_operation text,
  p_quantity numeric default null,
  p_to_location_id uuid default null,
  p_new_balance numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_item public.inventory_stock_items%rowtype;
  v_target public.inventory_stock_items%rowtype;
  v_source_scope_location uuid;
  v_target_scope_location uuid;
  v_before numeric;
  v_after numeric;
  v_target_before numeric;
  v_target_after numeric;
  v_transfer_group uuid;
  v_target_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if p_operation not in ('issue','return','adjustment','count','transfer') then raise exception 'Invalid stock operation'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Operation reason is required'; end if;

  select * into v_item
  from public.inventory_stock_items
  where id = p_stock_item_id
  for update;

  if not found then raise exception 'Stock item not found'; end if;
  if not v_item.is_active then raise exception 'Inactive stock items cannot be operated'; end if;

  select w.location_id into v_source_scope_location
  from public.warehouse_locations wl
  join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_item.warehouse_location_id;

  if not public.can_access_operational_scope('inventory', v_source_scope_location) then
    raise exception 'Inventory scope required for source location';
  end if;

  v_before := v_item.quantity_on_hand;

  if p_operation = 'issue' then
    if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    if p_quantity > v_before then raise exception 'Insufficient stock'; end if;
    v_after := v_before - p_quantity;

    update public.inventory_stock_items
      set quantity_on_hand = v_after, updated_at = now()
    where id = v_item.id;

    insert into public.inventory_stock_movements(
      stock_item_id, movement_type, quantity, unit_cost, balance_before, balance_after,
      from_location_id, to_location_id, notes, moved_by, moved_at
    ) values (
      v_item.id, 'issue', p_quantity, v_item.unit_cost, v_before, v_after,
      v_item.warehouse_location_id, null, trim(p_reason), v_user, now()
    );

  elsif p_operation = 'return' then
    if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    v_after := v_before + p_quantity;

    update public.inventory_stock_items
      set quantity_on_hand = v_after, updated_at = now()
    where id = v_item.id;

    insert into public.inventory_stock_movements(
      stock_item_id, movement_type, quantity, unit_cost, balance_before, balance_after,
      from_location_id, to_location_id, notes, moved_by, moved_at
    ) values (
      v_item.id, 'return', p_quantity, v_item.unit_cost, v_before, v_after,
      null, v_item.warehouse_location_id, trim(p_reason), v_user, now()
    );

  elsif p_operation in ('adjustment','count') then
    if p_new_balance is null or p_new_balance < 0 then raise exception 'New balance must be zero or greater'; end if;
    if p_new_balance = v_before then raise exception 'New balance must differ from current balance'; end if;
    v_after := p_new_balance;

    update public.inventory_stock_items
      set quantity_on_hand = v_after,
          last_counted_at = case when p_operation = 'count' then now() else last_counted_at end,
          last_counted_by = case when p_operation = 'count' then v_user else last_counted_by end,
          updated_at = now()
    where id = v_item.id;

    insert into public.inventory_stock_movements(
      stock_item_id, movement_type, quantity, unit_cost, balance_before, balance_after,
      from_location_id, to_location_id, notes, moved_by, moved_at
    ) values (
      v_item.id, 'adjustment', abs(v_after - v_before), v_item.unit_cost, v_before, v_after,
      v_item.warehouse_location_id, v_item.warehouse_location_id,
      (case when p_operation = 'count' then 'Conteo físico. ' else 'Ajuste. ' end) || trim(p_reason),
      v_user, now()
    );

  elsif p_operation = 'transfer' then
    if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    if p_quantity > v_before then raise exception 'Insufficient stock'; end if;
    if p_to_location_id is null then raise exception 'Destination location is required'; end if;
    if p_to_location_id = v_item.warehouse_location_id then raise exception 'Destination must differ from source location'; end if;

    select w.location_id into v_target_scope_location
    from public.warehouse_locations wl
    join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = p_to_location_id and wl.is_active = true and w.is_active = true;

    if not found then raise exception 'Active destination location not found'; end if;
    if not public.can_access_operational_scope('inventory', v_target_scope_location) then
      raise exception 'Inventory scope required for destination location';
    end if;

    insert into public.inventory_stock_items(
      item_code, name, category, unit, warehouse_location_id, cost_center_id,
      quantity_on_hand, minimum_stock, reorder_quantity, unit_cost, source_request_id,
      is_active, created_by, created_at, updated_at
    ) values (
      'STK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
      v_item.name, v_item.category, v_item.unit, p_to_location_id, v_item.cost_center_id,
      0, v_item.minimum_stock, v_item.reorder_quantity, v_item.unit_cost, v_item.source_request_id,
      true, v_user, now(), now()
    )
    on conflict (name, warehouse_location_id, unit)
    do update set updated_at = excluded.updated_at
    returning id into v_target_id;

    select * into v_target
    from public.inventory_stock_items
    where id = v_target_id
    for update;

    v_target_before := v_target.quantity_on_hand;
    v_after := v_before - p_quantity;
    v_target_after := v_target_before + p_quantity;
    v_transfer_group := gen_random_uuid();

    update public.inventory_stock_items
      set quantity_on_hand = v_after, updated_at = now()
    where id = v_item.id;

    update public.inventory_stock_items
      set quantity_on_hand = v_target_after,
          unit_cost = coalesce(v_item.unit_cost, unit_cost),
          cost_center_id = coalesce(v_item.cost_center_id, cost_center_id),
          updated_at = now()
    where id = v_target.id;

    insert into public.inventory_stock_movements(
      stock_item_id, movement_type, quantity, unit_cost, balance_before, balance_after,
      from_location_id, to_location_id, transfer_group_id, notes, moved_by, moved_at
    ) values
    (
      v_item.id, 'transfer_out', p_quantity, v_item.unit_cost, v_before, v_after,
      v_item.warehouse_location_id, p_to_location_id, v_transfer_group, trim(p_reason), v_user, now()
    ),
    (
      v_target.id, 'transfer_in', p_quantity, v_item.unit_cost, v_target_before, v_target_after,
      v_item.warehouse_location_id, p_to_location_id, v_transfer_group, trim(p_reason), v_user, now()
    );
  end if;

  return jsonb_build_object(
    'stock_item_id', v_item.id,
    'operation', p_operation,
    'balance_before', v_before,
    'balance_after', coalesce(v_after, v_before),
    'target_stock_item_id', v_target_id,
    'target_balance_after', v_target_after,
    'transfer_group_id', v_transfer_group
  );
end;
$$;

create or replace function public.update_inventory_stock_settings(
  p_stock_item_id uuid,
  p_minimum_stock numeric,
  p_reorder_quantity numeric default 0,
  p_unit_cost numeric default null,
  p_cost_center_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_item public.inventory_stock_items%rowtype;
  v_scope_location uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if p_minimum_stock is null or p_minimum_stock < 0 then raise exception 'Minimum stock must be zero or greater'; end if;
  if p_reorder_quantity is null or p_reorder_quantity < 0 then raise exception 'Reorder quantity must be zero or greater'; end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'Unit cost must be zero or greater'; end if;

  select * into v_item from public.inventory_stock_items where id = p_stock_item_id for update;
  if not found then raise exception 'Stock item not found'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_item.warehouse_location_id;

  if not public.can_access_operational_scope('inventory', v_scope_location) then
    raise exception 'Inventory scope required for this location';
  end if;

  update public.inventory_stock_items
     set minimum_stock = p_minimum_stock,
         reorder_quantity = p_reorder_quantity,
         unit_cost = coalesce(p_unit_cost, unit_cost),
         cost_center_id = coalesce(p_cost_center_id, cost_center_id),
         updated_at = now()
   where id = v_item.id;

  return jsonb_build_object('stock_item_id', v_item.id, 'minimum_stock', p_minimum_stock, 'reorder_quantity', p_reorder_quantity);
end;
$$;

create or replace function public.request_inventory_asset_retirement(
  p_asset_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_scope_location uuid;
  v_request_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Retirement reason is required'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Asset is already retired'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_scope_location
    from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
  end if;

  if not public.can_access_operational_scope('inventory', v_scope_location) then
    raise exception 'Inventory scope required for this asset';
  end if;

  if exists (
    select 1 from public.asset_retirement_requests
    where asset_id = p_asset_id and status in ('pending','approved')
  ) then
    raise exception 'Asset already has an open retirement request';
  end if;

  insert into public.asset_retirement_requests(asset_id, reason, requested_by, requested_at, status, created_at, updated_at)
  values(p_asset_id, trim(p_reason), v_user, now(), 'pending', now(), now())
  returning id into v_request_id;

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values(p_asset_id, 'retirement_requested', trim(p_reason), v_user, now());

  return jsonb_build_object('request_id', v_request_id, 'asset_id', p_asset_id, 'status', 'pending');
end;
$$;

create or replace function public.review_inventory_asset_retirement(
  p_request_id uuid,
  p_approved boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_request public.asset_retirement_requests%rowtype;
  v_asset public.assets%rowtype;
  v_scope_location uuid;
  v_next_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Inventory approval role required'; end if;

  select * into v_request from public.asset_retirement_requests where id = p_request_id for update;
  if not found then raise exception 'Retirement request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending retirement requests can be reviewed'; end if;

  select * into v_asset from public.assets where id = v_request.asset_id for update;
  if not found then raise exception 'Asset not found'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_scope_location
    from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
  end if;

  if not public.can_access_operational_scope('inventory', v_scope_location) then
    raise exception 'Inventory scope required for this asset';
  end if;

  v_next_status := case when p_approved then 'approved' else 'rejected' end;

  update public.asset_retirement_requests
     set status = v_next_status,
         reviewed_by = v_user,
         reviewed_at = now(),
         review_notes = nullif(trim(coalesce(p_notes,'')), ''),
         updated_at = now()
   where id = v_request.id;

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values(v_asset.id, 'retirement_' || v_next_status, coalesce(nullif(trim(coalesce(p_notes,'')), ''), v_next_status), v_user, now());

  return jsonb_build_object('request_id', v_request.id, 'asset_id', v_asset.id, 'status', v_next_status);
end;
$$;

create or replace function public.execute_inventory_asset_retirement(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_request public.asset_retirement_requests%rowtype;
  v_asset public.assets%rowtype;
  v_scope_location uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Inventory approval role required'; end if;

  select * into v_request from public.asset_retirement_requests where id = p_request_id for update;
  if not found then raise exception 'Retirement request not found'; end if;
  if v_request.status <> 'approved' then raise exception 'Only approved retirement requests can be executed'; end if;

  select * into v_asset from public.assets where id = v_request.asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Asset is already retired'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_scope_location
    from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
  end if;

  if not public.can_access_operational_scope('inventory', v_scope_location) then
    raise exception 'Inventory scope required for this asset';
  end if;

  update public.assets
     set status = 'deprecated', updated_at = now()
   where id = v_asset.id;

  update public.asset_retirement_requests
     set status = 'executed', executed_at = now(), updated_at = now()
   where id = v_request.id;

  insert into public.inventory_movements(
    asset_id, movement_type, from_location_id, to_location_id, assigned_to, notes, moved_by, moved_at
  ) values (
    v_asset.id, 'retirement', v_asset.warehouse_location_id, null, v_asset.assigned_to,
    v_request.reason, v_user, now()
  );

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values(v_asset.id, 'retirement_executed', v_request.reason, v_user, now());

  return jsonb_build_object('request_id', v_request.id, 'asset_id', v_asset.id, 'status', 'executed');
end;
$$;

create or replace function public.execute_inventory_asset_operation(
  p_asset_id uuid,
  p_operation text,
  p_to_location_id uuid default null,
  p_custodian text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_location public.warehouse_locations%rowtype;
  v_next_location uuid;
  v_next_custodian text;
  v_location_label text;
  v_source_scope_location uuid;
  v_target_scope_location uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if p_operation not in ('transfer','assignment','return') then raise exception 'Invalid inventory operation'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Operation reason is required'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Deprecated assets cannot be moved'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_source_scope_location
    from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
  end if;

  if not public.can_access_operational_scope('inventory', v_source_scope_location) then
    raise exception 'Inventory scope required for source location';
  end if;

  if p_operation in ('transfer','return') then
    if p_to_location_id is null then raise exception 'Destination location is required'; end if;
    select * into v_location from public.warehouse_locations where id = p_to_location_id and is_active = true;
    if not found then raise exception 'Active destination location not found'; end if;
    if p_operation = 'transfer' and p_to_location_id = v_asset.warehouse_location_id then raise exception 'Destination must differ from current location'; end if;

    select w.location_id into v_target_scope_location from public.warehouses w where w.id = v_location.warehouse_id and w.is_active = true;
    if not found then raise exception 'Active destination warehouse not found'; end if;
    if not public.can_access_operational_scope('inventory', v_target_scope_location) then
      raise exception 'Inventory scope required for destination location';
    end if;

    v_next_location := p_to_location_id;
    v_next_custodian := case when p_operation = 'return' then null else v_asset.assigned_to end;
    select concat_ws(' · ', w.name, v_location.name) into v_location_label from public.warehouses w where w.id = v_location.warehouse_id;
  else
    if nullif(trim(coalesce(p_custodian,'')), '') is null then raise exception 'Custodian is required'; end if;
    v_next_location := v_asset.warehouse_location_id;
    v_next_custodian := trim(p_custodian);
    v_location_label := v_asset.location;
  end if;

  update public.assets
     set warehouse_location_id = v_next_location,
         location = v_location_label,
         assigned_to = v_next_custodian,
         updated_at = now()
   where id = v_asset.id;

  insert into public.inventory_movements(
    asset_id, movement_type, from_location_id, to_location_id, assigned_to, notes, moved_by, moved_at
  ) values (
    v_asset.id, p_operation, v_asset.warehouse_location_id, v_next_location, v_next_custodian, trim(p_reason), v_user, now()
  );

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values (v_asset.id, p_operation, initcap(p_operation) || '. ' || trim(p_reason), v_user, now());

  return jsonb_build_object(
    'asset_id', v_asset.id,
    'operation', p_operation,
    'location_id', v_next_location,
    'custodian', v_next_custodian
  );
end;
$$;

create or replace view public.inventory_stock_status
with (security_invoker = true)
as
select
  si.id,
  si.item_code,
  si.name,
  si.category,
  si.unit,
  si.warehouse_location_id,
  wl.name as warehouse_location_name,
  wl.code as warehouse_location_code,
  w.id as warehouse_id,
  w.name as warehouse_name,
  w.location_id,
  si.cost_center_id,
  cc.name as cost_center_name,
  cc.code as cost_center_code,
  si.quantity_on_hand,
  si.minimum_stock,
  si.reorder_quantity,
  si.unit_cost,
  si.is_active,
  si.last_counted_at,
  si.last_counted_by,
  case
    when not si.is_active then 'inactive'
    when si.quantity_on_hand = 0 then 'out'
    when si.quantity_on_hand <= si.minimum_stock then 'low'
    else 'ok'
  end as stock_state,
  greatest(si.minimum_stock - si.quantity_on_hand, 0) as shortfall_to_minimum,
  case
    when si.is_active and si.quantity_on_hand <= si.minimum_stock
      then greatest(si.reorder_quantity, si.minimum_stock - si.quantity_on_hand)
    else 0::numeric
  end as suggested_reorder_quantity,
  si.quantity_on_hand * coalesce(si.unit_cost, 0) as inventory_value
from public.inventory_stock_items si
join public.warehouse_locations wl on wl.id = si.warehouse_location_id
join public.warehouses w on w.id = wl.warehouse_id
left join public.cost_centers cc on cc.id = si.cost_center_id;

revoke all on public.inventory_stock_status from public, anon;
grant select on public.inventory_stock_status to authenticated, service_role;

drop policy if exists "Internal staff can manage assets" on public.assets;
drop policy if exists assets_select_inventory_scoped on public.assets;
drop policy if exists assets_insert_inventory_scoped on public.assets;
drop policy if exists assets_update_inventory_scoped on public.assets;

create policy assets_select_inventory_scoped
on public.assets for select to authenticated
using (
  public.can_app_action('inventory.process')
  and (
    warehouse_location_id is null
    or exists (
      select 1
      from public.warehouse_locations wl
      join public.warehouses w on w.id = wl.warehouse_id
      where wl.id = assets.warehouse_location_id
        and public.can_access_operational_scope('inventory', w.location_id)
    )
  )
);

create policy assets_insert_inventory_scoped
on public.assets for insert to authenticated
with check (
  public.can_app_action('inventory.process')
  and (
    warehouse_location_id is null
    or exists (
      select 1
      from public.warehouse_locations wl
      join public.warehouses w on w.id = wl.warehouse_id
      where wl.id = assets.warehouse_location_id
        and public.can_access_operational_scope('inventory', w.location_id)
    )
  )
);

create policy assets_update_inventory_scoped
on public.assets for update to authenticated
using (
  public.can_app_action('inventory.process')
  and (
    warehouse_location_id is null
    or exists (
      select 1
      from public.warehouse_locations wl
      join public.warehouses w on w.id = wl.warehouse_id
      where wl.id = assets.warehouse_location_id
        and public.can_access_operational_scope('inventory', w.location_id)
    )
  )
)
with check (
  public.can_app_action('inventory.process')
  and (
    warehouse_location_id is null
    or exists (
      select 1
      from public.warehouse_locations wl
      join public.warehouses w on w.id = wl.warehouse_id
      where wl.id = assets.warehouse_location_id
        and public.can_access_operational_scope('inventory', w.location_id)
    )
  )
);

drop policy if exists inventory_stock_items_read_authorized on public.inventory_stock_items;
create policy inventory_stock_items_read_scoped
on public.inventory_stock_items for select to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1
    from public.warehouse_locations wl
    join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = inventory_stock_items.warehouse_location_id
      and public.can_access_operational_scope('inventory', w.location_id)
  )
);

drop policy if exists inventory_stock_movements_read_authorized on public.inventory_stock_movements;
create policy inventory_stock_movements_read_scoped
on public.inventory_stock_movements for select to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1
    from public.inventory_stock_items si
    join public.warehouse_locations wl on wl.id = si.warehouse_location_id
    join public.warehouses w on w.id = wl.warehouse_id
    where si.id = inventory_stock_movements.stock_item_id
      and public.can_access_operational_scope('inventory', w.location_id)
  )
);

drop policy if exists procurement_inventory_intake_select_scoped on public.procurement_inventory_intake;
create policy procurement_inventory_intake_select_scoped
on public.procurement_inventory_intake for select to authenticated
using (
  public.can_app_action('inventory.process')
  and (location_id is null or public.can_access_operational_scope('inventory', location_id))
);

revoke all on function public.execute_inventory_stock_operation(uuid,text,numeric,uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.execute_inventory_stock_operation(uuid,text,numeric,uuid,numeric,text) to authenticated, service_role;
revoke all on function public.update_inventory_stock_settings(uuid,numeric,numeric,numeric,uuid) from public, anon, authenticated;
grant execute on function public.update_inventory_stock_settings(uuid,numeric,numeric,numeric,uuid) to authenticated, service_role;
revoke all on function public.request_inventory_asset_retirement(uuid,text) from public, anon, authenticated;
grant execute on function public.request_inventory_asset_retirement(uuid,text) to authenticated, service_role;
revoke all on function public.review_inventory_asset_retirement(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.review_inventory_asset_retirement(uuid,boolean,text) to authenticated, service_role;
revoke all on function public.execute_inventory_asset_retirement(uuid) from public, anon, authenticated;
grant execute on function public.execute_inventory_asset_retirement(uuid) to authenticated, service_role;
revoke all on function public.execute_inventory_asset_operation(uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.execute_inventory_asset_operation(uuid,text,uuid,text,text) to authenticated, service_role;

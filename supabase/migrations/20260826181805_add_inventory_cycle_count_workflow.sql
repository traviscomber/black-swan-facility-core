create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  count_code text not null unique,
  warehouse_location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','approved','rejected','applied','cancelled')),
  notes text,
  review_notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_count_sessions(id) on delete cascade,
  stock_item_id uuid not null references public.inventory_stock_items(id) on delete restrict,
  expected_quantity numeric not null check (expected_quantity >= 0),
  counted_quantity numeric check (counted_quantity is null or counted_quantity >= 0),
  variance numeric generated always as (
    case when counted_quantity is null then null else counted_quantity - expected_quantity end
  ) stored,
  notes text,
  counted_by uuid references auth.users(id) on delete set null,
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, stock_item_id)
);

create unique index if not exists inventory_count_one_open_per_location_uidx
  on public.inventory_count_sessions(warehouse_location_id)
  where status in ('in_progress','submitted','approved');
create index if not exists idx_inventory_count_sessions_status on public.inventory_count_sessions(status, created_at desc);
create index if not exists idx_inventory_count_sessions_created_by on public.inventory_count_sessions(created_by);
create index if not exists idx_inventory_count_sessions_submitted_by on public.inventory_count_sessions(submitted_by) where submitted_by is not null;
create index if not exists idx_inventory_count_sessions_reviewed_by on public.inventory_count_sessions(reviewed_by) where reviewed_by is not null;
create index if not exists idx_inventory_count_sessions_applied_by on public.inventory_count_sessions(applied_by) where applied_by is not null;
create index if not exists idx_inventory_count_lines_session on public.inventory_count_lines(session_id);
create index if not exists idx_inventory_count_lines_stock_item on public.inventory_count_lines(stock_item_id);
create index if not exists idx_inventory_count_lines_counted_by on public.inventory_count_lines(counted_by) where counted_by is not null;

alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_lines enable row level security;

create policy inventory_count_sessions_select_scoped
on public.inventory_count_sessions
for select to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1
    from public.warehouse_locations wl
    join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = inventory_count_sessions.warehouse_location_id
      and public.can_access_operational_scope('inventory', w.location_id)
  )
);

create policy inventory_count_lines_select_scoped
on public.inventory_count_lines
for select to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1
    from public.inventory_count_sessions s
    join public.warehouse_locations wl on wl.id = s.warehouse_location_id
    join public.warehouses w on w.id = wl.warehouse_id
    where s.id = inventory_count_lines.session_id
      and public.can_access_operational_scope('inventory', w.location_id)
  )
);

create or replace function public.inventory_location_count_locked(p_warehouse_location_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.inventory_count_sessions s
    where s.warehouse_location_id = p_warehouse_location_id
      and s.status in ('in_progress','submitted','approved')
  );
$$;

create or replace function public.create_inventory_count_session(
  p_warehouse_location_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_session_id uuid := gen_random_uuid();
  v_code text;
  v_scope_location uuid;
  v_line_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl
  join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = p_warehouse_location_id and wl.is_active = true and w.is_active = true;

  if not found then raise exception 'Active warehouse location not found'; end if;
  if not public.can_access_operational_scope('inventory', v_scope_location) then
    raise exception 'Inventory scope required for this location';
  end if;
  if public.inventory_location_count_locked(p_warehouse_location_id) then
    raise exception 'This location already has an open inventory count';
  end if;

  v_code := 'CNT-' || to_char(current_date,'YYYYMMDD') || '-' || upper(substr(replace(v_session_id::text,'-',''),1,8));

  insert into public.inventory_count_sessions(id,count_code,warehouse_location_id,status,notes,created_by,created_at,updated_at)
  values(v_session_id,v_code,p_warehouse_location_id,'in_progress',nullif(trim(coalesce(p_notes,'')),''),v_user,now(),now());

  insert into public.inventory_count_lines(session_id,stock_item_id,expected_quantity,created_at,updated_at)
  select v_session_id,si.id,si.quantity_on_hand,now(),now()
  from public.inventory_stock_items si
  where si.warehouse_location_id = p_warehouse_location_id
    and si.is_active = true
  order by si.name,si.id;

  get diagnostics v_line_count = row_count;
  if v_line_count = 0 then
    raise exception 'No active stock items exist in this location';
  end if;

  return jsonb_build_object('session_id',v_session_id,'count_code',v_code,'status','in_progress','line_count',v_line_count);
end;
$$;

create or replace function public.record_inventory_count_line(
  p_line_id uuid,
  p_counted_quantity numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_line public.inventory_count_lines%rowtype;
  v_session public.inventory_count_sessions%rowtype;
  v_scope_location uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if p_counted_quantity is null or p_counted_quantity < 0 then raise exception 'Counted quantity must be zero or greater'; end if;

  select * into v_line from public.inventory_count_lines where id = p_line_id for update;
  if not found then raise exception 'Inventory count line not found'; end if;

  select * into v_session from public.inventory_count_sessions where id = v_line.session_id for update;
  if v_session.status <> 'in_progress' then raise exception 'Only in-progress counts can be edited'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for this location'; end if;

  update public.inventory_count_lines
     set counted_quantity = p_counted_quantity,
         notes = nullif(trim(coalesce(p_notes,'')),''),
         counted_by = v_user,
         counted_at = now(),
         updated_at = now()
   where id = v_line.id;

  update public.inventory_count_sessions set updated_at = now() where id = v_session.id;

  return jsonb_build_object(
    'line_id',v_line.id,
    'session_id',v_session.id,
    'expected_quantity',v_line.expected_quantity,
    'counted_quantity',p_counted_quantity,
    'variance',p_counted_quantity-v_line.expected_quantity
  );
end;
$$;

create or replace function public.submit_inventory_count_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_count_sessions%rowtype;
  v_scope_location uuid;
  v_variance_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;

  select * into v_session from public.inventory_count_sessions where id = p_session_id for update;
  if not found then raise exception 'Inventory count session not found'; end if;
  if v_session.status <> 'in_progress' then raise exception 'Only in-progress counts can be submitted'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for this location'; end if;

  if exists (select 1 from public.inventory_count_lines where session_id = v_session.id and counted_quantity is null) then
    raise exception 'All count lines must be completed before submission';
  end if;

  select count(*) into v_variance_count
  from public.inventory_count_lines
  where session_id = v_session.id and counted_quantity is distinct from expected_quantity;

  update public.inventory_count_sessions
     set status='submitted',submitted_by=v_user,submitted_at=now(),updated_at=now()
   where id=v_session.id;

  return jsonb_build_object('session_id',v_session.id,'status','submitted','variance_count',v_variance_count);
end;
$$;

create or replace function public.review_inventory_count_session(
  p_session_id uuid,
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
  v_session public.inventory_count_sessions%rowtype;
  v_scope_location uuid;
  v_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Inventory approval role required'; end if;

  select * into v_session from public.inventory_count_sessions where id = p_session_id for update;
  if not found then raise exception 'Inventory count session not found'; end if;
  if v_session.status <> 'submitted' then raise exception 'Only submitted counts can be reviewed'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for this location'; end if;

  v_status := case when p_approved then 'approved' else 'rejected' end;
  update public.inventory_count_sessions
     set status=v_status,reviewed_by=v_user,reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
   where id=v_session.id;

  return jsonb_build_object('session_id',v_session.id,'status',v_status);
end;
$$;

create or replace function public.apply_inventory_count_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_session public.inventory_count_sessions%rowtype;
  v_line public.inventory_count_lines%rowtype;
  v_item public.inventory_stock_items%rowtype;
  v_scope_location uuid;
  v_adjusted integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver') then raise exception 'Inventory approval role required'; end if;

  select * into v_session from public.inventory_count_sessions where id = p_session_id for update;
  if not found then raise exception 'Inventory count session not found'; end if;
  if v_session.status <> 'approved' then raise exception 'Only approved counts can be applied'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for this location'; end if;

  for v_line in
    select * from public.inventory_count_lines where session_id=v_session.id order by id
  loop
    if v_line.counted_quantity is null then raise exception 'Count session contains an uncounted line'; end if;

    select * into v_item from public.inventory_stock_items where id=v_line.stock_item_id for update;
    if not found then raise exception 'Stock item in count session no longer exists'; end if;
    if v_item.warehouse_location_id <> v_session.warehouse_location_id then raise exception 'Stock item moved after count session started'; end if;
    if v_item.quantity_on_hand <> v_line.expected_quantity then
      raise exception 'Stock balance changed after count session started for item %', v_item.name;
    end if;

    update public.inventory_stock_items
       set quantity_on_hand=v_line.counted_quantity,
           last_counted_at=now(),
           last_counted_by=v_user,
           updated_at=now()
     where id=v_item.id;

    if v_line.counted_quantity <> v_line.expected_quantity then
      insert into public.inventory_stock_movements(
        stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,
        from_location_id,to_location_id,notes,moved_by,moved_at
      ) values (
        v_item.id,'adjustment',abs(v_line.counted_quantity-v_line.expected_quantity),v_item.unit_cost,
        v_line.expected_quantity,v_line.counted_quantity,v_session.warehouse_location_id,v_session.warehouse_location_id,
        'Conteo '||v_session.count_code||'. '||coalesce(v_line.notes,'Diferencia de conteo físico'),v_user,now()
      );
      v_adjusted := v_adjusted + 1;
    end if;
  end loop;

  update public.inventory_count_sessions
     set status='applied',applied_by=v_user,applied_at=now(),updated_at=now()
   where id=v_session.id;

  return jsonb_build_object('session_id',v_session.id,'status','applied','adjusted_lines',v_adjusted);
end;
$$;

create or replace function public.cancel_inventory_count_session(
  p_session_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_session public.inventory_count_sessions%rowtype;
  v_scope_location uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Cancellation reason is required'; end if;

  select * into v_session from public.inventory_count_sessions where id=p_session_id for update;
  if not found then raise exception 'Inventory count session not found'; end if;
  if v_session.status not in ('in_progress','submitted','approved') then raise exception 'This count session cannot be cancelled'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id = wl.warehouse_id
  where wl.id=v_session.warehouse_location_id;
  if not public.can_access_operational_scope('inventory',v_scope_location) then raise exception 'Inventory scope required for this location'; end if;

  update public.inventory_count_sessions
     set status='cancelled',review_notes=concat_ws(E'\n',review_notes,'Cancelado: '||trim(p_reason)),reviewed_by=v_user,reviewed_at=now(),updated_at=now()
   where id=v_session.id;

  return jsonb_build_object('session_id',v_session.id,'status','cancelled');
end;
$$;

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

  select * into v_item from public.inventory_stock_items where id=p_stock_item_id for update;
  if not found then raise exception 'Stock item not found'; end if;
  if not v_item.is_active then raise exception 'Inactive stock items cannot be operated'; end if;
  if public.inventory_location_count_locked(v_item.warehouse_location_id) then raise exception 'Source location is frozen by an active inventory count'; end if;

  select w.location_id into v_source_scope_location
  from public.warehouse_locations wl join public.warehouses w on w.id=wl.warehouse_id
  where wl.id=v_item.warehouse_location_id;
  if not public.can_access_operational_scope('inventory',v_source_scope_location) then raise exception 'Inventory scope required for source location'; end if;

  v_before:=v_item.quantity_on_hand;

  if p_operation='issue' then
    if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
    if p_quantity>v_before then raise exception 'Insufficient stock'; end if;
    v_after:=v_before-p_quantity;
    update public.inventory_stock_items set quantity_on_hand=v_after,updated_at=now() where id=v_item.id;
    insert into public.inventory_stock_movements(stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,from_location_id,to_location_id,notes,moved_by,moved_at)
    values(v_item.id,'issue',p_quantity,v_item.unit_cost,v_before,v_after,v_item.warehouse_location_id,null,trim(p_reason),v_user,now());

  elsif p_operation='return' then
    if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
    v_after:=v_before+p_quantity;
    update public.inventory_stock_items set quantity_on_hand=v_after,updated_at=now() where id=v_item.id;
    insert into public.inventory_stock_movements(stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,from_location_id,to_location_id,notes,moved_by,moved_at)
    values(v_item.id,'return',p_quantity,v_item.unit_cost,v_before,v_after,null,v_item.warehouse_location_id,trim(p_reason),v_user,now());

  elsif p_operation in ('adjustment','count') then
    if p_new_balance is null or p_new_balance<0 then raise exception 'New balance must be zero or greater'; end if;
    if p_new_balance=v_before then raise exception 'New balance must differ from current balance'; end if;
    v_after:=p_new_balance;
    update public.inventory_stock_items
      set quantity_on_hand=v_after,
          last_counted_at=case when p_operation='count' then now() else last_counted_at end,
          last_counted_by=case when p_operation='count' then v_user else last_counted_by end,
          updated_at=now()
      where id=v_item.id;
    insert into public.inventory_stock_movements(stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,from_location_id,to_location_id,notes,moved_by,moved_at)
    values(v_item.id,'adjustment',abs(v_after-v_before),v_item.unit_cost,v_before,v_after,v_item.warehouse_location_id,v_item.warehouse_location_id,(case when p_operation='count' then 'Conteo físico. ' else 'Ajuste. ' end)||trim(p_reason),v_user,now());

  elsif p_operation='transfer' then
    if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
    if p_quantity>v_before then raise exception 'Insufficient stock'; end if;
    if p_to_location_id is null then raise exception 'Destination location is required'; end if;
    if p_to_location_id=v_item.warehouse_location_id then raise exception 'Destination must differ from source location'; end if;
    if public.inventory_location_count_locked(p_to_location_id) then raise exception 'Destination location is frozen by an active inventory count'; end if;

    select w.location_id into v_target_scope_location
    from public.warehouse_locations wl join public.warehouses w on w.id=wl.warehouse_id
    where wl.id=p_to_location_id and wl.is_active=true and w.is_active=true;
    if not found then raise exception 'Active destination location not found'; end if;
    if not public.can_access_operational_scope('inventory',v_target_scope_location) then raise exception 'Inventory scope required for destination location'; end if;

    insert into public.inventory_stock_items(item_code,name,category,unit,warehouse_location_id,cost_center_id,quantity_on_hand,minimum_stock,reorder_quantity,unit_cost,source_request_id,is_active,created_by,created_at,updated_at)
    values('STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),v_item.name,v_item.category,v_item.unit,p_to_location_id,v_item.cost_center_id,0,v_item.minimum_stock,v_item.reorder_quantity,v_item.unit_cost,v_item.source_request_id,true,v_user,now(),now())
    on conflict(name,warehouse_location_id,unit) do update set updated_at=excluded.updated_at
    returning id into v_target_id;

    select * into v_target from public.inventory_stock_items where id=v_target_id for update;
    v_target_before:=v_target.quantity_on_hand;
    v_after:=v_before-p_quantity;
    v_target_after:=v_target_before+p_quantity;
    v_transfer_group:=gen_random_uuid();

    update public.inventory_stock_items set quantity_on_hand=v_after,updated_at=now() where id=v_item.id;
    update public.inventory_stock_items set quantity_on_hand=v_target_after,unit_cost=coalesce(v_item.unit_cost,unit_cost),cost_center_id=coalesce(v_item.cost_center_id,cost_center_id),updated_at=now() where id=v_target.id;

    insert into public.inventory_stock_movements(stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,from_location_id,to_location_id,transfer_group_id,notes,moved_by,moved_at)
    values
      (v_item.id,'transfer_out',p_quantity,v_item.unit_cost,v_before,v_after,v_item.warehouse_location_id,p_to_location_id,v_transfer_group,trim(p_reason),v_user,now()),
      (v_target.id,'transfer_in',p_quantity,v_item.unit_cost,v_target_before,v_target_after,v_item.warehouse_location_id,p_to_location_id,v_transfer_group,trim(p_reason),v_user,now());
  end if;

  return jsonb_build_object('stock_item_id',v_item.id,'operation',p_operation,'balance_before',v_before,'balance_after',coalesce(v_after,v_before),'target_stock_item_id',v_target_id,'target_balance_after',v_target_after,'transfer_group_id',v_transfer_group);
end;
$$;

create or replace function public.process_procurement_inventory_intake(
  p_intake_id uuid,
  p_warehouse_location_id uuid,
  p_asset_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_asset_class text default 'equipment',
  p_minimum_stock numeric default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_intake_type text;
  v_intake_status text;
  v_receipt_item_id uuid;
  v_scope_location_id uuid;
  v_target_scope_location_id uuid;
  v_received numeric;
  v_request_id uuid;
  v_title text;
  v_category text;
  v_unit text;
  v_quantity numeric;
  v_description text;
  v_order_id uuid;
  v_order_number text;
  v_order_total numeric;
  v_asset_id uuid;
  v_stock_id uuid;
  v_count integer;
  v_unit_cost numeric;
  v_code text;
  v_balance_before numeric := 0;
  v_balance_after numeric;
  i integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;

  select intake_type,status,receipt_item_id,location_id
    into v_intake_type,v_intake_status,v_receipt_item_id,v_scope_location_id
  from public.procurement_inventory_intake
  where id=p_intake_id
  for update;
  if not found then raise exception 'Inventory intake not found'; end if;
  if not public.can_access_operational_scope('inventory',v_scope_location_id) then raise exception 'Inventory scope required for intake location'; end if;
  if v_intake_status<>'pending' then raise exception 'Inventory intake already processed or cancelled'; end if;
  if p_warehouse_location_id is null then raise exception 'Warehouse location is required'; end if;

  select w.location_id into v_target_scope_location_id
  from public.warehouse_locations wl
  join public.warehouses w on w.id=wl.warehouse_id
  where wl.id=p_warehouse_location_id and wl.is_active=true and w.is_active=true;
  if not found then raise exception 'Active destination warehouse location not found'; end if;
  if not public.can_access_operational_scope('inventory',v_target_scope_location_id) then raise exception 'Inventory scope required for destination location'; end if;

  select ri.received_quantity,r.id,r.title,r.category,r.unit,r.quantity,r.description
    into v_received,v_request_id,v_title,v_category,v_unit,v_quantity,v_description
  from public.procurement_receipt_items ri
  join public.procurement_requests r on r.id=ri.request_id
  where ri.id=v_receipt_item_id;

  select po.id,po.order_number,po.total
    into v_order_id,v_order_number,v_order_total
  from public.procurement_receipt_items ri
  join public.procurement_receipts pr on pr.id=ri.receipt_id
  join public.procurement_purchase_orders po on po.id=pr.purchase_order_id
  where ri.id=v_receipt_item_id;

  if v_received<=0 then raise exception 'Nothing accepted for inventory'; end if;
  v_unit_cost:=case when v_quantity>0 then round(v_order_total/v_quantity,2) else null end;

  if v_intake_type='asset' then
    if p_asset_category_id is null or p_cost_center_id is null then raise exception 'Asset category and cost center are required'; end if;
    if p_asset_class not in ('equipment','infrastructure','tool','vehicle','other') then raise exception 'Invalid asset class'; end if;
    if v_received<>trunc(v_received) then raise exception 'Asset quantity must be a whole number'; end if;
    v_count:=v_received::integer;
    if v_count>100 then raise exception 'Maximum 100 assets per intake'; end if;

    for i in 1..v_count loop
      v_code:='FC-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      insert into public.assets(name,type,asset_code,category_id,cost_center_id,purchase_date,purchase_price,status,warehouse_location_id,asset_class,description,notes,created_by)
      values(v_title,lower(coalesce(v_category,'equipment')),v_code,p_asset_category_id,p_cost_center_id,current_date,v_unit_cost,'active',p_warehouse_location_id,p_asset_class,v_description,concat_ws(E'\n','Creado desde recepción de compra '||coalesce(v_order_number,v_order_id::text),p_notes),v_user)
      returning id into v_asset_id;
      insert into public.inventory_movements(asset_id,movement_type,to_location_id,notes,moved_by)
      values(v_asset_id,'receipt',p_warehouse_location_id,'Ingreso desde recepción de compra',v_user);
      insert into public.asset_logs(asset_id,log_type,description,created_by)
      values(v_asset_id,'procurement_receipt','Activo creado desde recepción de compra',v_user);
      insert into public.procurement_intake_assets(intake_id,asset_id) values(p_intake_id,v_asset_id);
    end loop;

    update public.procurement_inventory_intake
    set status='processed',warehouse_location_id=p_warehouse_location_id,asset_category_id=p_asset_category_id,cost_center_id=p_cost_center_id,linked_asset_id=v_asset_id,processed_quantity=v_received,reconciliation_status='matched',processed_by=v_user,processed_at=now(),notes=p_notes,updated_at=now()
    where id=p_intake_id;
    return jsonb_build_object('type','asset','created',v_count,'last_asset_id',v_asset_id);

  elsif v_intake_type='consumable' then
    if public.inventory_location_count_locked(p_warehouse_location_id) then raise exception 'Destination location is frozen by an active inventory count'; end if;

    select id,quantity_on_hand into v_stock_id,v_balance_before
    from public.inventory_stock_items
    where name=v_title and warehouse_location_id=p_warehouse_location_id and unit=v_unit
    for update;

    if v_stock_id is null then
      v_code:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      v_balance_before:=0;
      insert into public.inventory_stock_items(item_code,name,category,unit,warehouse_location_id,cost_center_id,quantity_on_hand,minimum_stock,unit_cost,source_request_id,created_by)
      values(v_code,v_title,v_category,v_unit,p_warehouse_location_id,p_cost_center_id,v_received,greatest(coalesce(p_minimum_stock,0),0),v_unit_cost,v_request_id,v_user)
      returning id,quantity_on_hand into v_stock_id,v_balance_after;
    else
      update public.inventory_stock_items
      set quantity_on_hand=quantity_on_hand+v_received,unit_cost=coalesce(v_unit_cost,unit_cost),cost_center_id=coalesce(p_cost_center_id,cost_center_id),updated_at=now()
      where id=v_stock_id
      returning quantity_on_hand into v_balance_after;
    end if;

    insert into public.inventory_stock_movements(stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,to_location_id,procurement_intake_id,notes,moved_by,moved_at)
    values(v_stock_id,'receipt',v_received,v_unit_cost,v_balance_before,v_balance_after,p_warehouse_location_id,p_intake_id,coalesce(p_notes,'Ingreso desde recepción de compra'),v_user,now());

    update public.procurement_inventory_intake
    set status='processed',warehouse_location_id=p_warehouse_location_id,cost_center_id=p_cost_center_id,linked_stock_item_id=v_stock_id,processed_quantity=v_received,reconciliation_status='matched',processed_by=v_user,processed_at=now(),notes=p_notes,updated_at=now()
    where id=p_intake_id;
    return jsonb_build_object('type','consumable','stock_item_id',v_stock_id,'quantity_added',v_received,'balance_before',v_balance_before,'balance_after',v_balance_after);
  end if;

  raise exception 'Unsupported intake type';
end;
$$;

revoke all on function public.inventory_location_count_locked(uuid) from public,anon,authenticated;
revoke all on function public.create_inventory_count_session(uuid,text) from public,anon,authenticated;
revoke all on function public.record_inventory_count_line(uuid,numeric,text) from public,anon,authenticated;
revoke all on function public.submit_inventory_count_session(uuid) from public,anon,authenticated;
revoke all on function public.review_inventory_count_session(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.apply_inventory_count_session(uuid) from public,anon,authenticated;
revoke all on function public.cancel_inventory_count_session(uuid,text) from public,anon,authenticated;

grant execute on function public.create_inventory_count_session(uuid,text) to authenticated,service_role;
grant execute on function public.record_inventory_count_line(uuid,numeric,text) to authenticated,service_role;
grant execute on function public.submit_inventory_count_session(uuid) to authenticated,service_role;
grant execute on function public.review_inventory_count_session(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.apply_inventory_count_session(uuid) to authenticated,service_role;
grant execute on function public.cancel_inventory_count_session(uuid,text) to authenticated,service_role;

comment on table public.inventory_count_sessions is 'Cycle-count sessions that freeze one warehouse location until submission/review/application or cancellation.';
comment on table public.inventory_count_lines is 'Snapshot and physical-count lines for an inventory cycle-count session. Quantity changes are applied only through the approved count RPC.';

create table if not exists public.inventory_asset_custodies (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_name_snapshot text not null,
  status text not null default 'active' check (status in ('active','returned')),
  issued_from_location_id uuid references public.warehouse_locations(id) on delete set null,
  returned_to_location_id uuid references public.warehouse_locations(id) on delete set null,
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  returned_by uuid references auth.users(id) on delete set null,
  issue_condition text,
  return_condition text,
  issue_notes text not null,
  return_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_asset_custodies_due_after_issue check (due_at is null or due_at > issued_at),
  constraint inventory_asset_custodies_return_shape check (
    (status = 'active' and returned_at is null and returned_by is null)
    or
    (status = 'returned' and returned_at is not null)
  )
);

create unique index if not exists inventory_asset_custodies_one_active_per_asset_uidx
  on public.inventory_asset_custodies(asset_id)
  where status = 'active';

create index if not exists idx_inventory_asset_custodies_employee
  on public.inventory_asset_custodies(employee_id, status);

create index if not exists idx_inventory_asset_custodies_due
  on public.inventory_asset_custodies(due_at)
  where status = 'active' and due_at is not null;

create index if not exists idx_inventory_asset_custodies_issued_from_location
  on public.inventory_asset_custodies(issued_from_location_id)
  where issued_from_location_id is not null;

create index if not exists idx_inventory_asset_custodies_returned_to_location
  on public.inventory_asset_custodies(returned_to_location_id)
  where returned_to_location_id is not null;

create index if not exists idx_inventory_asset_custodies_issued_by
  on public.inventory_asset_custodies(issued_by)
  where issued_by is not null;

create index if not exists idx_inventory_asset_custodies_returned_by
  on public.inventory_asset_custodies(returned_by)
  where returned_by is not null;

alter table public.inventory_asset_custodies enable row level security;

revoke all on table public.inventory_asset_custodies from anon, authenticated;
grant select on table public.inventory_asset_custodies to authenticated;

drop policy if exists inventory_asset_custodies_select_scoped on public.inventory_asset_custodies;
create policy inventory_asset_custodies_select_scoped
on public.inventory_asset_custodies
for select
to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1
    from public.assets a
    left join public.warehouse_locations current_wl on current_wl.id = a.warehouse_location_id
    left join public.warehouses current_w on current_w.id = current_wl.warehouse_id
    left join public.warehouse_locations issued_wl on issued_wl.id = inventory_asset_custodies.issued_from_location_id
    left join public.warehouses issued_w on issued_w.id = issued_wl.warehouse_id
    left join public.warehouse_locations returned_wl on returned_wl.id = inventory_asset_custodies.returned_to_location_id
    left join public.warehouses returned_w on returned_w.id = returned_wl.warehouse_id
    where a.id = inventory_asset_custodies.asset_id
      and public.can_access_operational_scope(
        'inventory',
        coalesce(returned_w.location_id, issued_w.location_id, current_w.location_id)
      )
  )
);

create or replace function public.list_inventory_custodians()
returns table(employee_id uuid, employee_name text, employee_role text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.can_app_action('inventory.process') then
    raise exception 'Inventory permission required';
  end if;

  return query
  select e.id, e.name, e.role
  from public.employees e
  where coalesce(e.is_active, true)
  order by e.name;
end;
$$;

revoke all on function public.list_inventory_custodians() from public, anon;
grant execute on function public.list_inventory_custodians() to authenticated;

create or replace function public.assign_inventory_asset_custody(
  p_asset_id uuid,
  p_employee_id uuid,
  p_reason text,
  p_due_at timestamptz default null,
  p_issue_condition text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_employee public.employees%rowtype;
  v_scope_location uuid;
  v_custody_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Custody reason is required'; end if;
  if p_due_at is not null and p_due_at <= now() then raise exception 'Custody due date must be in the future'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Deprecated assets cannot be assigned'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_scope_location
    from public.warehouse_locations wl
    join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
  end if;
  if not public.can_access_operational_scope('inventory', v_scope_location) then
    raise exception 'Inventory scope required for asset location';
  end if;

  select * into v_employee from public.employees where id = p_employee_id and coalesce(is_active, true) for share;
  if not found then raise exception 'Active employee not found'; end if;

  if exists (
    select 1 from public.inventory_asset_custodies c
    where c.asset_id = v_asset.id and c.status = 'active'
  ) then
    raise exception 'Asset already has an active custody';
  end if;

  insert into public.inventory_asset_custodies(
    asset_id,
    employee_id,
    employee_name_snapshot,
    status,
    issued_from_location_id,
    issued_at,
    due_at,
    issued_by,
    issue_condition,
    issue_notes
  ) values (
    v_asset.id,
    v_employee.id,
    v_employee.name,
    'active',
    v_asset.warehouse_location_id,
    now(),
    p_due_at,
    v_user,
    nullif(trim(coalesce(p_issue_condition,'')), ''),
    trim(p_reason)
  ) returning id into v_custody_id;

  update public.assets
     set assigned_to = v_employee.name,
         updated_at = now()
   where id = v_asset.id;

  insert into public.inventory_movements(
    asset_id, movement_type, from_location_id, to_location_id, assigned_to, notes, moved_by, moved_at
  ) values (
    v_asset.id, 'assignment', v_asset.warehouse_location_id, v_asset.warehouse_location_id,
    v_employee.name, trim(p_reason), v_user, now()
  );

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values (
    v_asset.id,
    'custody_assignment',
    'Custody assigned. ' || trim(p_reason),
    v_user,
    now()
  );

  return jsonb_build_object(
    'custody_id', v_custody_id,
    'asset_id', v_asset.id,
    'employee_id', v_employee.id,
    'employee_name', v_employee.name,
    'due_at', p_due_at
  );
end;
$$;

revoke all on function public.assign_inventory_asset_custody(uuid, uuid, text, timestamptz, text) from public, anon;
grant execute on function public.assign_inventory_asset_custody(uuid, uuid, text, timestamptz, text) to authenticated;

create or replace function public.return_inventory_asset_custody(
  p_asset_id uuid,
  p_to_location_id uuid,
  p_reason text,
  p_return_condition text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_location public.warehouse_locations%rowtype;
  v_custody public.inventory_asset_custodies%rowtype;
  v_source_scope_location uuid;
  v_target_scope_location uuid;
  v_location_label text;
  v_legacy_custodian text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'Return reason is required'; end if;
  if p_to_location_id is null then raise exception 'Destination location is required'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Deprecated assets cannot be returned'; end if;

  if v_asset.warehouse_location_id is not null then
    select w.location_id into v_source_scope_location
    from public.warehouse_locations wl
    join public.warehouses w on w.id = wl.warehouse_id
    where wl.id = v_asset.warehouse_location_id;
  end if;
  if not public.can_access_operational_scope('inventory', v_source_scope_location) then
    raise exception 'Inventory scope required for source location';
  end if;

  select * into v_location
  from public.warehouse_locations
  where id = p_to_location_id and is_active = true;
  if not found then raise exception 'Active destination location not found'; end if;

  select w.location_id, concat_ws(' · ', w.name, v_location.name)
    into v_target_scope_location, v_location_label
  from public.warehouses w
  where w.id = v_location.warehouse_id and w.is_active = true;
  if not found then raise exception 'Active destination warehouse not found'; end if;
  if not public.can_access_operational_scope('inventory', v_target_scope_location) then
    raise exception 'Inventory scope required for destination location';
  end if;

  select * into v_custody
  from public.inventory_asset_custodies
  where asset_id = v_asset.id and status = 'active'
  for update;

  v_legacy_custodian := nullif(trim(coalesce(v_asset.assigned_to,'')), '');
  if not found and v_legacy_custodian is null then
    raise exception 'Asset has no active custody';
  end if;

  if found then
    update public.inventory_asset_custodies
       set status = 'returned',
           returned_to_location_id = p_to_location_id,
           returned_at = now(),
           returned_by = v_user,
           return_condition = nullif(trim(coalesce(p_return_condition,'')), ''),
           return_notes = trim(p_reason),
           updated_at = now()
     where id = v_custody.id;
  end if;

  update public.assets
     set warehouse_location_id = p_to_location_id,
         location = v_location_label,
         assigned_to = null,
         updated_at = now()
   where id = v_asset.id;

  insert into public.inventory_movements(
    asset_id, movement_type, from_location_id, to_location_id, assigned_to, notes, moved_by, moved_at
  ) values (
    v_asset.id, 'return', v_asset.warehouse_location_id, p_to_location_id,
    null, trim(p_reason), v_user, now()
  );

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values (
    v_asset.id,
    'custody_return',
    'Custody returned. ' || trim(p_reason),
    v_user,
    now()
  );

  return jsonb_build_object(
    'custody_id', case when v_custody.id is null then null else v_custody.id end,
    'asset_id', v_asset.id,
    'location_id', p_to_location_id,
    'legacy_return', v_custody.id is null
  );
end;
$$;

revoke all on function public.return_inventory_asset_custody(uuid, uuid, text, text) from public, anon;
grant execute on function public.return_inventory_asset_custody(uuid, uuid, text, text) to authenticated;

comment on table public.inventory_asset_custodies is
  'Formal custody ledger for serialized inventory assets. Client writes are blocked; assignment and return are transactional RPC workflows.';
create index if not exists idx_maintenance_tasks_asset_id
  on public.maintenance_tasks(asset_id)
  where asset_id is not null;

-- Asset-linked maintenance is read through scope but written only via the transactional RPC workflow.
drop policy if exists maintenance_tasks_select_scoped on public.maintenance_tasks;
drop policy if exists maintenance_tasks_insert_authorized on public.maintenance_tasks;
drop policy if exists maintenance_tasks_update_authorized on public.maintenance_tasks;
drop policy if exists maintenance_tasks_delete_admin on public.maintenance_tasks;

create policy maintenance_tasks_select_scoped
on public.maintenance_tasks
for select
to authenticated
using (
  case
    when maintenance_tasks.asset_id is not null then exists (
      select 1
      from public.assets a
      join public.warehouse_locations wl on wl.id = a.warehouse_location_id
      join public.warehouses w on w.id = wl.warehouse_id
      where a.id = maintenance_tasks.asset_id
        and public.can_access_operational_scope('maintenance', w.location_id)
    )
    else public.can_access_operational_scope(
      'maintenance',
      coalesce(
        (select r.location_id from public.rooms r where r.id = maintenance_tasks.room_id),
        (select rv.location_id from public.reservations rv where rv.id = maintenance_tasks.reservation_id)
      )
    )
  end
);

create policy maintenance_tasks_insert_authorized
on public.maintenance_tasks
for insert
to authenticated
with check (
  maintenance_tasks.asset_id is null
  and public.can_app_action('maintenance.operate')
  and public.can_access_operational_scope(
    'maintenance',
    coalesce(
      (select r.location_id from public.rooms r where r.id = maintenance_tasks.room_id),
      (select rv.location_id from public.reservations rv where rv.id = maintenance_tasks.reservation_id)
    )
  )
);

create policy maintenance_tasks_update_authorized
on public.maintenance_tasks
for update
to authenticated
using (
  maintenance_tasks.asset_id is null
  and public.can_app_action('maintenance.operate')
  and public.can_access_operational_scope(
    'maintenance',
    coalesce(
      (select r.location_id from public.rooms r where r.id = maintenance_tasks.room_id),
      (select rv.location_id from public.reservations rv where rv.id = maintenance_tasks.reservation_id)
    )
  )
)
with check (
  maintenance_tasks.asset_id is null
  and public.can_app_action('maintenance.operate')
  and public.can_access_operational_scope(
    'maintenance',
    coalesce(
      (select r.location_id from public.rooms r where r.id = maintenance_tasks.room_id),
      (select rv.location_id from public.reservations rv where rv.id = maintenance_tasks.reservation_id)
    )
  )
);

create policy maintenance_tasks_delete_admin
on public.maintenance_tasks
for delete
to authenticated
using (
  maintenance_tasks.asset_id is null
  and public.current_app_role() = 'admin'
);

create or replace function public.sync_inventory_asset_maintenance_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset_id uuid := coalesce(new.asset_id, old.asset_id);
  v_new_state text := case when tg_op = 'DELETE' then null else coalesce(new.estado_extendido, new.status, 'draft') end;
  v_has_active boolean;
begin
  if v_asset_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op <> 'DELETE' and v_new_state in ('in_progress','blocked') then
    update public.assets
       set status = 'maintenance', updated_at = now()
     where id = v_asset_id and coalesce(status, 'active') <> 'deprecated';
  else
    select exists (
      select 1
      from public.maintenance_tasks mt
      where mt.asset_id = v_asset_id
        and mt.id <> coalesce(case when tg_op = 'DELETE' then old.id else new.id end, gen_random_uuid())
        and coalesce(mt.estado_extendido, mt.status, '') in ('in_progress','blocked')
    ) into v_has_active;

    if not v_has_active then
      update public.assets
         set status = 'active', updated_at = now()
       where id = v_asset_id and status = 'maintenance';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_inventory_asset_maintenance_status() from public, anon, authenticated;

drop trigger if exists trg_sync_inventory_asset_maintenance_status on public.maintenance_tasks;
create trigger trg_sync_inventory_asset_maintenance_status
after insert or update of asset_id, status, estado_extendido or delete
on public.maintenance_tasks
for each row
execute function public.sync_inventory_asset_maintenance_status();

create or replace function public.create_inventory_asset_maintenance_task(
  p_asset_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_priority text default 'medium',
  p_duration_minutes integer default 30,
  p_work_type text default 'maintenance',
  p_target_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_asset public.assets%rowtype;
  v_scope_location uuid;
  v_employee public.employees%rowtype;
  v_task_id uuid;
  v_initial_state text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if not public.can_app_action('maintenance.operate') then raise exception 'Maintenance permission required'; end if;
  if nullif(trim(coalesce(p_title,'')), '') is null then raise exception 'Maintenance title is required'; end if;
  if p_priority not in ('low','medium','high','critical') then raise exception 'Invalid maintenance priority'; end if;
  if p_work_type not in ('cleaning','inspection','repair','maintenance','installation') then raise exception 'Invalid maintenance work type'; end if;
  if p_duration_minutes is null or p_duration_minutes < 5 then raise exception 'Duration must be at least 5 minutes'; end if;
  if p_target_date is null or p_target_date < current_date then raise exception 'Target date cannot be in the past'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Deprecated assets cannot receive maintenance work'; end if;
  if v_asset.warehouse_location_id is null then raise exception 'Asset requires a warehouse location before maintenance can be scheduled'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl
  join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_asset.warehouse_location_id and wl.is_active = true and w.is_active = true;
  if not found then raise exception 'Active asset warehouse location not found'; end if;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for asset location'; end if;
  if not public.can_access_operational_scope('maintenance', v_scope_location) then raise exception 'Maintenance scope required for asset location'; end if;

  if p_assigned_to is not null then
    select * into v_employee from public.employees where id = p_assigned_to and coalesce(is_active, true) for share;
    if not found then raise exception 'Active maintenance assignee not found'; end if;
  end if;

  v_initial_state := case when p_assigned_to is null then 'scheduled' else 'assigned' end;

  insert into public.maintenance_tasks(
    asset_id, title, description, assigned_to, prioridad, estado_extendido, status,
    duracion_estimada_minutos, tipo_trabajo, fecha_objetivo, next_run, bloqueado
  ) values (
    v_asset.id,
    trim(p_title),
    nullif(trim(coalesce(p_description,'')), ''),
    p_assigned_to,
    p_priority,
    v_initial_state,
    v_initial_state,
    p_duration_minutes,
    p_work_type,
    p_target_date,
    p_target_date,
    false
  ) returning id into v_task_id;

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values (
    v_asset.id,
    'maintenance_scheduled',
    'Maintenance scheduled: ' || trim(p_title),
    v_user,
    now()
  );

  return jsonb_build_object(
    'task_id', v_task_id,
    'asset_id', v_asset.id,
    'state', v_initial_state,
    'target_date', p_target_date
  );
end;
$$;

revoke all on function public.create_inventory_asset_maintenance_task(uuid,text,text,uuid,text,integer,text,date) from public, anon;
grant execute on function public.create_inventory_asset_maintenance_task(uuid,text,text,uuid,text,integer,text,date) to authenticated;

create or replace function public.transition_inventory_asset_maintenance_task(
  p_task_id uuid,
  p_action text,
  p_notes text,
  p_evidence_url text default null,
  p_actual_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_task public.maintenance_tasks%rowtype;
  v_asset public.assets%rowtype;
  v_scope_location uuid;
  v_state text;
  v_next_state text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;
  if not public.can_app_action('maintenance.operate') then raise exception 'Maintenance permission required'; end if;
  if p_action not in ('start','block','resume','complete','cancel') then raise exception 'Invalid maintenance action'; end if;
  if nullif(trim(coalesce(p_notes,'')), '') is null then raise exception 'Transition notes are required'; end if;
  if p_actual_minutes is not null and p_actual_minutes < 0 then raise exception 'Actual duration cannot be negative'; end if;

  select * into v_task from public.maintenance_tasks where id = p_task_id for update;
  if not found then raise exception 'Maintenance task not found'; end if;
  if v_task.asset_id is null then raise exception 'Maintenance task is not linked to an inventory asset'; end if;

  select * into v_asset from public.assets where id = v_task.asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if v_asset.status = 'deprecated' then raise exception 'Deprecated assets cannot transition maintenance work'; end if;
  if v_asset.warehouse_location_id is null then raise exception 'Asset warehouse location is required'; end if;

  select w.location_id into v_scope_location
  from public.warehouse_locations wl
  join public.warehouses w on w.id = wl.warehouse_id
  where wl.id = v_asset.warehouse_location_id and wl.is_active = true and w.is_active = true;
  if not found then raise exception 'Active asset warehouse location not found'; end if;
  if not public.can_access_operational_scope('inventory', v_scope_location) then raise exception 'Inventory scope required for asset location'; end if;
  if not public.can_access_operational_scope('maintenance', v_scope_location) then raise exception 'Maintenance scope required for asset location'; end if;

  v_state := coalesce(v_task.estado_extendido, v_task.status, 'draft');

  if p_action = 'start' and v_state in ('scheduled','assigned') then v_next_state := 'in_progress';
  elsif p_action = 'block' and v_state = 'in_progress' then v_next_state := 'blocked';
  elsif p_action = 'resume' and v_state = 'blocked' then v_next_state := 'in_progress';
  elsif p_action = 'complete' and v_state in ('in_progress','blocked') then v_next_state := 'completed';
  elsif p_action = 'cancel' and v_state in ('scheduled','assigned','in_progress','blocked') then v_next_state := 'cancelled';
  else raise exception 'Invalid maintenance transition from % using %', v_state, p_action;
  end if;

  update public.maintenance_tasks
     set status = v_next_state,
         estado_extendido = v_next_state,
         bloqueado = (v_next_state = 'blocked'),
         last_completed = case when v_next_state = 'completed' then current_date else last_completed end,
         fecha_completado = case when v_next_state = 'completed' then now() else fecha_completado end,
         evidencia_url = case when v_next_state = 'completed' and nullif(trim(coalesce(p_evidence_url,'')), '') is not null then trim(p_evidence_url) else evidencia_url end,
         duracion_real_minutos = case when v_next_state = 'completed' and p_actual_minutes is not null then p_actual_minutes else duracion_real_minutos end
   where id = v_task.id;

  insert into public.asset_logs(asset_id, log_type, description, created_by, created_at)
  values (
    v_asset.id,
    'maintenance_' || p_action,
    'Maintenance ' || p_action || ': ' || trim(p_notes),
    v_user,
    now()
  );

  return jsonb_build_object(
    'task_id', v_task.id,
    'asset_id', v_asset.id,
    'previous_state', v_state,
    'state', v_next_state,
    'action', p_action
  );
end;
$$;

revoke all on function public.transition_inventory_asset_maintenance_task(uuid,text,text,text,integer) from public, anon;
grant execute on function public.transition_inventory_asset_maintenance_task(uuid,text,text,text,integer) to authenticated;

comment on function public.create_inventory_asset_maintenance_task(uuid,text,text,uuid,text,integer,text,date) is
  'Creates asset-linked maintenance atomically with inventory/maintenance permissions and physical location scope.';
comment on function public.transition_inventory_asset_maintenance_task(uuid,text,text,text,integer) is
  'Transitions asset-linked maintenance through a controlled state machine; a trigger synchronizes asset maintenance status.';
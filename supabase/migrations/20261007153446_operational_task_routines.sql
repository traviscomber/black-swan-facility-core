-- Operational routines for Black Swan People OS.
-- Stores operator-confirmed recurring work and materializes daily tasks without
-- inventing completion or silently mutating historical work.

alter table public.tasks
  drop constraint if exists tasks_source_type_check;

alter table public.tasks
  add constraint tasks_source_type_check
  check (
    source_type is null
    or source_type = any (
      array[
        'hospitality_request',
        'housekeeping_task',
        'maintenance_task',
        'cattle_area',
        'issue',
        'orchard_general',
        'orchard_succession',
        'orchard_succession_sow',
        'orchard_succession_transplant',
        'orchard_succession_harvest',
        'operational_routine'
      ]::text[]
    )
  );

create table if not exists public.operational_task_routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  task_template_id text not null,
  operational_area text not null,
  task_category text,
  title text not null,
  description text,
  priority text not null default 'media'
    check (priority in ('baja','media','alta','urgente')),
  estimated_minutes integer
    check (estimated_minutes is null or (estimated_minutes between 5 and 1440)),
  employee_id uuid not null references public.employees(id),
  location_id uuid references public.locations(id),
  weekdays smallint[] not null default '{}'::smallint[],
  local_time time without time zone not null,
  timezone text not null default 'America/Santiago',
  is_active boolean not null default true,
  source_basis text not null default 'operator_confirmed'
    check (source_basis in ('operator_confirmed')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_task_routines_name_nonempty check (length(btrim(name)) between 1 and 160),
  constraint operational_task_routines_title_nonempty check (length(btrim(title)) between 1 and 160),
  constraint operational_task_routines_area_nonempty check (length(btrim(operational_area)) between 1 and 80),
  constraint operational_task_routines_weekdays_valid check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  )
);

create index if not exists idx_operational_task_routines_active_area
  on public.operational_task_routines(is_active, operational_area);

create index if not exists idx_operational_task_routines_employee
  on public.operational_task_routines(employee_id);

alter table public.operational_task_routines enable row level security;

drop policy if exists operational_task_routines_select_internal on public.operational_task_routines;
create policy operational_task_routines_select_internal
on public.operational_task_routines
for select
to authenticated
using (
  public.current_app_role() in ('admin','approver')
  and public.can_access_operational_task_scope(operational_area, location_id)
);

drop policy if exists operational_task_routines_insert_internal on public.operational_task_routines;
create policy operational_task_routines_insert_internal
on public.operational_task_routines
for insert
to authenticated
with check (
  public.current_app_role() in ('admin','approver')
  and created_by = auth.uid()
  and public.can_access_operational_task_scope(operational_area, location_id)
);

drop policy if exists operational_task_routines_update_internal on public.operational_task_routines;
create policy operational_task_routines_update_internal
on public.operational_task_routines
for update
to authenticated
using (
  public.current_app_role() in ('admin','approver')
  and public.can_access_operational_task_scope(operational_area, location_id)
)
with check (
  public.current_app_role() in ('admin','approver')
  and public.can_access_operational_task_scope(operational_area, location_id)
);

drop policy if exists operational_task_routines_delete_admin on public.operational_task_routines;
create policy operational_task_routines_delete_admin
on public.operational_task_routines
for delete
to authenticated
using (public.current_app_role() = 'admin');

create or replace function public.touch_operational_task_routine()
returns trigger
language plpgsql
set search_path='public','pg_temp'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_operational_task_routines_updated_at on public.operational_task_routines;
create trigger trg_operational_task_routines_updated_at
before update on public.operational_task_routines
for each row execute function public.touch_operational_task_routine();

create or replace function public.create_operational_task_routine(
  p_name text,
  p_task_template_id text,
  p_operational_area text,
  p_task_category text,
  p_title text,
  p_description text,
  p_priority text,
  p_estimated_minutes integer,
  p_employee_id uuid,
  p_location_id uuid,
  p_weekdays smallint[],
  p_local_time time without time zone
)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text := public.current_app_role();
  v_routine_id uuid;
begin
  if v_user_id is null then
    raise exception 'Autenticación requerida';
  end if;
  if v_role not in ('admin','approver') then
    raise exception 'Rol no autorizado para crear rutinas';
  end if;
  if not public.can_access_operational_task_scope(p_operational_area,p_location_id) then
    raise exception 'Sin acceso al alcance operativo de la rutina';
  end if;
  if nullif(btrim(p_name),'') is null or nullif(btrim(p_title),'') is null then
    raise exception 'Nombre y tarea son obligatorios';
  end if;
  if nullif(btrim(p_task_template_id),'') is null then
    raise exception 'La plantilla es obligatoria';
  end if;
  if p_priority not in ('baja','media','alta','urgente') then
    raise exception 'Prioridad inválida';
  end if;
  if p_estimated_minutes is not null and (p_estimated_minutes < 5 or p_estimated_minutes > 1440) then
    raise exception 'Duración estimada inválida';
  end if;
  if p_weekdays is null
     or cardinality(p_weekdays) < 1
     or cardinality(p_weekdays) > 7
     or not (p_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Selecciona al menos un día válido';
  end if;
  if p_local_time is null then
    raise exception 'La hora es obligatoria';
  end if;
  if not exists (
    select 1
    from public.employees e
    left join public.employee_task_profiles p on p.employee_id=e.id
    where e.id=p_employee_id
      and coalesce(e.is_active,true)=true
      and coalesce(p.can_receive_tasks,true)=true
  ) then
    raise exception 'La persona seleccionada no puede recibir tareas';
  end if;

  if exists (
    select 1
    from public.operational_task_routines r
    where r.is_active
      and r.employee_id=p_employee_id
      and r.task_template_id=btrim(p_task_template_id)
      and r.location_id is not distinct from p_location_id
      and r.weekdays=p_weekdays
      and r.local_time=p_local_time
  ) then
    raise exception 'Ya existe una rutina activa equivalente para esta persona';
  end if;

  insert into public.operational_task_routines(
    name,task_template_id,operational_area,task_category,title,description,
    priority,estimated_minutes,employee_id,location_id,weekdays,local_time,
    timezone,is_active,source_basis,created_by
  ) values (
    btrim(p_name),btrim(p_task_template_id),btrim(p_operational_area),
    nullif(btrim(p_task_category),''),
    btrim(p_title),nullif(btrim(p_description),''),
    p_priority,p_estimated_minutes,p_employee_id,p_location_id,p_weekdays,p_local_time,
    'America/Santiago',true,'operator_confirmed',v_user_id
  )
  returning id into v_routine_id;

  return v_routine_id;
end;
$function$;

create or replace function public.set_operational_task_routine_active(
  p_routine_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_routine public.operational_task_routines%rowtype;
begin
  if v_user_id is null then
    raise exception 'Autenticación requerida';
  end if;
  if public.current_app_role() not in ('admin','approver') then
    raise exception 'Rol no autorizado para modificar rutinas';
  end if;

  select * into v_routine
  from public.operational_task_routines
  where id=p_routine_id
  for update;

  if not found then
    raise exception 'Rutina no encontrada';
  end if;
  if not public.can_access_operational_task_scope(v_routine.operational_area,v_routine.location_id) then
    raise exception 'Sin acceso al alcance operativo de la rutina';
  end if;

  update public.operational_task_routines
  set is_active=coalesce(p_is_active,false), updated_at=now()
  where id=p_routine_id;

  return true;
end;
$function$;

create or replace function public.materialize_operational_task_routines(
  p_local_date date default ((now() at time zone 'America/Santiago')::date)
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text := public.current_app_role();
  v_routine public.operational_task_routines%rowtype;
  v_task_id uuid;
  v_created integer := 0;
  v_existing integer := 0;
  v_task_ids uuid[] := '{}'::uuid[];
  v_isodow smallint := extract(isodow from p_local_date)::smallint;
  v_location_name text;
begin
  if v_user_id is null then
    raise exception 'Autenticación requerida';
  end if;
  if v_role not in ('admin','approver') then
    raise exception 'Rol no autorizado para generar tareas rutinarias';
  end if;

  for v_routine in
    select *
    from public.operational_task_routines r
    where r.is_active
      and v_isodow = any(r.weekdays)
    order by r.local_time,r.name
  loop
    if not public.can_access_operational_task_scope(v_routine.operational_area,v_routine.location_id) then
      continue;
    end if;

    if exists (
      select 1
      from public.tasks t
      where t.source_type='operational_routine'
        and t.source_id=v_routine.id
        and t.due_date=p_local_date
    ) then
      v_existing := v_existing + 1;
      continue;
    end if;

    if not exists (
      select 1 from public.employees e
      left join public.employee_task_profiles p on p.employee_id=e.id
      where e.id=v_routine.employee_id
        and coalesce(e.is_active,true)=true
        and coalesce(p.can_receive_tasks,true)=true
    ) then
      continue;
    end if;

    select l.name into v_location_name
    from public.locations l
    where l.id=v_routine.location_id;

    insert into public.tasks(
      title,description,priority,status,due_date,location_id,location_name,
      operational_area,task_category,estimated_minutes,source_type,source_id,
      source_label
    ) values (
      v_routine.title,v_routine.description,v_routine.priority,'nueva',p_local_date,
      v_routine.location_id,v_location_name,v_routine.operational_area,
      v_routine.task_category,v_routine.estimated_minutes,'operational_routine',
      v_routine.id,'Rutina · ' || v_routine.name
    )
    returning id into v_task_id;

    insert into public.task_assignments(task_id,employee_id)
    values(v_task_id,v_routine.employee_id)
    on conflict do nothing;

    v_created := v_created + 1;
    v_task_ids := array_append(v_task_ids,v_task_id);
  end loop;

  return jsonb_build_object(
    'local_date',p_local_date,
    'created_count',v_created,
    'existing_count',v_existing,
    'task_ids',to_jsonb(v_task_ids)
  );
end;
$function$;

revoke all on function public.create_operational_task_routine(text,text,text,text,text,text,text,integer,uuid,uuid,smallint[],time without time zone) from public,anon;
grant execute on function public.create_operational_task_routine(text,text,text,text,text,text,text,integer,uuid,uuid,smallint[],time without time zone) to authenticated;

revoke all on function public.set_operational_task_routine_active(uuid,boolean) from public,anon;
grant execute on function public.set_operational_task_routine_active(uuid,boolean) to authenticated;

revoke all on function public.materialize_operational_task_routines(date) from public,anon;
grant execute on function public.materialize_operational_task_routines(date) to authenticated;

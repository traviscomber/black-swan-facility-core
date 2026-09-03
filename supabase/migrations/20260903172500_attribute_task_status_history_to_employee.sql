create or replace function public.update_operational_task_atomic(
  p_task_id uuid,
  p_title text,
  p_description text default null::text,
  p_priority text default 'media'::text,
  p_status text default 'nueva'::text,
  p_due_date date default null::date,
  p_location_id uuid default null::uuid,
  p_location_name text default null::text,
  p_latitude double precision default null::double precision,
  p_longitude double precision default null::double precision,
  p_operational_area text default null::text,
  p_task_category text default null::text,
  p_estimated_minutes integer default null::integer,
  p_animal_handling boolean default false,
  p_safety_notes text default null::text,
  p_employee_ids uuid[] default '{}'::uuid[],
  p_volunteer_ids uuid[] default '{}'::uuid[],
  p_source_type text default null::text,
  p_source_id uuid default null::uuid,
  p_source_label text default null::text,
  p_source_path text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_old_status text;
  v_old_operational_area text;
  v_old_location_id uuid;
  v_changed_by uuid;
begin
  if auth.uid() is null then raise exception 'Autenticación requerida'; end if;
  if v_role not in ('admin','approver') then raise exception 'Rol no autorizado para actualizar tareas'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'El título es obligatorio'; end if;
  if coalesce(array_length(p_employee_ids,1),0)+coalesce(array_length(p_volunteer_ids,1),0)=0 then raise exception 'Selecciona al menos una persona responsable'; end if;
  if p_priority not in ('baja','media','alta','urgente') then raise exception 'Prioridad inválida'; end if;
  if p_status not in ('nueva','en_progreso','completada','cancelada') then raise exception 'Estado inválido'; end if;

  select employee_id into v_changed_by
  from public.user_access_profiles
  where user_id=auth.uid() and is_active
  limit 1;

  select status,operational_area,location_id
    into v_old_status,v_old_operational_area,v_old_location_id
  from public.tasks
  where id=p_task_id
  for update;
  if not found then raise exception 'Tarea no encontrada'; end if;

  if not public.can_access_operational_task_scope(v_old_operational_area,v_old_location_id) then
    raise exception 'Sin acceso al alcance operativo actual de la tarea';
  end if;
  if not public.can_access_operational_task_scope(p_operational_area,p_location_id) then
    raise exception 'Sin acceso al alcance operativo de destino de la tarea';
  end if;

  update public.tasks
  set title=btrim(p_title),
      description=nullif(btrim(p_description),''),
      priority=p_priority,
      status=p_status,
      due_date=p_due_date,
      location_id=p_location_id,
      location_name=nullif(btrim(p_location_name),''),
      latitude=p_latitude,
      longitude=p_longitude,
      operational_area=nullif(btrim(p_operational_area),''),
      task_category=nullif(btrim(p_task_category),''),
      estimated_minutes=p_estimated_minutes,
      animal_handling=coalesce(p_animal_handling,false),
      safety_notes=nullif(btrim(p_safety_notes),''),
      source_type=p_source_type,
      source_id=p_source_id,
      source_label=nullif(btrim(p_source_label),''),
      source_path=nullif(btrim(p_source_path),''),
      completed_at=case when p_status='completada' then coalesce(completed_at,now()) else null end,
      updated_at=now()
  where id=p_task_id;

  delete from public.task_assignments where task_id=p_task_id;
  insert into public.task_assignments(task_id,employee_id)
  select p_task_id,id from unnest(coalesce(p_employee_ids,'{}')) id;
  insert into public.task_assignments(task_id,volunteer_id)
  select p_task_id,id from unnest(coalesce(p_volunteer_ids,'{}')) id;

  if v_old_status is distinct from p_status then
    insert into public.task_status_history(task_id,old_status,new_status,changed_by)
    values(p_task_id,v_old_status,p_status,v_changed_by);
  end if;
end;
$function$;

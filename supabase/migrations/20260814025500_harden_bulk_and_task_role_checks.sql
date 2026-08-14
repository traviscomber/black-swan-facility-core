-- Black Swan OS Phase 1: harden bulk reservation and operational task role checks
--
-- Replace legacy JWT app_metadata role reads with public.current_app_role().
-- Preserve existing authorization behavior and task semantics. This migration
-- is committed for review and is not applied automatically to production.

create or replace function public.execute_bulk_update(
  p_updates jsonb,
  p_operation_type text default 'move'::text,
  p_operation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_count integer := 0;
  v_res_ids uuid[];
  v_prev_state jsonb;
  upd jsonb;
  v_role text := public.current_app_role();
begin
  if auth.uid() is null or v_role <> 'admin' then
    raise exception 'Administrator role required';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    raise exception 'At least one update is required';
  end if;

  select array(select (u->>'id')::uuid from jsonb_array_elements(p_updates) u)
  into v_res_ids;

  select jsonb_build_object(
    'reservations',
    jsonb_object_agg(
      id::text,
      jsonb_build_object('check_in', check_in, 'check_out', check_out, 'status', status)
    )
  )
  into v_prev_state
  from public.reservations
  where id = any(v_res_ids);

  for upd in select * from jsonb_array_elements(p_updates)
  loop
    update public.reservations
    set
      check_in = coalesce((upd->>'check_in')::date, check_in),
      check_out = coalesce((upd->>'check_out')::date, check_out),
      status = coalesce(upd->>'status', status)
    where id = (upd->>'id')::uuid;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  insert into public.bulk_operations (
    id,
    operation_type,
    reservation_ids,
    previous_state,
    applied_state,
    status
  ) values (
    p_operation_id,
    p_operation_type,
    v_res_ids,
    v_prev_state,
    jsonb_build_object('updates', p_updates),
    'completed'
  )
  on conflict (id) do nothing;

  return jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'updated_count', v_count
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

create or replace function public.restore_bulk_operation_state(
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_op public.bulk_operations%rowtype;
  v_res jsonb;
  v_key text;
  v_count integer := 0;
  v_role text := public.current_app_role();
begin
  if auth.uid() is null or v_role <> 'admin' then
    raise exception 'Administrator role required';
  end if;

  select * into v_op
  from public.bulk_operations
  where id = p_operation_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Operación no encontrada');
  end if;

  if v_op.previous_state is null then
    return jsonb_build_object('success', false, 'error', 'Sin estado anterior para restaurar');
  end if;

  if v_op.status = 'undone' then
    return jsonb_build_object('success', false, 'error', 'La operación ya fue deshecha');
  end if;

  for v_key in select jsonb_object_keys(v_op.previous_state->'reservations')
  loop
    v_res := v_op.previous_state->'reservations'->v_key;

    update public.reservations
    set
      check_in = (v_res->>'check_in')::date,
      check_out = (v_res->>'check_out')::date,
      status = v_res->>'status'
    where id = v_key::uuid;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  update public.bulk_operations
  set status = 'undone'
  where id = p_operation_id;

  return jsonb_build_object('success', true, 'restored_count', v_count);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

create or replace function public.create_operational_task_atomic(
  p_title text,
  p_description text default null,
  p_priority text default 'media',
  p_due_date date default null,
  p_location_id uuid default null,
  p_location_name text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_operational_area text default null,
  p_task_category text default null,
  p_estimated_minutes integer default null,
  p_animal_handling boolean default false,
  p_safety_notes text default null,
  p_employee_ids uuid[] default '{}',
  p_volunteer_ids uuid[] default '{}',
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_label text default null,
  p_source_path text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_task_id uuid;
  v_existing uuid;
begin
  if auth.uid() is null then raise exception 'Autenticación requerida'; end if;
  if v_role not in ('admin','approver') then raise exception 'Rol no autorizado para crear tareas'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'El título es obligatorio'; end if;
  if coalesce(array_length(p_employee_ids,1),0)+coalesce(array_length(p_volunteer_ids,1),0)=0 then raise exception 'Selecciona al menos una persona responsable'; end if;
  if p_priority not in ('baja','media','alta','urgente') then raise exception 'Prioridad inválida'; end if;
  if p_source_type is not null and p_source_id is null then raise exception 'La fuente requiere identificador'; end if;

  if p_source_type is not null then
    select id into v_existing from public.tasks
    where source_type=p_source_type and source_id=p_source_id and status in ('nueva','en_progreso') limit 1;
    if v_existing is not null then raise exception 'Ya existe una tarea abierta para este registro'; end if;
  end if;

  insert into public.tasks (
    title,description,priority,status,due_date,location_id,location_name,latitude,longitude,
    operational_area,task_category,estimated_minutes,animal_handling,safety_notes,
    source_type,source_id,source_label,source_path
  ) values (
    btrim(p_title),nullif(btrim(p_description),''),p_priority,'nueva',p_due_date,p_location_id,
    nullif(btrim(p_location_name),''),p_latitude,p_longitude,nullif(btrim(p_operational_area),''),
    nullif(btrim(p_task_category),''),p_estimated_minutes,coalesce(p_animal_handling,false),
    nullif(btrim(p_safety_notes),''),p_source_type,p_source_id,nullif(btrim(p_source_label),''),nullif(btrim(p_source_path),'')
  ) returning id into v_task_id;

  insert into public.task_assignments(task_id,employee_id)
  select v_task_id,id from unnest(coalesce(p_employee_ids,'{}')) id;
  insert into public.task_assignments(task_id,volunteer_id)
  select v_task_id,id from unnest(coalesce(p_volunteer_ids,'{}')) id;

  if p_source_type='issue' then
    insert into public.issue_task_assignments(issue_id,task_id) values (p_source_id,v_task_id)
    on conflict do nothing;
  end if;

  return v_task_id;
end;
$function$;

create or replace function public.update_operational_task_atomic(
  p_task_id uuid,
  p_title text,
  p_description text default null,
  p_priority text default 'media',
  p_status text default 'nueva',
  p_due_date date default null,
  p_location_id uuid default null,
  p_location_name text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_operational_area text default null,
  p_task_category text default null,
  p_estimated_minutes integer default null,
  p_animal_handling boolean default false,
  p_safety_notes text default null,
  p_employee_ids uuid[] default '{}',
  p_volunteer_ids uuid[] default '{}',
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_label text default null,
  p_source_path text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_old_status text;
begin
  if auth.uid() is null then raise exception 'Autenticación requerida'; end if;
  if v_role not in ('admin','approver') then raise exception 'Rol no autorizado para actualizar tareas'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'El título es obligatorio'; end if;
  if coalesce(array_length(p_employee_ids,1),0)+coalesce(array_length(p_volunteer_ids,1),0)=0 then raise exception 'Selecciona al menos una persona responsable'; end if;
  if p_priority not in ('baja','media','alta','urgente') then raise exception 'Prioridad inválida'; end if;
  if p_status not in ('nueva','en_progreso','completada','cancelada') then raise exception 'Estado inválido'; end if;

  select status into v_old_status from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Tarea no encontrada'; end if;

  update public.tasks set title=btrim(p_title),description=nullif(btrim(p_description),''),priority=p_priority,status=p_status,
    due_date=p_due_date,location_id=p_location_id,location_name=nullif(btrim(p_location_name),''),latitude=p_latitude,longitude=p_longitude,
    operational_area=nullif(btrim(p_operational_area),''),task_category=nullif(btrim(p_task_category),''),estimated_minutes=p_estimated_minutes,
    animal_handling=coalesce(p_animal_handling,false),safety_notes=nullif(btrim(p_safety_notes),''),
    source_type=p_source_type,source_id=p_source_id,source_label=nullif(btrim(p_source_label),''),source_path=nullif(btrim(p_source_path),''),
    completed_at=case when p_status='completada' then coalesce(completed_at,now()) else null end,updated_at=now()
  where id=p_task_id;

  delete from public.task_assignments where task_id=p_task_id;
  insert into public.task_assignments(task_id,employee_id) select p_task_id,id from unnest(coalesce(p_employee_ids,'{}')) id;
  insert into public.task_assignments(task_id,volunteer_id) select p_task_id,id from unnest(coalesce(p_volunteer_ids,'{}')) id;

  if v_old_status is distinct from p_status then
    insert into public.task_status_history(task_id,old_status,new_status) values(p_task_id,v_old_status,p_status);
  end if;
end;
$function$;

create or replace function public.add_task_comment(
  p_task_id uuid,
  p_comment text
)
returns public.task_comments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_row public.task_comments;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if v_role not in ('admin','approver') then raise exception 'Permisos insuficientes'; end if;
  if length(trim(coalesce(p_comment,''))) < 2 then raise exception 'El comentario es obligatorio'; end if;
  if not exists (select 1 from public.tasks where id = p_task_id) then raise exception 'Tarea no encontrada'; end if;
  insert into public.task_comments(task_id, comment, created_by, author_email)
  values (p_task_id, trim(p_comment), auth.uid(), coalesce(auth.jwt() ->> 'email','Equipo interno'))
  returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.register_task_evidence(
  p_task_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_caption text default null
)
returns public.task_evidence
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_row public.task_evidence;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if v_role not in ('admin','approver') then raise exception 'Permisos insuficientes'; end if;
  if not exists (select 1 from public.tasks where id = p_task_id) then raise exception 'Tarea no encontrada'; end if;
  if p_storage_path not like p_task_id::text || '/%' then raise exception 'Ruta de evidencia inválida'; end if;
  insert into public.task_evidence(task_id, storage_path, file_name, mime_type, file_size, caption, uploaded_by, uploader_email)
  values (p_task_id, p_storage_path, p_file_name, p_mime_type, p_file_size, nullif(trim(coalesce(p_caption,'')),''), auth.uid(), coalesce(auth.jwt() ->> 'email','Equipo interno'))
  returning * into v_row;
  return v_row;
end;
$function$;
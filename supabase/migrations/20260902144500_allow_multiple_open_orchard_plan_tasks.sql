drop index if exists public.tasks_one_open_per_source_idx;

create unique index tasks_one_open_per_source_idx
on public.tasks(source_type, source_id)
where source_type is not null
  and source_id is not null
  and source_type <> 'orchard_succession'
  and status in ('nueva','en_progreso');

create unique index tasks_one_open_orchard_reference_idx
on public.tasks(source_type, source_id, due_date, source_path)
where source_type = 'orchard_succession'
  and source_id is not null
  and due_date is not null
  and source_path is not null
  and status in ('nueva','en_progreso');

create or replace function public.create_operational_task_atomic(
  p_title text,
  p_description text default null::text,
  p_priority text default 'media'::text,
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
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_task_id uuid;
  v_existing uuid;
  v_source_path text := nullif(btrim(p_source_path),'');
begin
  if auth.uid() is null then raise exception 'Autenticación requerida'; end if;
  if v_role not in ('admin','approver') then raise exception 'Rol no autorizado para crear tareas'; end if;
  if not public.can_access_operational_task_scope(p_operational_area,p_location_id) then raise exception 'Sin acceso al alcance operativo de la tarea'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'El título es obligatorio'; end if;
  if coalesce(array_length(p_employee_ids,1),0)+coalesce(array_length(p_volunteer_ids,1),0)=0 then raise exception 'Selecciona al menos una persona responsable'; end if;
  if p_priority not in ('baja','media','alta','urgente') then raise exception 'Prioridad inválida'; end if;
  if p_source_type is not null and p_source_id is null then raise exception 'La fuente requiere identificador'; end if;

  if p_source_type is not null then
    if p_source_type = 'orchard_succession' then
      select id into v_existing
      from public.tasks
      where source_type=p_source_type
        and source_id=p_source_id
        and due_date is not distinct from p_due_date
        and source_path is not distinct from v_source_path
        and status in ('nueva','en_progreso')
      limit 1;
    else
      select id into v_existing
      from public.tasks
      where source_type=p_source_type
        and source_id=p_source_id
        and status in ('nueva','en_progreso')
      limit 1;
    end if;
    if v_existing is not null then raise exception 'Ya existe una tarea abierta para este registro'; end if;
  end if;

  insert into public.tasks(title,description,priority,status,due_date,location_id,location_name,latitude,longitude,operational_area,task_category,estimated_minutes,animal_handling,safety_notes,source_type,source_id,source_label,source_path)
  values(btrim(p_title),nullif(btrim(p_description),''),p_priority,'nueva',p_due_date,p_location_id,nullif(btrim(p_location_name),''),p_latitude,p_longitude,nullif(btrim(p_operational_area),''),nullif(btrim(p_task_category),''),p_estimated_minutes,coalesce(p_animal_handling,false),nullif(btrim(p_safety_notes),''),p_source_type,p_source_id,nullif(btrim(p_source_label),''),v_source_path)
  returning id into v_task_id;

  insert into public.task_assignments(task_id,employee_id)
  select v_task_id,id from unnest(coalesce(p_employee_ids,'{}')) id;
  insert into public.task_assignments(task_id,volunteer_id)
  select v_task_id,id from unnest(coalesce(p_volunteer_ids,'{}')) id;

  if p_source_type='issue' then
    insert into public.issue_task_assignments(issue_id,task_id) values(p_source_id,v_task_id) on conflict do nothing;
  end if;
  return v_task_id;
end;
$function$;

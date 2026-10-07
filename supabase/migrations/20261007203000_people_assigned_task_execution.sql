-- Allow assigned Black Swan workers to execute their own operational tasks safely.
-- This is intentionally narrower than update_operational_task_atomic: assignees may only
-- transition an assigned canonical task from nueva -> en_progreso -> completada.

create or replace function public.update_assigned_operational_task_status(
  p_task_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_employee_id uuid;
  v_old_status text;
  v_task_category text;
  v_source_label text;
begin
  if v_user_id is null then
    raise exception 'Autenticación requerida';
  end if;

  if p_status not in ('en_progreso','completada') then
    raise exception 'Transición no autorizada para ejecución de tarea';
  end if;

  select employee_id
    into v_employee_id
  from public.user_access_profiles
  where user_id = v_user_id
    and is_active
    and employee_id is not null
  limit 1;

  if v_employee_id is null then
    raise exception 'Usuario sin perfil de trabajador activo';
  end if;

  select t.status, t.task_category, t.source_label
    into v_old_status, v_task_category, v_source_label
  from public.tasks t
  where t.id = p_task_id
  for update;

  if not found then
    raise exception 'Tarea no encontrada';
  end if;

  if coalesce(v_task_category,'') like 'asana_import%'
     or coalesce(v_source_label,'') like 'Asana ·%' then
    raise exception 'Las tareas históricas de Asana son sólo lectura';
  end if;

  if not exists (
    select 1
    from public.task_assignments a
    where a.task_id = p_task_id
      and a.employee_id = v_employee_id
  ) then
    raise exception 'La tarea no está asignada al trabajador autenticado';
  end if;

  if not public.can_access_operational_task(p_task_id) then
    raise exception 'Sin acceso al alcance operativo de la tarea';
  end if;

  if p_status = v_old_status then
    return;
  end if;

  if not (
    (v_old_status = 'nueva' and p_status = 'en_progreso')
    or (v_old_status = 'en_progreso' and p_status = 'completada')
  ) then
    raise exception 'Transición de estado inválida';
  end if;

  update public.tasks
  set status = p_status,
      completed_at = case when p_status = 'completada' then now() else null end,
      updated_at = now()
  where id = p_task_id;

  insert into public.task_status_history(task_id,old_status,new_status,changed_by)
  values(p_task_id,v_old_status,p_status,v_employee_id);
end;
$function$;

revoke all on function public.update_assigned_operational_task_status(uuid,text)
  from public,anon;
grant execute on function public.update_assigned_operational_task_status(uuid,text)
  to authenticated;

-- Evidence paths already use <task_uuid>/<file>. Scope storage access to the
-- canonical task instead of coupling evidence to housekeeping permissions.
create or replace function public.can_access_task_evidence_storage(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path='public','storage','pg_temp'
as $function$
declare
  v_task_id uuid;
  v_folder text;
begin
  v_folder := (storage.foldername(p_name))[1];
  if v_folder is null or v_folder = '' then
    return false;
  end if;

  begin
    v_task_id := v_folder::uuid;
  exception when others then
    return false;
  end;

  return public.can_access_operational_task(v_task_id);
end;
$function$;

revoke all on function public.can_access_task_evidence_storage(text)
  from public,anon;
grant execute on function public.can_access_task_evidence_storage(text)
  to authenticated;

drop policy if exists task_evidence_storage_insert on storage.objects;
drop policy if exists task_evidence_storage_select on storage.objects;
drop policy if exists task_evidence_storage_update on storage.objects;

create policy task_evidence_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-evidence'
  and public.can_access_task_evidence_storage(name)
);

create policy task_evidence_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-evidence'
  and public.can_access_task_evidence_storage(name)
);

create policy task_evidence_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-evidence'
  and public.can_access_task_evidence_storage(name)
)
with check (
  bucket_id = 'task-evidence'
  and public.can_access_task_evidence_storage(name)
);

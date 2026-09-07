create or replace function public.link_asana_task_external_ref(
  p_task_id uuid,
  p_external_task_id text,
  p_external_url text,
  p_observed_status text default null,
  p_observed_assignee text default null,
  p_observed_due_date date default null,
  p_observed_at timestamptz default now()
)
returns public.task_external_refs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_task public.tasks%rowtype;
  v_ref public.task_external_refs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida';
  end if;
  if v_role not in ('admin','approver') then
    raise exception 'Rol no autorizado para conciliar referencias Asana';
  end if;
  if nullif(btrim(p_external_task_id),'') is null or btrim(p_external_task_id) !~ '^[0-9]+$' then
    raise exception 'GID de tarea Asana inválido';
  end if;
  if nullif(btrim(p_external_url),'') is null or btrim(p_external_url) not like 'https://app.asana.com/%' then
    raise exception 'URL Asana inválida';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'Tarea no encontrada';
  end if;
  if not (coalesce(v_task.task_category,'') like 'asana_import%' or coalesce(v_task.source_label,'') like 'Asana ·%') then
    raise exception 'La tarea no corresponde a un snapshot importado desde Asana';
  end if;
  if not public.can_access_operational_task_scope(v_task.operational_area, v_task.location_id) then
    raise exception 'Sin acceso al alcance operacional de la tarea';
  end if;

  insert into public.task_external_refs (
    task_id, provider, external_task_id, external_project_id, external_project_name,
    external_url, reconciliation_state, last_observed_status,
    last_observed_assignee, last_observed_due_date, last_observed_at, updated_at
  ) values (
    v_task.id, 'asana', btrim(p_external_task_id),
    substring(v_task.source_path from '/project/([0-9]+)'),
    nullif(trim(replace(coalesce(v_task.source_label,''), 'Asana ·', '')),''),
    btrim(p_external_url), 'linked', nullif(btrim(p_observed_status),''),
    nullif(btrim(p_observed_assignee),''), p_observed_due_date,
    coalesce(p_observed_at, now()), now()
  )
  on conflict (task_id, provider) do update
    set external_task_id = excluded.external_task_id,
        external_project_id = coalesce(public.task_external_refs.external_project_id, excluded.external_project_id),
        external_project_name = coalesce(public.task_external_refs.external_project_name, excluded.external_project_name),
        external_url = excluded.external_url,
        reconciliation_state = 'linked',
        last_observed_status = excluded.last_observed_status,
        last_observed_assignee = excluded.last_observed_assignee,
        last_observed_due_date = excluded.last_observed_due_date,
        last_observed_at = excluded.last_observed_at,
        updated_at = now()
  returning * into v_ref;

  return v_ref;
end;
$function$;

revoke all on function public.link_asana_task_external_ref(uuid,text,text,text,text,date,timestamptz) from public;
grant execute on function public.link_asana_task_external_ref(uuid,text,text,text,text,date,timestamptz) to authenticated;

create or replace view public.asana_task_reconciliation
with (security_invoker = true)
as
select
  t.id as task_id,
  t.title,
  t.status as bsfc_status,
  t.due_date as bsfc_due_date,
  t.source_label,
  t.source_path,
  r.external_task_id,
  r.external_project_id,
  r.external_project_name,
  r.external_url,
  r.reconciliation_state,
  r.last_observed_status,
  r.last_observed_assignee,
  r.last_observed_due_date,
  r.last_observed_at
from public.tasks t
join public.task_external_refs r on r.task_id = t.id and r.provider = 'asana';

grant select on public.asana_task_reconciliation to authenticated;

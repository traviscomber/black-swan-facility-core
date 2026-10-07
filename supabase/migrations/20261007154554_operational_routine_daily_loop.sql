-- Daily materialization loop for operator-confirmed People OS routines.
-- Runs before the existing 07:30 task digest and remains a no-op when no routines exist.

create unique index if not exists tasks_operational_routine_daily_unique
  on public.tasks(source_id, due_date)
  where source_type = 'operational_routine'
    and source_id is not null
    and due_date is not null;

create or replace function public.materialize_operational_task_routines_internal(
  p_local_date date,
  p_enforce_user_scope boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_routine public.operational_task_routines%rowtype;
  v_task_id uuid;
  v_created integer := 0;
  v_existing integer := 0;
  v_skipped integer := 0;
  v_task_ids uuid[] := '{}'::uuid[];
  v_isodow smallint := extract(isodow from p_local_date)::smallint;
  v_location_name text;
begin
  if p_local_date is null then
    raise exception 'La fecha local es obligatoria';
  end if;

  for v_routine in
    select *
    from public.operational_task_routines r
    where r.is_active
      and v_isodow = any(r.weekdays)
    order by r.local_time,r.name
  loop
    if p_enforce_user_scope
       and not public.can_access_operational_task_scope(v_routine.operational_area,v_routine.location_id) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if not exists (
      select 1
      from public.employees e
      left join public.employee_task_profiles p on p.employee_id=e.id
      where e.id=v_routine.employee_id
        and coalesce(e.is_active,true)=true
        and coalesce(p.can_receive_tasks,true)=true
    ) then
      v_skipped := v_skipped + 1;
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

    select l.name into v_location_name
    from public.locations l
    where l.id=v_routine.location_id;

    v_task_id := null;

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
    on conflict do nothing
    returning id into v_task_id;

    if v_task_id is null then
      v_existing := v_existing + 1;
      continue;
    end if;

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
    'skipped_count',v_skipped,
    'task_ids',to_jsonb(v_task_ids)
  );
end;
$function$;

revoke all on function public.materialize_operational_task_routines_internal(date,boolean)
  from public,anon,authenticated;
grant execute on function public.materialize_operational_task_routines_internal(date,boolean)
  to service_role;

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
begin
  if v_user_id is null then
    raise exception 'Autenticación requerida';
  end if;
  if v_role not in ('admin','approver') then
    raise exception 'Rol no autorizado para generar tareas rutinarias';
  end if;

  return public.materialize_operational_task_routines_internal(p_local_date,true);
end;
$function$;

revoke all on function public.materialize_operational_task_routines(date)
  from public,anon;
grant execute on function public.materialize_operational_task_routines(date)
  to authenticated;

create or replace function public.run_operational_task_routine_scheduler()
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_now_local timestamp := timezone('America/Santiago', now());
  v_local_date date := timezone('America/Santiago', now())::date;
  v_result jsonb;
begin
  -- The cron is fired at both possible UTC offsets. Only 06:00-06:29 Chile time executes.
  if extract(hour from v_now_local)::int <> 6
     or extract(minute from v_now_local)::int not in (0,15) then
    return jsonb_build_object(
      'status','outside_window',
      'local_time',to_char(v_now_local,'YYYY-MM-DD HH24:MI')
    );
  end if;

  v_result := public.materialize_operational_task_routines_internal(v_local_date,false);

  return jsonb_build_object(
    'status','materialized',
    'local_time',to_char(v_now_local,'YYYY-MM-DD HH24:MI'),
    'result',v_result
  );
end;
$function$;

revoke all on function public.run_operational_task_routine_scheduler()
  from public,anon,authenticated;
grant execute on function public.run_operational_task_routine_scheduler()
  to service_role;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname='black_swan_operational_routines_0600_watchdog';
end $$;

select cron.schedule(
  'black_swan_operational_routines_0600_watchdog',
  '0,15 9,10 * * *',
  'select public.run_operational_task_routine_scheduler();'
);

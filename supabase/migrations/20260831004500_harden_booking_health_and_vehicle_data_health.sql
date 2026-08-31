-- Make Booking Health a first-class scheduled control-plane job and make
-- vehicle identity coverage semantically precise. No source data is inferred.

create or replace function private.evaluate_booking_health(
  p_persist boolean default true,
  p_executed_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_results jsonb := '[]'::jsonb;
  v_count integer;
  v_critical integer := 0;
  v_warning integer := 0;
  v_passed integer := 0;
  v_status text;
  v_payload jsonb;
begin
  select count(*) into v_count from public.reservations where check_out <= check_in;
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','invalid_dates','label','Reservas con fechas inválidas','severity',case when v_count > 0 then 'critical' else 'pass' end,'count',v_count));
  if v_count > 0 then v_critical := v_critical + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count
  from public.reservations a
  join public.reservations b on a.id < b.id and a.bed_id is not null and a.bed_id = b.bed_id
    and a.status not in ('cancelled','canceled','no_show','checked_out','checked-out','void','voided')
    and b.status not in ('cancelled','canceled','no_show','checked_out','checked-out','void','voided')
    and daterange(a.check_in,a.check_out,'[)') && daterange(b.check_in,b.check_out,'[)');
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','bed_overlap','label','Solapamientos activos en una cama','severity',case when v_count > 0 then 'critical' else 'pass' end,'count',v_count));
  if v_count > 0 then v_critical := v_critical + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count
  from public.reservations r join public.rooms rm on rm.id = r.room_id
  where r.status in ('checked_in','checked-in') and coalesce(rm.operational_status,'') <> 'occupied';
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','checked_in_room_state','label','Estadías activas en habitación no ocupada','severity',case when v_count > 0 then 'critical' else 'pass' end,'count',v_count));
  if v_count > 0 then v_critical := v_critical + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count
  from public.rooms rm
  where rm.operational_status = 'occupied'
    and not exists (select 1 from public.reservations r where r.room_id = rm.id and r.status in ('checked_in','checked-in'));
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','orphan_occupied_room','label','Habitaciones ocupadas sin estadía activa','severity',case when v_count > 0 then 'critical' else 'pass' end,'count',v_count));
  if v_count > 0 then v_critical := v_critical + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count from public.housekeeping_tasks where status not in ('completed','cancelled') and due_at is not null and due_at < now();
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','housekeeping_overdue','label','Tareas de Housekeeping vencidas','severity',case when v_count > 0 then 'warning' else 'pass' end,'count',v_count));
  if v_count > 0 then v_warning := v_warning + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count from public.hospitality_requests where status not in ('completed','cancelled') and due_at is not null and due_at < now();
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','hospitality_overdue','label','Solicitudes de Hospitality vencidas','severity',case when v_count > 0 then 'warning' else 'pass' end,'count',v_count));
  if v_count > 0 then v_warning := v_warning + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count from public.incidents where status not in ('resolved','closed','cancelled') and due_at is not null and due_at < now();
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','maintenance_overdue','label','Incidencias de mantenimiento vencidas','severity',case when v_count > 0 then 'warning' else 'pass' end,'count',v_count));
  if v_count > 0 then v_warning := v_warning + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count
  from public.reservations r
  where r.status = 'confirmed' and r.check_in <= current_date + 1
    and not exists (
      select 1 from public.housekeeping_tasks h
      where h.reservation_id = r.id
        and h.task_type in ('pre_arrival','pre_arrival_preparation','pre_arrival_inspection','inspection')
        and h.status <> 'cancelled'
    );
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','missing_prearrival','label','Llegadas próximas sin preparación registrada','severity',case when v_count > 0 then 'warning' else 'pass' end,'count',v_count));
  if v_count > 0 then v_warning := v_warning + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count from public.messages where status = 'failed' and created_at >= now() - interval '7 days';
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','message_failures','label','Mensajes fallidos en los últimos 7 días','severity',case when v_count > 0 then 'warning' else 'pass' end,'count',v_count));
  if v_count > 0 then v_warning := v_warning + 1; else v_passed := v_passed + 1; end if;

  select count(*) into v_count from public.booking_shift_handovers where status = 'submitted' and created_at < now() - interval '8 hours';
  v_results := v_results || jsonb_build_array(jsonb_build_object('key','handover_pending','label','Entregas de turno sin aceptar por más de 8 horas','severity',case when v_count > 0 then 'warning' else 'pass' end,'count',v_count));
  if v_count > 0 then v_warning := v_warning + 1; else v_passed := v_passed + 1; end if;

  v_status := case when v_critical > 0 then 'critical' when v_warning > 0 then 'warning' else 'healthy' end;
  v_payload := jsonb_build_object(
    'status', v_status,
    'total_checks', 10,
    'passed_checks', v_passed,
    'warning_checks', v_warning,
    'critical_checks', v_critical,
    'results', v_results,
    'executed_at', now()
  );

  if p_persist then
    insert into public.booking_health_runs(status,total_checks,passed_checks,warning_checks,critical_checks,results,executed_by)
    values(v_status,10,v_passed,v_warning,v_critical,v_results,p_executed_by);
  end if;

  return v_payload;
end;
$$;

revoke all on function private.evaluate_booking_health(boolean, uuid) from public, anon, authenticated;

create or replace function public.run_booking_health_checks(p_persist boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_role text := public.current_app_role();
begin
  if coalesce(auth.role(),'') <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'Booking health access denied';
  end if;

  return private.evaluate_booking_health(p_persist, auth.uid());
end;
$$;

create or replace function private.execute_booking_health_snapshot(
  p_trigger_source text default 'manual',
  p_attempt integer default 1,
  p_parent_run_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_run_id uuid;
  v_payload jsonb;
  v_max_attempts integer;
begin
  if p_trigger_source not in ('cron', 'manual', 'system') then
    raise exception 'invalid trigger source: %', p_trigger_source using errcode = '22023';
  end if;

  if p_attempt < 1 then
    raise exception 'attempt must be positive' using errcode = '22023';
  end if;

  select max_attempts into v_max_attempts
  from private.integration_job_registry
  where job_key = 'booking-health-snapshot' and active;

  if not found then
    raise exception 'booking-health-snapshot is not registered or active' using errcode = '55000';
  end if;

  if p_attempt > v_max_attempts then
    raise exception 'attempt % exceeds configured maximum %', p_attempt, v_max_attempts using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtextextended('booking-health-snapshot', 0)) then
    insert into public.integration_job_runs(job_key,trigger_source,status,attempt,parent_run_id,finished_at,metrics)
    values('booking-health-snapshot',p_trigger_source,'skipped',p_attempt,p_parent_run_id,now(),jsonb_build_object('reason','overlap_lock_not_acquired'))
    returning id into v_run_id;
    return v_run_id;
  end if;

  insert into public.integration_job_runs(job_key,trigger_source,status,attempt,parent_run_id)
  values('booking-health-snapshot',p_trigger_source,'running',p_attempt,p_parent_run_id)
  returning id into v_run_id;

  begin
    v_payload := private.evaluate_booking_health(true, null);

    update public.integration_job_runs
    set status = 'succeeded',
        finished_at = now(),
        metrics = jsonb_build_object(
          'booking_status', v_payload->>'status',
          'total_checks', coalesce((v_payload->>'total_checks')::integer, 0),
          'passed_checks', coalesce((v_payload->>'passed_checks')::integer, 0),
          'warning_checks', coalesce((v_payload->>'warning_checks')::integer, 0),
          'critical_checks', coalesce((v_payload->>'critical_checks')::integer, 0)
        ),
        retry_after = null,
        dead_lettered_at = null
    where id = v_run_id;
  exception when others then
    update public.integration_job_runs
    set status = 'failed',
        finished_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm,
        retry_after = null,
        dead_lettered_at = now()
    where id = v_run_id;
  end;

  return v_run_id;
end;
$$;

create or replace function private.run_booking_health_snapshot()
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $$
begin
  return private.execute_booking_health_snapshot('cron', 1, null);
end;
$$;

revoke all on function private.execute_booking_health_snapshot(text, integer, uuid) from public, anon, authenticated;
revoke all on function private.run_booking_health_snapshot() from public, anon, authenticated;

insert into private.integration_job_registry(
  job_key, schedule, timezone, execution_platform, source_system,
  canonical_destination, max_runtime_seconds, max_attempts,
  retry_backoff_seconds, freshness_sla_seconds, active, updated_at
)
values(
  'booking-health-snapshot',
  '5,20,35,50 * * * *',
  'UTC',
  'supabase_pg_cron',
  'black_swan_canonical_postgres',
  'public.booking_health_runs',
  300,
  1,
  300,
  1200,
  true,
  now()
)
on conflict (job_key) do update set
  schedule = excluded.schedule,
  timezone = excluded.timezone,
  execution_platform = excluded.execution_platform,
  source_system = excluded.source_system,
  canonical_destination = excluded.canonical_destination,
  max_runtime_seconds = excluded.max_runtime_seconds,
  max_attempts = excluded.max_attempts,
  retry_backoff_seconds = excluded.retry_backoff_seconds,
  freshness_sla_seconds = excluded.freshness_sla_seconds,
  active = excluded.active,
  updated_at = now();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'booking-health-snapshot') then
    perform cron.unschedule('booking-health-snapshot');
  end if;

  perform cron.schedule(
    'booking-health-snapshot',
    '5,20,35,50 * * * *',
    'select private.run_booking_health_snapshot();'
  );
end;
$$;

create or replace function public.get_it_data_health_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_temp'
as $$
declare
  v_uid uuid;
  v_role text;
  v_has_it_scope boolean := false;
  v_booking jsonb;
  v_vehicles jsonb;
  v_orchard jsonb;
  v_tasks jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(coalesce(uap.role, 'none'))
    into v_role
  from public.user_access_profiles uap
  where uap.user_id = v_uid and uap.is_active = true;

  if v_role is null or v_role in ('none', 'disabled') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.user_operational_scopes s
    where s.user_id = v_uid
      and s.is_active = true
      and lower(coalesce(s.department, '')) = 'it'
  ) into v_has_it_scope;

  if v_role <> 'admin' and not v_has_it_scope then
    raise exception 'IT data health access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'run_count', count(*),
    'latest', (
      select jsonb_build_object(
        'status', bhr.status,
        'total_checks', bhr.total_checks,
        'passed_checks', bhr.passed_checks,
        'warning_checks', bhr.warning_checks,
        'critical_checks', bhr.critical_checks,
        'executed_at', bhr.executed_at
      )
      from public.booking_health_runs bhr
      order by bhr.executed_at desc
      limit 1
    )
  ) into v_booking
  from public.booking_health_runs;

  select jsonb_build_object(
    'total', count(*),
    'canonical_identity_present', count(*) filter (where nullif(btrim(v.code), '') is not null),
    'external_identifier_unrecorded', count(*) filter (
      where nullif(btrim(v.plate_number), '') is null
        and nullif(btrim(v.vin), '') is null
        and nullif(btrim(v.serial_number), '') is null
    ),
    'missing_classification', count(*) filter (where v.operational_class is null),
    'missing_cost_center', count(*) filter (where v.cost_center_id is null),
    'missing_responsible_team', count(*) filter (where v.team_id is null),
    'with_missing_fields', count(*) filter (where cardinality(v.missing_fields) > 0)
  ) into v_vehicles
  from public.vehicle_registry_health v;

  select jsonb_build_object(
    'canonical_profiles', count(*),
    'missing_dtm', count(*) filter (where cp.days_to_maturity is null),
    'missing_plant_spacing', count(*) filter (where cp.plant_spacing_cm is null),
    'missing_row_spacing', count(*) filter (where cp.row_spacing_cm is null),
    'missing_yield', count(*) filter (where cp.target_yield_per_m2 is null),
    'missing_yield_unit', count(*) filter (where cp.yield_unit is null)
  ) into v_orchard
  from public.orchard_crop_profiles cp
  where cp.classification_scheme = 'black_swan_canonical'
    and cp.classification_code = 'fundo_corcovado';

  select jsonb_build_object(
    'total', count(*),
    'sourced', count(*) filter (where t.source_type is not null),
    'sourced_missing_id', count(*) filter (where t.source_type is not null and t.source_id is null),
    'sourced_missing_path', count(*) filter (where t.source_type is not null and nullif(btrim(t.source_path), '') is null)
  ) into v_tasks
  from public.tasks t;

  return jsonb_build_object(
    'observed_at', now(),
    'booking', coalesce(v_booking, '{}'::jsonb),
    'vehicles', coalesce(v_vehicles, '{}'::jsonb),
    'orchard', coalesce(v_orchard, '{}'::jsonb),
    'tasks', coalesce(v_tasks, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_it_data_health_snapshot() from public;
revoke all on function public.get_it_data_health_snapshot() from anon;
grant execute on function public.get_it_data_health_snapshot() to authenticated;

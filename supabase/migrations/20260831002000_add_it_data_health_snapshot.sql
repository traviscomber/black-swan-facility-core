create or replace function public.get_it_data_health_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_has_it_scope boolean := false;
  v_booking jsonb := '{}'::jsonb;
  v_vehicles jsonb := '{}'::jsonb;
  v_orchard jsonb := '{}'::jsonb;
  v_tasks jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_role in ('none', 'disabled') then
    raise exception 'Active access profile required' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.user_operational_scopes s
    where s.user_id = v_user
      and s.is_active
      and lower(coalesce(s.department, '')) = 'it'
  ) into v_has_it_scope;

  if v_role <> 'admin' and not v_has_it_scope then
    raise exception 'IT data health access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'run_count', count(*),
    'latest', (
      select jsonb_build_object(
        'status', b.status,
        'total_checks', b.total_checks,
        'passed_checks', b.passed_checks,
        'warning_checks', b.warning_checks,
        'critical_checks', b.critical_checks,
        'executed_at', b.executed_at
      )
      from public.booking_health_runs b
      order by b.executed_at desc
      limit 1
    )
  ) into v_booking
  from public.booking_health_runs;

  select jsonb_build_object(
    'total', count(*),
    'with_missing_fields', count(*) filter (where coalesce(cardinality(v.missing_fields), 0) > 0),
    'missing_identity', count(*) filter (where 'identity' = any(coalesce(v.missing_fields, '{}'::text[]))),
    'missing_classification', count(*) filter (where 'classification' = any(coalesce(v.missing_fields, '{}'::text[]))),
    'missing_cost_center', count(*) filter (where 'cost_center' = any(coalesce(v.missing_fields, '{}'::text[]))),
    'missing_responsible_team', count(*) filter (where 'responsible_team' = any(coalesce(v.missing_fields, '{}'::text[])))
  ) into v_vehicles
  from public.vehicle_registry_health v;

  select jsonb_build_object(
    'canonical_profiles', count(*),
    'missing_dtm', count(*) filter (where c.days_to_maturity is null),
    'missing_plant_spacing', count(*) filter (where c.plant_spacing_cm is null),
    'missing_row_spacing', count(*) filter (where c.row_spacing_cm is null),
    'missing_yield', count(*) filter (where c.target_yield_per_sqm is null),
    'missing_yield_unit', count(*) filter (where c.yield_unit is null)
  ) into v_orchard
  from public.orchard_crop_library c
  where c.classification_scheme = 'black_swan_canonical'
    and c.classification_code = 'fundo_corcovado';

  select jsonb_build_object(
    'total', count(*),
    'sourced', count(*) filter (where t.source_type is not null),
    'sourced_missing_id', count(*) filter (where t.source_type is not null and t.source_id is null),
    'sourced_missing_path', count(*) filter (where t.source_type is not null and nullif(btrim(t.source_path), '') is null)
  ) into v_tasks
  from public.tasks t;

  return jsonb_build_object(
    'observed_at', now(),
    'booking', v_booking,
    'vehicles', v_vehicles,
    'orchard', v_orchard,
    'tasks', v_tasks
  );
end;
$$;

revoke all on function public.get_it_data_health_snapshot() from public;
revoke all on function public.get_it_data_health_snapshot() from anon;
grant execute on function public.get_it_data_health_snapshot() to authenticated;

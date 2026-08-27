create or replace function public.get_it_control_center_snapshot()
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
  v_jobs jsonb := '[]'::jsonb;
  v_recent_runs jsonb := '[]'::jsonb;
  v_security jsonb := '{}'::jsonb;
  v_access jsonb := '{}'::jsonb;
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
    raise exception 'IT control center access denied' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'job_key', h.job_key,
        'active', h.active,
        'schedule', h.schedule,
        'last_run_at', h.last_run_at,
        'last_success_at', h.last_success_at,
        'running_count', h.running_count,
        'due_retry_count', h.due_retry_count,
        'dead_letter_count', h.dead_letter_count,
        'health', h.health
      ) order by h.job_key
    ),
    '[]'::jsonb
  )
  into v_jobs
  from private.get_integration_job_health() h;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'job_key', r.job_key,
        'trigger_source', r.trigger_source,
        'status', r.status,
        'attempt', r.attempt,
        'started_at', r.started_at,
        'finished_at', r.finished_at,
        'duration_ms', case
          when r.finished_at is null then null
          else greatest(0, floor(extract(epoch from (r.finished_at - r.started_at)) * 1000))::bigint
        end,
        'retry_after', r.retry_after,
        'recovered_at', r.recovered_at,
        'dead_lettered_at', r.dead_lettered_at,
        'error_code', r.error_code,
        'metrics', r.metrics
      ) order by r.started_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_runs
  from (
    select
      id,
      job_key,
      trigger_source,
      status,
      attempt,
      started_at,
      finished_at,
      retry_after,
      recovered_at,
      dead_lettered_at,
      error_code,
      metrics
    from public.integration_job_runs
    order by started_at desc
    limit 30
  ) r;

  with public_tables as (
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  ),
  policy_counts as (
    select tablename, count(*) as policy_count
    from pg_policies
    where schemaname = 'public'
    group by tablename
  ),
  no_policy_tables as (
    select t.relname
    from public_tables t
    left join policy_counts p on p.tablename = t.relname
    where coalesce(p.policy_count, 0) = 0
  )
  select jsonb_build_object(
    'public_tables', (select count(*) from public_tables),
    'rls_enabled', (select count(*) from public_tables where relrowsecurity),
    'rls_disabled', (select count(*) from public_tables where not relrowsecurity),
    'tables_without_policies', (select count(*) from no_policy_tables),
    'tables_without_policy_names', coalesce((select jsonb_agg(relname order by relname) from no_policy_tables), '[]'::jsonb),
    'broad_all_policy_tables', (
      select count(distinct tablename)
      from pg_policies
      where schemaname = 'public'
        and cmd = 'ALL'
        and permissive = 'PERMISSIVE'
        and (qual is null or btrim(qual) in ('true', '(true)'))
        and (with_check is null or btrim(with_check) in ('true', '(true)'))
    ),
    'public_role_policy_tables', (
      select count(distinct tablename)
      from pg_policies
      where schemaname = 'public'
        and 'public'::name = any(roles)
    ),
    'authenticated_role_policy_tables', (
      select count(distinct tablename)
      from pg_policies
      where schemaname = 'public'
        and 'authenticated'::name = any(roles)
    )
  ) into v_security;

  select jsonb_build_object(
    'active_profiles', count(*) filter (where is_active),
    'disabled_profiles', count(*) filter (where not is_active),
    'admin_users', count(*) filter (where is_active and role_key = 'admin'),
    'approver_users', count(*) filter (where is_active and role_key = 'approver'),
    'it_scoped_users', (
      select count(distinct s.user_id)
      from public.user_operational_scopes s
      join public.user_access_profiles p on p.user_id = s.user_id
      where s.is_active
        and p.is_active
        and lower(coalesce(s.department, '')) = 'it'
    )
  ) into v_access
  from public.user_access_profiles;

  return jsonb_build_object(
    'observed_at', now(),
    'viewer', jsonb_build_object(
      'role', v_role,
      'has_it_scope', v_has_it_scope
    ),
    'jobs', v_jobs,
    'recent_runs', v_recent_runs,
    'security', v_security,
    'access', v_access
  );
end;
$$;

revoke all on function public.get_it_control_center_snapshot() from public, anon;
grant execute on function public.get_it_control_center_snapshot() to authenticated;

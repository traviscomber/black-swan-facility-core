create table if not exists private.integration_job_registry (
  job_key text primary key,
  schedule text not null,
  timezone text not null default 'UTC',
  execution_platform text not null,
  source_system text not null,
  canonical_destination text not null,
  max_runtime_seconds integer not null check (max_runtime_seconds > 0),
  max_attempts integer not null check (max_attempts between 1 and 10),
  retry_backoff_seconds integer not null check (retry_backoff_seconds > 0),
  freshness_sla_seconds integer not null check (freshness_sla_seconds > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on private.integration_job_registry from public, anon, authenticated;
grant select, insert, update, delete on private.integration_job_registry to postgres, service_role;

insert into private.integration_job_registry (
  job_key,
  schedule,
  timezone,
  execution_platform,
  source_system,
  canonical_destination,
  max_runtime_seconds,
  max_attempts,
  retry_backoff_seconds,
  freshness_sla_seconds,
  active,
  updated_at
) values
  (
    'operations-health-snapshot',
    '*/15 * * * *',
    'UTC',
    'supabase_pg_cron',
    'black_swan_canonical_postgres',
    'public.integration_job_runs',
    300,
    3,
    300,
    1200,
    true,
    now()
  ),
  (
    'integration-job-supervisor',
    '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
    'UTC',
    'supabase_pg_cron',
    'public.integration_job_runs',
    'public.integration_job_runs',
    120,
    1,
    300,
    600,
    true,
    now()
  )
on conflict (job_key) do update
set schedule = excluded.schedule,
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

alter table public.integration_job_runs
  add column if not exists parent_run_id uuid references public.integration_job_runs(id) on delete set null,
  add column if not exists retry_after timestamptz,
  add column if not exists superseded_by_run_id uuid references public.integration_job_runs(id) on delete set null,
  add column if not exists recovered_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

create index if not exists integration_job_runs_retry_due_idx
  on public.integration_job_runs (retry_after, started_at)
  where status = 'failed'
    and retry_after is not null
    and superseded_by_run_id is null
    and dead_lettered_at is null;

create index if not exists integration_job_runs_parent_idx
  on public.integration_job_runs (parent_run_id)
  where parent_run_id is not null;

create index if not exists integration_job_runs_dead_letter_idx
  on public.integration_job_runs (job_key, dead_lettered_at desc)
  where dead_lettered_at is not null;

create or replace function private.execute_operations_health_snapshot(
  p_trigger_source text,
  p_attempt integer,
  p_parent_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_run_id uuid;
  v_metrics jsonb;
  v_max_attempts integer;
  v_retry_backoff_seconds integer;
begin
  if p_trigger_source not in ('cron', 'manual', 'system') then
    raise exception 'invalid trigger source: %', p_trigger_source using errcode = '22023';
  end if;

  if p_attempt < 1 then
    raise exception 'attempt must be positive' using errcode = '22023';
  end if;

  select max_attempts, retry_backoff_seconds
    into v_max_attempts, v_retry_backoff_seconds
  from private.integration_job_registry
  where job_key = 'operations-health-snapshot'
    and active;

  if not found then
    raise exception 'operations-health-snapshot is not registered or active' using errcode = '55000';
  end if;

  if p_attempt > v_max_attempts then
    raise exception 'attempt % exceeds configured maximum %', p_attempt, v_max_attempts using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtextextended('operations-health-snapshot', 0)) then
    if p_trigger_source = 'system' and p_attempt > 1 then
      return null;
    end if;

    insert into public.integration_job_runs (
      job_key,
      trigger_source,
      status,
      attempt,
      parent_run_id,
      finished_at,
      metrics
    ) values (
      'operations-health-snapshot',
      p_trigger_source,
      'skipped',
      p_attempt,
      p_parent_run_id,
      now(),
      jsonb_build_object('reason', 'overlap_lock_not_acquired')
    ) returning id into v_run_id;

    return v_run_id;
  end if;

  insert into public.integration_job_runs (
    job_key,
    trigger_source,
    status,
    attempt,
    parent_run_id
  ) values (
    'operations-health-snapshot',
    p_trigger_source,
    'running',
    p_attempt,
    p_parent_run_id
  ) returning id into v_run_id;

  begin
    select jsonb_build_object(
      'observed_at', now(),
      'finance_open_documents', (
        select count(*)
        from public.finance_documents
        where approval_status not in ('approved', 'rejected')
      ),
      'finance_unmapped_centers', (
        select count(*)
        from public.finance_historical_cost_centers
        where mapping_status = 'unmapped'
      ),
      'finance_alias_proposals', (
        select count(*)
        from public.finance_historical_center_aliases
        where status = 'proposed'
      ),
      'hospitality_reconciliation_open', (
        select count(*)
        from public.hospitality_import_reconciliation_queue
        where reconciliation_status not in ('resolved', 'rejected')
      ),
      'hospitality_reconciliation_oldest', (
        select min(created_at)
        from public.hospitality_import_reconciliation_queue
        where reconciliation_status not in ('resolved', 'rejected')
      ),
      'finance_sii_uploads_total', (
        select count(*)
        from public.finance_sii_uploads
      ),
      'finance_sii_uploads_latest', (
        select max(created_at)
        from public.finance_sii_uploads
      )
    ) into v_metrics;

    update public.integration_job_runs
    set status = 'succeeded',
        finished_at = now(),
        metrics = v_metrics,
        retry_after = null,
        dead_lettered_at = null
    where id = v_run_id;
  exception when others then
    update public.integration_job_runs
    set status = 'failed',
        finished_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm,
        retry_after = case
          when p_attempt < v_max_attempts
            then now() + make_interval(secs => v_retry_backoff_seconds * p_attempt)
          else null
        end,
        dead_lettered_at = case
          when p_attempt >= v_max_attempts then now()
          else null
        end
    where id = v_run_id;
  end;

  return v_run_id;
end;
$$;

revoke all on function private.execute_operations_health_snapshot(text, integer, uuid) from public, anon, authenticated;
grant execute on function private.execute_operations_health_snapshot(text, integer, uuid) to postgres, service_role;

create or replace function private.run_operations_health_snapshot()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return private.execute_operations_health_snapshot('cron', 1, null);
end;
$$;

revoke all on function private.run_operations_health_snapshot() from public, anon, authenticated;
grant execute on function private.run_operations_health_snapshot() to postgres, service_role;

create or replace function private.run_integration_job_supervisor()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_supervisor_run_id uuid;
  v_recovered integer := 0;
  v_retried integer := 0;
  v_dead_letters integer := 0;
  v_failed record;
  v_child_run_id uuid;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('integration-job-supervisor', 0)) then
    insert into public.integration_job_runs (
      job_key,
      trigger_source,
      status,
      finished_at,
      metrics
    ) values (
      'integration-job-supervisor',
      'cron',
      'skipped',
      now(),
      jsonb_build_object('reason', 'overlap_lock_not_acquired')
    ) returning id into v_supervisor_run_id;

    return v_supervisor_run_id;
  end if;

  insert into public.integration_job_runs (
    job_key,
    trigger_source,
    status
  ) values (
    'integration-job-supervisor',
    'cron',
    'running'
  ) returning id into v_supervisor_run_id;

  begin
    update public.integration_job_runs r
    set status = 'failed',
        finished_at = now(),
        recovered_at = now(),
        error_code = 'stale_timeout',
        error_message = 'run exceeded configured max runtime',
        retry_after = case
          when r.attempt < j.max_attempts
            then now() + make_interval(secs => j.retry_backoff_seconds)
          else null
        end,
        dead_lettered_at = case
          when r.attempt >= j.max_attempts then now()
          else null
        end
    from private.integration_job_registry j
    where r.job_key = j.job_key
      and r.job_key = 'operations-health-snapshot'
      and r.status = 'running'
      and r.started_at < now() - make_interval(secs => j.max_runtime_seconds)
      and j.active;

    get diagnostics v_recovered = row_count;

    for v_failed in
      select r.id, r.job_key, r.attempt
      from public.integration_job_runs r
      join private.integration_job_registry j on j.job_key = r.job_key
      where r.job_key = 'operations-health-snapshot'
        and r.status = 'failed'
        and r.retry_after is not null
        and r.retry_after <= now()
        and r.superseded_by_run_id is null
        and r.dead_lettered_at is null
        and r.attempt < j.max_attempts
        and j.active
      order by r.retry_after, r.started_at
      limit 10
      for update of r skip locked
    loop
      v_child_run_id := private.execute_operations_health_snapshot(
        'system',
        v_failed.attempt + 1,
        v_failed.id
      );

      if v_child_run_id is not null then
        update public.integration_job_runs
        set superseded_by_run_id = v_child_run_id,
            retry_after = null
        where id = v_failed.id
          and superseded_by_run_id is null;

        v_retried := v_retried + 1;
      end if;
    end loop;

    select count(*)::integer
      into v_dead_letters
    from public.integration_job_runs
    where dead_lettered_at is not null
      and superseded_by_run_id is null;

    update public.integration_job_runs
    set status = 'succeeded',
        finished_at = now(),
        metrics = jsonb_build_object(
          'recovered_stale_runs', v_recovered,
          'retries_started', v_retried,
          'open_dead_letters', v_dead_letters,
          'observed_at', now()
        )
    where id = v_supervisor_run_id;
  exception when others then
    update public.integration_job_runs
    set status = 'failed',
        finished_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm,
        dead_lettered_at = now()
    where id = v_supervisor_run_id;
  end;

  return v_supervisor_run_id;
end;
$$;

revoke all on function private.run_integration_job_supervisor() from public, anon, authenticated;
grant execute on function private.run_integration_job_supervisor() to postgres, service_role;

create or replace function private.get_integration_job_health()
returns table (
  job_key text,
  active boolean,
  schedule text,
  last_run_at timestamptz,
  last_success_at timestamptz,
  running_count bigint,
  due_retry_count bigint,
  dead_letter_count bigint,
  health text
)
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select
    j.job_key,
    j.active,
    j.schedule,
    s.last_run_at,
    s.last_success_at,
    s.running_count,
    s.due_retry_count,
    s.dead_letter_count,
    case
      when not j.active then 'degraded'
      when s.dead_letter_count > 0 then 'broken'
      when s.stale_running_count > 0 then 'stuck'
      when s.due_retry_count > 0 then 'degraded'
      when s.last_success_at is null then 'degraded'
      when s.last_success_at < now() - make_interval(secs => j.freshness_sla_seconds) then 'degraded'
      else 'healthy'
    end as health
  from private.integration_job_registry j
  left join lateral (
    select
      max(r.started_at) as last_run_at,
      max(r.finished_at) filter (where r.status = 'succeeded') as last_success_at,
      count(*) filter (where r.status = 'running') as running_count,
      count(*) filter (
        where r.status = 'running'
          and r.started_at < now() - make_interval(secs => j.max_runtime_seconds)
      ) as stale_running_count,
      count(*) filter (
        where r.status = 'failed'
          and r.retry_after is not null
          and r.retry_after <= now()
          and r.superseded_by_run_id is null
          and r.dead_lettered_at is null
      ) as due_retry_count,
      count(*) filter (
        where r.dead_lettered_at is not null
          and r.superseded_by_run_id is null
      ) as dead_letter_count
    from public.integration_job_runs r
    where r.job_key = j.job_key
  ) s on true
  order by j.job_key;
$$;

revoke all on function private.get_integration_job_health() from public, anon, authenticated;
grant execute on function private.get_integration_job_health() to postgres, service_role;

select cron.schedule(
  'integration-job-supervisor',
  '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
  'select private.run_integration_job_supervisor();'
);

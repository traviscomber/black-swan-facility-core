create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

create table if not exists public.integration_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  trigger_source text not null check (trigger_source in ('cron', 'manual', 'system')),
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  attempt integer not null default 1 check (attempt > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint integration_job_runs_finished_state check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  )
);

create index if not exists integration_job_runs_job_started_idx
  on public.integration_job_runs (job_key, started_at desc);

create index if not exists integration_job_runs_status_started_idx
  on public.integration_job_runs (status, started_at desc);

alter table public.integration_job_runs enable row level security;
revoke all on public.integration_job_runs from anon, authenticated;

create or replace function private.run_operations_health_snapshot()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_run_id uuid;
  v_metrics jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('operations-health-snapshot', 0)) then
    insert into public.integration_job_runs (
      job_key,
      trigger_source,
      status,
      finished_at,
      metrics
    ) values (
      'operations-health-snapshot',
      'cron',
      'skipped',
      now(),
      jsonb_build_object('reason', 'overlap_lock_not_acquired')
    ) returning id into v_run_id;

    return v_run_id;
  end if;

  insert into public.integration_job_runs (
    job_key,
    trigger_source,
    status
  ) values (
    'operations-health-snapshot',
    'cron',
    'running'
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
        metrics = v_metrics
    where id = v_run_id;
  exception when others then
    update public.integration_job_runs
    set status = 'failed',
        finished_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm
    where id = v_run_id;
  end;

  return v_run_id;
end;
$$;

revoke all on function private.run_operations_health_snapshot() from public, anon, authenticated;
grant execute on function private.run_operations_health_snapshot() to postgres, service_role;

select cron.schedule(
  'operations-health-snapshot',
  '*/15 * * * *',
  'select private.run_operations_health_snapshot();'
);

create unique index if not exists orchard_crop_library_external_identity_full_unique
  on public.orchard_crop_library(external_source, external_id);

create table if not exists public.orchard_reference_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_url text not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  fetched_count integer not null default 0 check (fetched_count >= 0),
  upserted_count integer not null default 0 check (upserted_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_message text,
  requested_by uuid not null default auth.uid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists orchard_reference_sync_runs_started_idx
  on public.orchard_reference_sync_runs(started_at desc);

alter table public.orchard_reference_sync_runs enable row level security;

drop policy if exists orchard_reference_sync_runs_select on public.orchard_reference_sync_runs;
create policy orchard_reference_sync_runs_select on public.orchard_reference_sync_runs
  for select to authenticated
  using (public.can_access_orchard_global());

drop policy if exists orchard_reference_sync_runs_admin_insert on public.orchard_reference_sync_runs;
create policy orchard_reference_sync_runs_admin_insert on public.orchard_reference_sync_runs
  for insert to authenticated
  with check (public.current_app_role() = 'admin' and requested_by = auth.uid());

drop policy if exists orchard_reference_sync_runs_admin_update on public.orchard_reference_sync_runs;
create policy orchard_reference_sync_runs_admin_update on public.orchard_reference_sync_runs
  for update to authenticated
  using (public.current_app_role() = 'admin' and requested_by = auth.uid())
  with check (public.current_app_role() = 'admin' and requested_by = auth.uid());

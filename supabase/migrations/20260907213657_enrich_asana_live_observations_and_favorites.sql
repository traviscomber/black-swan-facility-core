alter table public.asana_live_observations
  add column if not exists external_task_id text,
  add column if not exists assignee_label text,
  add column if not exists assignee_external_id text,
  add column if not exists project_external_id text,
  add column if not exists parent_external_id text,
  add column if not exists start_on date,
  add column if not exists due_on date,
  add column if not exists modified_at_source timestamptz,
  add column if not exists task_notes text,
  add column if not exists source_surface_url text,
  add column if not exists recency_class text,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.asana_live_observations
  drop constraint if exists asana_live_observations_recency_class_check;
alter table public.asana_live_observations
  add constraint asana_live_observations_recency_class_check
  check (recency_class is null or recency_class in ('current_2026','legacy_open','browser_only','unknown'));

create unique index if not exists asana_live_observations_external_task_id_uidx
  on public.asana_live_observations (external_task_id)
  where external_task_id is not null;
create index if not exists asana_live_observations_project_external_id_idx
  on public.asana_live_observations (project_external_id)
  where project_external_id is not null;
create index if not exists asana_live_observations_recency_class_idx
  on public.asana_live_observations (recency_class);

revoke all on table public.asana_live_observations from anon;
grant select, insert, update, delete on table public.asana_live_observations to authenticated;
grant all on table public.asana_live_observations to service_role;

drop policy if exists asana_live_observations_read on public.asana_live_observations;
drop policy if exists asana_live_observations_admin_write on public.asana_live_observations;
create policy asana_live_observations_read
  on public.asana_live_observations
  for select
  to authenticated
  using (true);
create policy asana_live_observations_admin_write
  on public.asana_live_observations
  for all
  to authenticated
  using (current_app_role() = any (array['admin'::text,'approver'::text]))
  with check (current_app_role() = any (array['admin'::text,'approver'::text]));

create table if not exists public.asana_live_project_observations (
  id uuid primary key default gen_random_uuid(),
  observer_account text not null default 'Raimundo Colvin',
  project_external_id text,
  project_name text not null,
  parent_portfolio_external_id text,
  parent_portfolio_name text,
  owner_external_id text,
  owner_name text,
  progress_percent numeric check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  priority_label text,
  task_count_total integer check (task_count_total is null or task_count_total >= 0),
  task_count_incomplete integer check (task_count_incomplete is null or task_count_incomplete >= 0),
  task_count_completed integer check (task_count_completed is null or task_count_completed >= 0),
  access_state text not null default 'unknown' check (access_state in ('api_accessible','browser_only','unknown')),
  source_surface text not null,
  source_surface_url text,
  observed_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  observation_key text generated always as (
    md5(lower(project_name) || '|' || lower(coalesce(parent_portfolio_name,'')) || '|' || lower(coalesce(owner_name,'')))
  ) stored,
  unique (observation_key)
);

alter table public.asana_live_project_observations enable row level security;
revoke all on table public.asana_live_project_observations from anon;
grant select, insert, update, delete on table public.asana_live_project_observations to authenticated;
grant all on table public.asana_live_project_observations to service_role;

create policy asana_live_project_observations_read
  on public.asana_live_project_observations
  for select
  to authenticated
  using (true);
create policy asana_live_project_observations_admin_write
  on public.asana_live_project_observations
  for all
  to authenticated
  using (current_app_role() = any (array['admin'::text,'approver'::text]))
  with check (current_app_role() = any (array['admin'::text,'approver'::text]));

create unique index if not exists asana_live_project_observations_project_external_id_uidx
  on public.asana_live_project_observations (project_external_id)
  where project_external_id is not null;
create index if not exists asana_live_project_observations_parent_portfolio_idx
  on public.asana_live_project_observations (parent_portfolio_external_id)
  where parent_portfolio_external_id is not null;

create table if not exists public.asana_live_observations (
  id uuid primary key default gen_random_uuid(),
  observer_account text not null default 'Raimundo Colvin',
  task_title text not null,
  task_status text not null check (task_status in ('open','completed','unknown')),
  project_name text null,
  project_url text null,
  due_label text null,
  collaborator_label text null,
  parent_task_label text null,
  comments_count integer null,
  attachments_count integer null,
  subtasks_count integer null,
  visibility_label text null,
  source_surface text not null default 'asana_my_tasks',
  observed_at timestamptz not null default now(),
  observation_key text generated always as (md5(lower(task_title) || '|' || lower(coalesce(project_name,'')) || '|' || lower(coalesce(due_label,'')))) stored,
  unique (observation_key)
);

alter table public.asana_live_observations enable row level security;

drop policy if exists "asana_live_observations_read" on public.asana_live_observations;
create policy "asana_live_observations_read"
  on public.asana_live_observations
  for select
  to authenticated
  using (true);

drop policy if exists "asana_live_observations_admin_write" on public.asana_live_observations;
create policy "asana_live_observations_admin_write"
  on public.asana_live_observations
  for all
  to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

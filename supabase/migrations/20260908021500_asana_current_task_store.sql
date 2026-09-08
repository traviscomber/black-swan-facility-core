-- Current Asana work is stored separately from historical observations and
-- imported snapshots. The cutover starts at the beginning of 2026-09-07 in
-- Chile so tasks created that day (including the first verified Juan/Raimundo
-- tasks) count as current intake, while older open Asana backlog stays history.

update public.asana_sync_baselines
set cutover_at = '2026-09-07T03:00:00+00:00'::timestamptz,
    label = 'Black Swan current-task cutover · 2026-09-07 Chile'
where workspace_gid = '1205953160575908';

create table if not exists public.asana_current_tasks (
  external_task_id text primary key,
  task_title text not null,
  task_status text not null default 'open' check (task_status in ('open', 'completed')),
  project_name text,
  project_external_id text,
  assignee_label text,
  assignee_email text,
  assignee_external_id text,
  parent_external_id text,
  start_on date,
  due_on date,
  created_at_source timestamptz,
  modified_at_source timestamptz,
  task_notes text,
  source_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists asana_current_tasks_assignee_email_idx
  on public.asana_current_tasks (lower(assignee_email));

create index if not exists asana_current_tasks_created_at_source_idx
  on public.asana_current_tasks (created_at_source desc);

create index if not exists asana_current_tasks_last_seen_at_idx
  on public.asana_current_tasks (last_seen_at desc);

alter table public.asana_current_tasks enable row level security;

grant select, insert, update on public.asana_current_tasks to authenticated;

create policy asana_current_tasks_read
  on public.asana_current_tasks
  for select
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

create policy asana_current_tasks_write
  on public.asana_current_tasks
  for all
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]))
  with check (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

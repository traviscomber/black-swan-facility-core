-- Keep the existing Asana evidence as historical context while establishing a
-- clean cutover for new-task intake. Titles are catalogued separately so they
-- can be reused for assignment without turning historical Asana rows into
-- canonical Black Swan tasks.

alter table public.asana_live_observations
  add column if not exists created_at_source timestamptz;

create table if not exists public.asana_sync_baselines (
  workspace_gid text primary key,
  cutover_at timestamptz not null,
  label text not null,
  created_at timestamptz not null default now()
);

insert into public.asana_sync_baselines (workspace_gid, cutover_at, label)
values (
  '1205953160575908',
  '2026-09-08T02:00:34.426882+00:00'::timestamptz,
  'Black Swan current-task cutover'
)
on conflict (workspace_gid) do nothing;

alter table public.asana_sync_baselines enable row level security;

grant select on public.asana_sync_baselines to authenticated;

create policy asana_sync_baselines_read
  on public.asana_sync_baselines
  for select
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

create table if not exists public.asana_task_title_catalog (
  id uuid primary key default gen_random_uuid(),
  normalized_title text not null unique,
  display_title text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_external_task_id text,
  last_project_name text,
  last_assignee_label text,
  source_scope text not null default 'asana',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asana_task_title_catalog enable row level security;

grant select, insert, update on public.asana_task_title_catalog to authenticated;

create policy asana_task_title_catalog_read
  on public.asana_task_title_catalog
  for select
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

create policy asana_task_title_catalog_write
  on public.asana_task_title_catalog
  for all
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]))
  with check (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

with source_titles as (
  select
    task_title as title,
    coalesce(first_seen_at, observed_at, now()) as first_seen,
    coalesce(last_seen_at, observed_at, now()) as last_seen,
    external_task_id,
    project_name,
    assignee_label
  from public.asana_live_observations
  where nullif(btrim(task_title), '') is not null

  union all

  select
    title,
    coalesce(created_at, now()) as first_seen,
    coalesce(updated_at, created_at, now()) as last_seen,
    null::text as external_task_id,
    null::text as project_name,
    null::text as assignee_label
  from public.tasks
  where nullif(btrim(title), '') is not null
    and (
      task_category like 'asana_import%'
      or coalesce(source_label, '') like 'Asana ·%'
    )
), normalized as (
  select
    lower(regexp_replace(btrim(title), '\s+', ' ', 'g')) as normalized_title,
    btrim(title) as display_title,
    first_seen,
    last_seen,
    external_task_id,
    project_name,
    assignee_label
  from source_titles
), rollup as (
  select normalized_title, min(first_seen) as first_seen_at, max(last_seen) as last_seen_at
  from normalized
  where normalized_title <> ''
  group by normalized_title
), latest as (
  select distinct on (normalized_title)
    normalized_title,
    display_title,
    external_task_id,
    project_name,
    assignee_label,
    last_seen
  from normalized
  where normalized_title <> ''
  order by normalized_title, last_seen desc, display_title
)
insert into public.asana_task_title_catalog (
  normalized_title,
  display_title,
  first_seen_at,
  last_seen_at,
  last_external_task_id,
  last_project_name,
  last_assignee_label
)
select
  r.normalized_title,
  l.display_title,
  r.first_seen_at,
  r.last_seen_at,
  l.external_task_id,
  l.project_name,
  l.assignee_label
from rollup r
join latest l using (normalized_title)
on conflict (normalized_title) do update set
  display_title = excluded.display_title,
  first_seen_at = least(public.asana_task_title_catalog.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(public.asana_task_title_catalog.last_seen_at, excluded.last_seen_at),
  last_external_task_id = coalesce(excluded.last_external_task_id, public.asana_task_title_catalog.last_external_task_id),
  last_project_name = coalesce(excluded.last_project_name, public.asana_task_title_catalog.last_project_name),
  last_assignee_label = coalesce(excluded.last_assignee_label, public.asana_task_title_catalog.last_assignee_label),
  updated_at = now();

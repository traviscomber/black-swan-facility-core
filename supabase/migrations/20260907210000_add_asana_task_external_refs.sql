create table if not exists public.task_external_refs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  provider text not null check (provider in ('asana')),
  external_task_id text null,
  external_project_id text null,
  external_project_name text null,
  external_url text null,
  reconciliation_state text not null default 'unresolved_identity' check (reconciliation_state in ('unresolved_identity','linked','verified','conflict','ignored')),
  last_observed_status text null,
  last_observed_assignee text null,
  last_observed_due_date date null,
  last_observed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, provider)
);

create unique index if not exists task_external_refs_provider_external_task_id_uidx
  on public.task_external_refs(provider, external_task_id)
  where external_task_id is not null;

alter table public.task_external_refs enable row level security;

drop policy if exists "task_external_refs_read_authorized" on public.task_external_refs;
create policy "task_external_refs_read_authorized"
  on public.task_external_refs for select
  to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_external_refs.task_id
      and public.can_access_operational_task_scope(t.operational_area, t.location_id)
  ));

drop policy if exists "task_external_refs_admin_write" on public.task_external_refs;
create policy "task_external_refs_admin_write"
  on public.task_external_refs for all
  to authenticated
  using (public.current_app_role() in ('admin','approver'))
  with check (public.current_app_role() in ('admin','approver'));

insert into public.task_external_refs (
  task_id, provider, external_project_id, external_project_name, external_url, reconciliation_state
)
select
  t.id,
  'asana',
  substring(t.source_path from '/project/([0-9]+)'),
  nullif(trim(replace(coalesce(t.source_label,''), 'Asana ·', '')),''),
  t.source_path,
  'unresolved_identity'
from public.tasks t
where (coalesce(t.task_category,'') like 'asana_import%' or coalesce(t.source_label,'') like 'Asana ·%')
  and t.source_path is not null
on conflict (task_id, provider) do update
set external_project_id = coalesce(public.task_external_refs.external_project_id, excluded.external_project_id),
    external_project_name = coalesce(public.task_external_refs.external_project_name, excluded.external_project_name),
    external_url = coalesce(public.task_external_refs.external_url, excluded.external_url),
    updated_at = now();

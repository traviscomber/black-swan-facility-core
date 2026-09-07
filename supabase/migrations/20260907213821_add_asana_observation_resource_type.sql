alter table public.asana_live_project_observations
  add column if not exists resource_type text not null default 'project';

alter table public.asana_live_project_observations
  drop constraint if exists asana_live_project_observations_resource_type_check;
alter table public.asana_live_project_observations
  add constraint asana_live_project_observations_resource_type_check
  check (resource_type in ('project','portfolio'));

create index if not exists asana_live_project_observations_owner_external_id_idx
  on public.asana_live_project_observations (owner_external_id)
  where owner_external_id is not null;

drop policy if exists asana_live_observations_read on public.asana_live_observations;
create policy asana_live_observations_read
  on public.asana_live_observations
  for select
  to authenticated
  using (current_app_role() = any (array['admin'::text,'approver'::text]));

drop policy if exists asana_live_project_observations_read on public.asana_live_project_observations;
create policy asana_live_project_observations_read
  on public.asana_live_project_observations
  for select
  to authenticated
  using (current_app_role() = any (array['admin'::text,'approver'::text]));

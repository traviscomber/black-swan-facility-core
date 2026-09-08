-- A global sync timestamp prevents an assignee with zero tasks in the latest
-- refresh from seeing stale rows as if they were current. The baseline is safe
-- routing metadata and may be read by any authenticated Black Swan user.

alter table public.asana_sync_baselines
  add column if not exists last_synced_at timestamptz;

create policy asana_sync_baselines_authenticated_read
  on public.asana_sync_baselines
  for select
  to authenticated
  using (auth.uid() is not null);

-- Ordinary users may read only historical rows whose exact Asana email is
-- linked to their employee identity. Admin/approver policies remain unchanged.
create policy asana_live_observations_self_read
  on public.asana_live_observations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_access_profiles uap
      join public.asana_identity_links ail on ail.employee_id = uap.employee_id
      where uap.user_id = auth.uid()
        and uap.is_active = true
        and ail.is_active = true
        and lower(ail.asana_email) = lower(asana_live_observations.collaborator_label)
    )
  );

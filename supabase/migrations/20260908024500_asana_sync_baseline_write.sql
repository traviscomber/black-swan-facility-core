grant update on public.asana_sync_baselines to authenticated;

create policy asana_sync_baselines_write
  on public.asana_sync_baselines
  for update
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]))
  with check (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

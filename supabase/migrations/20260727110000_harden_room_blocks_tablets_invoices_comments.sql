-- Restrict destructive room block actions to administrators.
drop policy if exists "Authenticated users can delete room blocks" on public.room_blocks;
create policy "room_blocks_admin_delete"
on public.room_blocks
for delete
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = 'admin'
);

-- Remove public tablet exposure and deprecated auth.role() usage.
drop policy if exists "Read tablet devices" on public.tablet_devices;
drop policy if exists "Update tablet devices" on public.tablet_devices;
create policy "tablet_devices_authenticated_select"
on public.tablet_devices
for select
to authenticated
using ((select auth.uid()) is not null);
create policy "tablet_devices_internal_update"
on public.tablet_devices
for update
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin','approver'])
)
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin','approver'])
);

-- Align invoice writes with the finance role model.
drop policy if exists "Authenticated users create invoices" on public.invoices;
drop policy if exists "Authenticated users update invoices" on public.invoices;
create policy "Finance roles create invoices"
on public.invoices
for insert
to authenticated
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin','approver'])
);
create policy "Finance roles update invoices"
on public.invoices
for update
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin','approver'])
)
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin','approver'])
);

-- Comments are operational history and must remain append-only.
drop policy if exists "task_comments_update_authenticated" on public.task_comments;
drop policy if exists "task_comments_delete_admin" on public.task_comments;
revoke update, delete on public.task_comments from authenticated;
grant select, insert on public.task_comments to authenticated;

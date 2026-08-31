-- Black Swan OS: replace legacy incident authorization with canonical access.
--
-- This migration is intentionally policy-only. It does not alter or backfill
-- operational records. Apply it through the reviewed Supabase migration path.

alter table public.issues enable row level security;
alter table public.issue_labels enable row level security;
alter table public.issue_label_assignments enable row level security;
alter table public.issue_task_assignments enable row level security;

-- Remove the live legacy policies and any early permissive bootstrap policies.
drop policy if exists "Internal staff can manage issues" on public.issues;
drop policy if exists "Allow all on issues" on public.issues;

drop policy if exists "issue_labels_admin_delete" on public.issue_labels;
drop policy if exists "issue_labels_authenticated_insert" on public.issue_labels;
drop policy if exists "issue_labels_authenticated_select" on public.issue_labels;
drop policy if exists "issue_labels_authenticated_update" on public.issue_labels;
drop policy if exists "Allow all on issue_labels" on public.issue_labels;

drop policy if exists "issue_label_assignments_admin_delete" on public.issue_label_assignments;
drop policy if exists "issue_label_assignments_authenticated_insert" on public.issue_label_assignments;
drop policy if exists "issue_label_assignments_authenticated_select" on public.issue_label_assignments;
drop policy if exists "issue_label_assignments_authenticated_update" on public.issue_label_assignments;
drop policy if exists "Allow all on issue_label_assignments" on public.issue_label_assignments;

drop policy if exists "issue_task_assignments_admin_delete" on public.issue_task_assignments;
drop policy if exists "issue_task_assignments_authenticated_insert" on public.issue_task_assignments;
drop policy if exists "issue_task_assignments_authenticated_select" on public.issue_task_assignments;
drop policy if exists "issue_task_assignments_authenticated_update" on public.issue_task_assignments;
drop policy if exists "Allow all on issue_task_assignments" on public.issue_task_assignments;

-- Remove broad grants, including legacy TRUNCATE, TRIGGER and REFERENCES access.
revoke all on table public.issues from anon, authenticated;
revoke all on table public.issue_labels from anon, authenticated;
revoke all on table public.issue_label_assignments from anon, authenticated;
revoke all on table public.issue_task_assignments from anon, authenticated;

grant select on table public.issues to authenticated;
grant insert (
  asset_id,
  reported_by,
  description,
  status,
  photo_url,
  related_item_type,
  related_item_id,
  category,
  priority,
  title,
  issue_type_id,
  infrastructure_id,
  severity
) on table public.issues to authenticated;
grant update (
  title,
  description,
  category,
  priority,
  severity,
  status,
  photo_url,
  resolved_at,
  resolved_by
) on table public.issues to authenticated;
grant delete on table public.issues to authenticated;

grant select on table public.issue_labels to authenticated;
grant select, delete on table public.issue_label_assignments to authenticated;
grant insert (issue_id, label_id) on table public.issue_label_assignments to authenticated;
grant select, delete on table public.issue_task_assignments to authenticated;
grant insert (issue_id, task_id) on table public.issue_task_assignments to authenticated;

-- Issue location is resolved only from canonical relationships. Unknown or
-- unlinked objects resolve to NULL, which fails closed for location-bound users.
create or replace function public.resolve_issue_scope_location(
  p_asset_id uuid,
  p_infrastructure_id uuid,
  p_related_item_type text,
  p_related_item_id uuid
)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    (select a.warehouse_location_id from public.assets a where a.id = p_asset_id),
    (select i.location_id from public.infrastructure_plans i where i.id = p_infrastructure_id),
    case when p_related_item_type = 'asset' then
      (select a.warehouse_location_id from public.assets a where a.id = p_related_item_id)
    end,
    case when p_related_item_type = 'infrastructure' then
      (select i.location_id from public.infrastructure_plans i where i.id = p_related_item_id)
    end,
    case when p_related_item_type = 'room' then
      (select r.location_id from public.rooms r where r.id = p_related_item_id)
    end,
    case when p_related_item_type = 'reservation' then
      (select r.location_id from public.reservations r where r.id = p_related_item_id)
    end,
    case when p_related_item_type = 'hospitality_request' then
      (select h.location_id from public.hospitality_requests h where h.id = p_related_item_id)
    end,
    case when p_related_item_type = 'location' then p_related_item_id end
  );
$function$;

revoke all on function public.resolve_issue_scope_location(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.resolve_issue_scope_location(uuid, uuid, text, uuid) to authenticated, service_role;

create policy issues_select_authorized
on public.issues
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.current_app_role()) not in ('none', 'disabled')
  and (
    select public.can_access_operational_scope(
      'maintenance',
      public.resolve_issue_scope_location(asset_id, infrastructure_id, related_item_type, related_item_id)
    )
  )
);

-- Any active scoped staff member may report an observed issue. Triage and
-- mutation remain behind maintenance.operate.
create policy issues_insert_authorized
on public.issues
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select public.current_app_role()) not in ('none', 'disabled')
  and (
    select public.can_access_operational_scope(
      'maintenance',
      public.resolve_issue_scope_location(asset_id, infrastructure_id, related_item_type, related_item_id)
    )
  )
);

create policy issues_update_maintenance
on public.issues
for update
to authenticated
using (
  (select public.can_app_action('maintenance.operate'))
  and (
    select public.can_access_operational_scope(
      'maintenance',
      public.resolve_issue_scope_location(asset_id, infrastructure_id, related_item_type, related_item_id)
    )
  )
)
with check (
  (select public.can_app_action('maintenance.operate'))
  and (
    select public.can_access_operational_scope(
      'maintenance',
      public.resolve_issue_scope_location(asset_id, infrastructure_id, related_item_type, related_item_id)
    )
  )
);

create policy issues_delete_admin
on public.issues
for delete
to authenticated
using ((select public.current_app_role()) = 'admin');

create policy issue_labels_select_authorized
on public.issue_labels
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select public.current_app_role()) not in ('none', 'disabled')
);

create policy issue_label_assignments_select_authorized
on public.issue_label_assignments
for select
to authenticated
using (exists (select 1 from public.issues i where i.id = issue_id));

create policy issue_label_assignments_insert_maintenance
on public.issue_label_assignments
for insert
to authenticated
with check (
  (select public.can_app_action('maintenance.operate'))
  and exists (select 1 from public.issues i where i.id = issue_id)
  and exists (select 1 from public.issue_labels l where l.id = label_id and coalesce(l.is_active, true))
);

create policy issue_label_assignments_delete_maintenance
on public.issue_label_assignments
for delete
to authenticated
using (
  (select public.can_app_action('maintenance.operate'))
  and exists (select 1 from public.issues i where i.id = issue_id)
);

create policy issue_task_assignments_select_authorized
on public.issue_task_assignments
for select
to authenticated
using (exists (select 1 from public.issues i where i.id = issue_id));

create policy issue_task_assignments_insert_maintenance
on public.issue_task_assignments
for insert
to authenticated
with check (
  (select public.can_app_action('maintenance.operate'))
  and exists (select 1 from public.issues i where i.id = issue_id)
  and exists (select 1 from public.tasks t where t.id = task_id)
);

create policy issue_task_assignments_delete_maintenance
on public.issue_task_assignments
for delete
to authenticated
using (
  (select public.can_app_action('maintenance.operate'))
  and exists (select 1 from public.issues i where i.id = issue_id)
);

comment on function public.resolve_issue_scope_location(uuid, uuid, text, uuid) is
  'Resolves an incident to its canonical operational location without bypassing source-table RLS.';

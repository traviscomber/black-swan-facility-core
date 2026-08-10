drop policy if exists task_evidence_storage_insert on storage.objects;
drop policy if exists task_evidence_storage_select on storage.objects;
drop policy if exists task_evidence_storage_update on storage.objects;

create policy task_evidence_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-evidence'
  and public.can_app_action('housekeeping.operate')
);

create policy task_evidence_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-evidence'
  and public.can_app_action('housekeeping.operate')
);

create policy task_evidence_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-evidence'
  and public.can_app_action('housekeeping.operate')
)
with check (
  bucket_id = 'task-evidence'
  and public.can_app_action('housekeeping.operate')
);

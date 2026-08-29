create table if not exists public.orchard_field_evidence (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references public.orchard_crops(id) on delete cascade,
  care_log_id uuid references public.orchard_care_logs(id) on delete cascade,
  pest_log_id uuid references public.orchard_pest_logs(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint,
  caption text,
  taken_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint orchard_field_evidence_one_source check (((care_log_id is not null)::int + (pest_log_id is not null)::int) <= 1),
  constraint orchard_field_evidence_image_mime check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  constraint orchard_field_evidence_file_size check (file_size is null or (file_size > 0 and file_size <= 6291456))
);

create or replace function public.validate_orchard_field_evidence_lineage()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.care_log_id is not null and not exists (
    select 1 from public.orchard_care_logs c where c.id = new.care_log_id and c.crop_id = new.crop_id
  ) then
    raise exception 'Care evidence must reference a care record for the same crop';
  end if;
  if new.pest_log_id is not null and not exists (
    select 1 from public.orchard_pest_logs p where p.id = new.pest_log_id and p.crop_id = new.crop_id
  ) then
    raise exception 'Health evidence must reference a health record for the same crop';
  end if;
  return new;
end;
$$;

drop trigger if exists orchard_field_evidence_lineage_guard on public.orchard_field_evidence;
create trigger orchard_field_evidence_lineage_guard
before insert or update of crop_id, care_log_id, pest_log_id
on public.orchard_field_evidence
for each row execute function public.validate_orchard_field_evidence_lineage();

create index if not exists orchard_field_evidence_crop_created_idx on public.orchard_field_evidence(crop_id, created_at desc);
create index if not exists orchard_field_evidence_care_idx on public.orchard_field_evidence(care_log_id) where care_log_id is not null;
create index if not exists orchard_field_evidence_pest_idx on public.orchard_field_evidence(pest_log_id) where pest_log_id is not null;

alter table public.orchard_field_evidence enable row level security;

drop policy if exists orchard_field_evidence_select on public.orchard_field_evidence;
create policy orchard_field_evidence_select on public.orchard_field_evidence
for select to authenticated
using (public.can_access_orchard_crop(crop_id));

drop policy if exists orchard_field_evidence_insert on public.orchard_field_evidence;
create policy orchard_field_evidence_insert on public.orchard_field_evidence
for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_access_orchard_crop(crop_id));

drop policy if exists orchard_field_evidence_update on public.orchard_field_evidence;
create policy orchard_field_evidence_update on public.orchard_field_evidence
for update to authenticated
using (public.can_access_orchard_crop(crop_id))
with check (public.can_access_orchard_crop(crop_id));

drop policy if exists orchard_field_evidence_delete on public.orchard_field_evidence;
create policy orchard_field_evidence_delete on public.orchard_field_evidence
for delete to authenticated
using (public.can_access_orchard_crop(crop_id));

revoke all on public.orchard_field_evidence from anon;
grant select, insert, delete on public.orchard_field_evidence to authenticated;
grant update(caption, taken_at) on public.orchard_field_evidence to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('orchard-evidence', 'orchard-evidence', false, 6291456, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists orchard_evidence_objects_select on storage.objects;
create policy orchard_evidence_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'orchard-evidence'
  and exists (
    select 1 from public.orchard_field_evidence e
    where e.storage_path = name and public.can_access_orchard_crop(e.crop_id)
  )
);

drop policy if exists orchard_evidence_objects_insert on storage.objects;
create policy orchard_evidence_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'orchard-evidence'
  and exists (
    select 1 from public.orchard_field_evidence e
    where e.storage_path = name
      and e.created_by = (select auth.uid())
      and public.can_access_orchard_crop(e.crop_id)
  )
);

drop policy if exists orchard_evidence_objects_delete on storage.objects;
create policy orchard_evidence_objects_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'orchard-evidence'
  and exists (
    select 1 from public.orchard_field_evidence e
    where e.storage_path = name and public.can_access_orchard_crop(e.crop_id)
  )
);

revoke execute on function public.validate_orchard_field_evidence_lineage() from public, anon;
grant execute on function public.validate_orchard_field_evidence_lineage() to authenticated, service_role;

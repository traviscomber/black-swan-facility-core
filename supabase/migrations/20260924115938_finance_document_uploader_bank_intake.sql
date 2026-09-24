-- A dedicated intake role can submit source documents but cannot approve,
-- post, reverse, or mark a payment as settled.
alter table public.user_access_profiles drop constraint if exists user_access_profiles_role_key_check;
alter table public.user_access_profiles add constraint user_access_profiles_role_key_check
  check (role_key in ('admin','approver','operator','finance_uploader'));

insert into public.booking_action_permissions(role_key,action_key,allowed)
values ('finance_uploader','finance.document_upload',true)
on conflict (role_key,action_key) do update set allowed=excluded.allowed;

drop policy if exists finance_sii_uploads_uploader_read on public.finance_sii_uploads;
create policy finance_sii_uploads_uploader_read on public.finance_sii_uploads
  for select to authenticated
  using (uploaded_by=(select auth.uid()) and (select public.can_app_action('finance.document_upload')));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('finance-bank-statements','finance-bank-statements',false,15728640,
        array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.finance_bank_statement_uploads (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null unique,
  storage_bucket text not null default 'finance-bank-statements',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check(size_bytes>0 and size_bytes<=15728640),
  period_start date not null,
  period_end date not null,
  status text not null default 'pending_review' check(status in ('pending_review','reviewed','rejected')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint finance_bank_statement_period_check check(period_end>=period_start)
);
create index if not exists finance_bank_statement_period_idx
  on public.finance_bank_statement_uploads(period_end desc,created_at desc);
alter table public.finance_bank_statement_uploads enable row level security;
revoke all on public.finance_bank_statement_uploads from anon,authenticated;
grant select on public.finance_bank_statement_uploads to authenticated;
create policy finance_bank_statement_read on public.finance_bank_statement_uploads
  for select to authenticated using (
    (uploaded_by=(select auth.uid()) and (select public.can_app_action('finance.document_upload')))
    or (select public.can_app_action('finance.adjust'))
  );

-- Uploads are registered only by the server after a validated private storage write.
-- No client INSERT/UPDATE/DELETE grants or storage object policies are provided.

-- Black Swan OS: review-first Chart of Accounts import staging.
-- Raw accountant source rows are preserved. No canonical account is created or
-- updated until an admin explicitly approves and applies a batch.

create table if not exists public.coa_import_batches (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  source_name text not null,
  source_file_name text,
  source_file_hash text,
  status text not null default 'draft',
  row_count integer not null default 0,
  valid_row_count integer not null default 0,
  invalid_row_count integer not null default 0,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coa_import_batch_status_check check (status in ('draft','review','approved','rejected','applied'))
);

create table if not exists public.coa_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.coa_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_payload jsonb not null default '{}'::jsonb,
  account_code text,
  account_name text,
  account_type text,
  parent_account_code text,
  cashflow_class text,
  is_active boolean not null default true,
  validation_status text not null default 'pending',
  validation_errors jsonb not null default '[]'::jsonb,
  canonical_account_id uuid references public.entity_chart_of_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_number),
  constraint coa_import_row_account_type_check check (
    account_type is null or account_type in ('asset','liability','equity','revenue','expense')
  ),
  constraint coa_import_row_cashflow_check check (
    cashflow_class is null or cashflow_class in ('operating','investing','financing','non_cash')
  ),
  constraint coa_import_row_validation_status_check check (
    validation_status in ('pending','valid','invalid','applied')
  )
);

create index if not exists coa_import_batches_entity_status_idx
  on public.coa_import_batches(legal_entity_id, status, created_at desc);
create index if not exists coa_import_rows_batch_idx
  on public.coa_import_rows(batch_id, row_number);

alter table public.coa_import_batches enable row level security;
alter table public.coa_import_rows enable row level security;

create policy coa_import_batches_admin_select
  on public.coa_import_batches for select to authenticated
  using (public.current_app_role() = 'admin');
create policy coa_import_batches_admin_write
  on public.coa_import_batches for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
create policy coa_import_rows_admin_select
  on public.coa_import_rows for select to authenticated
  using (public.current_app_role() = 'admin');
create policy coa_import_rows_admin_write
  on public.coa_import_rows for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create or replace function public.validate_coa_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_batch public.coa_import_batches%rowtype;
  v_row public.coa_import_rows%rowtype;
  v_errors jsonb;
  v_valid integer := 0;
  v_invalid integer := 0;
  v_total integer := 0;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select * into v_batch
  from public.coa_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'COA_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status in ('applied','rejected') then
    raise exception 'COA_IMPORT_BATCH_NOT_EDITABLE';
  end if;

  for v_row in
    select * from public.coa_import_rows where batch_id = p_batch_id order by row_number
  loop
    v_total := v_total + 1;
    v_errors := '[]'::jsonb;

    if coalesce(btrim(v_row.account_code), '') = '' then
      v_errors := v_errors || jsonb_build_array('account_code_required');
    end if;
    if coalesce(btrim(v_row.account_name), '') = '' then
      v_errors := v_errors || jsonb_build_array('account_name_required');
    end if;
    if v_row.account_type is null then
      v_errors := v_errors || jsonb_build_array('account_type_required');
    end if;

    if exists (
      select 1
      from public.coa_import_rows r2
      where r2.batch_id = p_batch_id
        and r2.id <> v_row.id
        and nullif(btrim(r2.account_code), '') = nullif(btrim(v_row.account_code), '')
    ) then
      v_errors := v_errors || jsonb_build_array('duplicate_account_code_in_batch');
    end if;

    if nullif(btrim(v_row.parent_account_code), '') is not null
       and not exists (
         select 1 from public.coa_import_rows p
         where p.batch_id = p_batch_id
           and btrim(p.account_code) = btrim(v_row.parent_account_code)
       )
       and not exists (
         select 1 from public.entity_chart_of_accounts c
         where c.legal_entity_id = v_batch.legal_entity_id
           and c.account_code = btrim(v_row.parent_account_code)
       ) then
      v_errors := v_errors || jsonb_build_array('parent_account_not_found');
    end if;

    update public.coa_import_rows
    set validation_errors = v_errors,
        validation_status = case when jsonb_array_length(v_errors) = 0 then 'valid' else 'invalid' end,
        updated_at = now()
    where id = v_row.id;

    if jsonb_array_length(v_errors) = 0 then
      v_valid := v_valid + 1;
    else
      v_invalid := v_invalid + 1;
    end if;
  end loop;

  update public.coa_import_batches
  set row_count = v_total,
      valid_row_count = v_valid,
      invalid_row_count = v_invalid,
      status = case when v_invalid = 0 and v_total > 0 then 'review' else 'draft' end,
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'row_count', v_total,
    'valid_row_count', v_valid,
    'invalid_row_count', v_invalid,
    'is_valid', v_total > 0 and v_invalid = 0
  );
end;
$function$;

create or replace function public.review_coa_import_batch(
  p_batch_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_batch public.coa_import_batches%rowtype;
  v_validation jsonb;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'COA_IMPORT_INVALID_DECISION';
  end if;

  select * into v_batch
  from public.coa_import_batches
  where id = p_batch_id
  for update;

  if not found then raise exception 'COA_IMPORT_BATCH_NOT_FOUND'; end if;
  if v_batch.status = 'applied' then raise exception 'COA_IMPORT_BATCH_ALREADY_APPLIED'; end if;

  if p_decision = 'approved' then
    v_validation := public.validate_coa_import_batch(p_batch_id);
    if coalesce((v_validation->>'is_valid')::boolean, false) is not true then
      raise exception 'COA_IMPORT_BATCH_INVALID';
    end if;
  end if;

  update public.coa_import_batches
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      notes = p_notes,
      updated_at = now()
  where id = p_batch_id;
end;
$function$;

create or replace function public.apply_coa_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_batch public.coa_import_batches%rowtype;
  v_row public.coa_import_rows%rowtype;
  v_account_id uuid;
  v_parent_id uuid;
  v_applied integer := 0;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select * into v_batch
  from public.coa_import_batches
  where id = p_batch_id
  for update;

  if not found then raise exception 'COA_IMPORT_BATCH_NOT_FOUND'; end if;
  if v_batch.status <> 'approved' or v_batch.reviewed_by is null or v_batch.reviewed_at is null then
    raise exception 'COA_IMPORT_BATCH_NOT_APPROVED';
  end if;
  if exists (select 1 from public.coa_import_rows where batch_id = p_batch_id and validation_status <> 'valid') then
    raise exception 'COA_IMPORT_BATCH_INVALID';
  end if;

  -- First pass creates/updates accounts without parent links.
  for v_row in
    select * from public.coa_import_rows where batch_id = p_batch_id order by row_number
  loop
    insert into public.entity_chart_of_accounts (
      legal_entity_id, account_code, account_name, account_type,
      cashflow_class, is_active, source_reference, updated_at
    ) values (
      v_batch.legal_entity_id,
      btrim(v_row.account_code),
      btrim(v_row.account_name),
      v_row.account_type,
      v_row.cashflow_class,
      v_row.is_active,
      concat('coa_import_batch:', p_batch_id),
      now()
    )
    on conflict (legal_entity_id, account_code) do update
      set account_name = excluded.account_name,
          account_type = excluded.account_type,
          cashflow_class = excluded.cashflow_class,
          is_active = excluded.is_active,
          source_reference = excluded.source_reference,
          updated_at = now()
    returning id into v_account_id;

    update public.coa_import_rows
    set canonical_account_id = v_account_id,
        updated_at = now()
    where id = v_row.id;
    v_applied := v_applied + 1;
  end loop;

  -- Second pass resolves parent links after all batch accounts exist.
  for v_row in
    select * from public.coa_import_rows where batch_id = p_batch_id order by row_number
  loop
    v_parent_id := null;
    if nullif(btrim(v_row.parent_account_code), '') is not null then
      select id into v_parent_id
      from public.entity_chart_of_accounts
      where legal_entity_id = v_batch.legal_entity_id
        and account_code = btrim(v_row.parent_account_code)
      limit 1;
    end if;

    update public.entity_chart_of_accounts
    set parent_account_id = v_parent_id,
        updated_at = now()
    where id = v_row.canonical_account_id;

    update public.coa_import_rows
    set validation_status = 'applied',
        updated_at = now()
    where id = v_row.id;
  end loop;

  update public.coa_import_batches
  set status = 'applied',
      applied_by = auth.uid(),
      applied_at = now(),
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'applied_rows', v_applied);
end;
$function$;

revoke all on function public.validate_coa_import_batch(uuid) from public;
revoke all on function public.review_coa_import_batch(uuid,text,text) from public;
revoke all on function public.apply_coa_import_batch(uuid) from public;
grant execute on function public.validate_coa_import_batch(uuid) to authenticated;
grant execute on function public.review_coa_import_batch(uuid,text,text) to authenticated;
grant execute on function public.apply_coa_import_batch(uuid) to authenticated;

comment on table public.coa_import_batches is 'Review-first Chart of Accounts import batches. Canonical accounts are changed only after explicit approval and apply.';
comment on table public.coa_import_rows is 'Immutable-source staging representation of accountant-provided Chart of Accounts rows with validation and canonical-account linkage.';

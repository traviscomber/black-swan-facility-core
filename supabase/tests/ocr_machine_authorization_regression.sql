-- Black Swan OS OCR machine authorization regression gate.
-- Run after accounting intake + OCR machine migrations on a development database.
-- Read-only assertions; no production data is modified.

begin;

-- Machine credentials must be hashed and RLS-protected.
do $test$
begin
  if to_regclass('public.machine_principals') is null then
    raise exception 'OCR REGRESSION: machine_principals table missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='machine_principals'
      and column_name='token_hash'
      and data_type='bytea'
  ) then
    raise exception 'OCR REGRESSION: machine token hash column missing or wrong type';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='machine_principals'
      and c.relrowsecurity
  ) then
    raise exception 'OCR REGRESSION: RLS disabled on machine_principals';
  end if;
end;
$test$;

-- Only the three narrow OCR entry points may be callable by anon.
do $test$
declare
  v_name text;
begin
  foreach v_name in array array['ocr_claim_intake','ocr_write_proposal','ocr_mark_failed'] loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname=v_name
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then
      raise exception 'OCR REGRESSION: anon cannot execute %', v_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='require_machine_scope'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'OCR REGRESSION: require_machine_scope must not be directly callable by app roles';
  end if;
end;
$test$;

-- OCR proposal writer must remain review-only and must not alter canonical posting fields.
do $test$
declare
  v_body text;
begin
  select pg_get_functiondef(p.oid)
    into v_body
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ocr_write_proposal'
  order by p.oid desc
  limit 1;

  if v_body is null then
    raise exception 'OCR REGRESSION: ocr_write_proposal missing';
  end if;

  if v_body not ilike '%requires_review = true%'
     or v_body not ilike '%status = ''classified''%' then
    raise exception 'OCR REGRESSION: OCR proposals must remain classified + requires_review';
  end if;

  if v_body ilike '%canonical_document_id =%'
     or v_body ilike '%reviewed_by =%'
     or v_body ilike '%reviewed_at =%'
     or v_body ilike '%posted_at =%'
     or v_body ilike '%approved_at =%' then
    raise exception 'OCR REGRESSION: OCR writer gained canonical approval/posting authority';
  end if;
end;
$test$;

-- Failure handling must remain inside intake and may not touch canonical documents.
do $test$
declare
  v_body text;
begin
  select pg_get_functiondef(p.oid)
    into v_body
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ocr_mark_failed'
  order by p.oid desc
  limit 1;

  if v_body is null or v_body not ilike '%status = ''failed''%' then
    raise exception 'OCR REGRESSION: failure marker missing';
  end if;

  if v_body ilike '%accounting_documents%' then
    raise exception 'OCR REGRESSION: failure marker must not mutate canonical accounting documents';
  end if;
end;
$test$;

-- Intake must preserve explicit failed state and processing diagnostics.
do $test$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='accounting_document_intake'
      and pg_get_constraintdef(c.oid) ilike '%failed%'
  ) then
    raise exception 'OCR REGRESSION: intake status does not include failed';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='accounting_document_intake'
      and column_name='processing_attempts'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='accounting_document_intake'
      and column_name='processing_error_code'
  ) then
    raise exception 'OCR REGRESSION: processing diagnostics missing';
  end if;
end;
$test$;

rollback;

-- Black Swan OS accounting/document intake regression gate.
-- Run after the legal-entity and accounting-intake migrations on a development
-- database. Read-only assertions; no production data is modified.

begin;

do $test$
declare
  v_missing text[];
begin
  select array_agg(required_name order by required_name)
  into v_missing
  from unnest(array[
    'accounting_counterparties',
    'accounting_document_intake',
    'accounting_documents',
    'accounting_document_allocations',
    'cash_transactions',
    'accounting_reconciliation_matches'
  ]) required_name
  where to_regclass('public.' || required_name) is null;

  if v_missing is not null then
    raise exception 'ACCOUNTING REGRESSION: missing tables %', v_missing;
  end if;
end;
$test$;

-- Canonical documents must have a legal entity; OCR intake may remain unresolved.
do $test$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='accounting_documents'
      and column_name='legal_entity_id'
      and is_nullable <> 'NO'
  ) then
    raise exception 'ACCOUNTING REGRESSION: accounting_documents.legal_entity_id must be NOT NULL';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='accounting_document_intake'
      and column_name='proposed_legal_entity_id'
      and is_nullable = 'YES'
  ) then
    raise exception 'ACCOUNTING REGRESSION: intake must allow unresolved legal entity during review';
  end if;
end;
$test$;

-- The AI/OCR staging layer must remain review-first.
do $test$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname='accounting_document_intake'
      and pg_get_constraintdef(c.oid) ilike '%received%extracting%classified%review%approved%rejected%posted%'
  ) then
    raise exception 'ACCOUNTING REGRESSION: intake review status constraint not found';
  end if;
end;
$test$;

-- Existing hospitality records must not be silently promoted into the new ledger.
do $test$
begin
  if exists (
    select 1 from public.accounting_documents
    where source_invoice_id is not null or source_payment_id is not null
  ) then
    raise exception 'ACCOUNTING REGRESSION: legacy hospitality records were linked without explicit reviewed migration';
  end if;
end;
$test$;

-- Financial records must be protected by RLS.
do $test$
declare
  v_table text;
begin
  foreach v_table in array array[
    'accounting_document_intake',
    'accounting_documents',
    'accounting_document_allocations',
    'cash_transactions',
    'accounting_reconciliation_matches'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'ACCOUNTING REGRESSION: RLS disabled on %', v_table;
    end if;
  end loop;
end;
$test$;

-- Entity-bound canonical finance policies must resolve through legal-entity access.
do $test$
declare
  v_policy_count integer;
begin
  select count(*)
  into v_policy_count
  from pg_policies
  where schemaname='public'
    and tablename in (
      'accounting_documents',
      'accounting_document_allocations',
      'cash_transactions',
      'accounting_reconciliation_matches'
    )
    and (qual ilike '%can_access_legal_entity%' or with_check ilike '%can_access_legal_entity%');

  if v_policy_count < 4 then
    raise exception 'ACCOUNTING REGRESSION: expected entity-scoped finance policies on canonical financial tables';
  end if;
end;
$test$;

-- Blue Marble must remain a legal/accounting-only entity; accounting infrastructure
-- may reference it, but no operational allocation is created by this migration.
do $test$
declare
  v_blue_marble uuid;
begin
  select id into v_blue_marble from public.legal_entities where code='BLUE_MARBLE';
  if v_blue_marble is null then
    raise exception 'ACCOUNTING REGRESSION: Blue Marble legal entity missing';
  end if;

  if exists (select 1 from public.employee_employments where legal_entity_id=v_blue_marble)
     or exists (select 1 from public.inventory_legal_entity_assignments where legal_entity_id=v_blue_marble)
     or exists (select 1 from public.asset_ownership_assignments where owner_legal_entity_id=v_blue_marble)
     or exists (select 1 from public.asset_operational_assignments where operating_legal_entity_id=v_blue_marble) then
    raise exception 'ACCOUNTING REGRESSION: Blue Marble received operational allocations without canonical source approval';
  end if;
end;
$test$;

rollback;
-- Black Swan OS accounting posting boundary regression gate.
-- Run after the posting-boundary migration on a non-production database.
-- Assertions are read-only and rolled back.

begin;

do $test$
begin
  if to_regprocedure('public.materialize_accounting_document_from_intake(uuid)') is null
     or to_regprocedure('public.create_draft_journal_for_document(uuid)') is null
     or to_regprocedure('public.validate_accounting_journal(uuid)') is null
     or to_regprocedure('public.approve_accounting_journal(uuid)') is null
     or to_regprocedure('public.post_accounting_journal(uuid)') is null then
    raise exception 'POSTING REGRESSION: canonical posting RPCs are missing';
  end if;
end;
$test$;

-- Generic finance access must remain read-only on canonical accounting writes.
do $test$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('accounting_documents','accounting_document_allocations','accounting_journal_entries','accounting_journal_lines')
      and policyname in ('accounting_documents_finance_write','accounting_allocations_finance_write','journal_entries_finance_access','journal_lines_finance_access')
  ) then
    raise exception 'POSTING REGRESSION: legacy broad finance write policy still exists';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='accounting_journal_entries'
      and policyname='journal_entries_finance_select' and cmd='SELECT'
  ) then
    raise exception 'POSTING REGRESSION: finance-select policy missing on journal entries';
  end if;
end;
$test$;

-- Materialization must explicitly test intake approval before creating canonical docs.
do $test$
declare
  v_def text;
begin
  select pg_get_functiondef('public.materialize_accounting_document_from_intake(uuid)'::regprocedure)
  into v_def;

  if v_def not ilike '%status <> ''approved''%'
     or v_def not ilike '%reviewed_by is null%'
     or v_def not ilike '%reviewed_at is null%' then
    raise exception 'POSTING REGRESSION: materialization does not enforce human approval';
  end if;
end;
$test$;

-- Journal approval and posting must both run balance validation.
do $test$
declare
  v_approve text;
  v_post text;
begin
  select pg_get_functiondef('public.approve_accounting_journal(uuid)'::regprocedure) into v_approve;
  select pg_get_functiondef('public.post_accounting_journal(uuid)'::regprocedure) into v_post;

  if v_approve not ilike '%validate_accounting_journal%'
     or v_approve not ilike '%ACCOUNTING_JOURNAL_NOT_BALANCED%' then
    raise exception 'POSTING REGRESSION: journal approval can bypass balance validation';
  end if;

  if v_post not ilike '%validate_accounting_journal%'
     or v_post not ilike '%ACCOUNTING_JOURNAL_NOT_BALANCED%' then
    raise exception 'POSTING REGRESSION: journal posting can bypass balance validation';
  end if;
end;
$test$;

-- Posting remains admin-only until a dedicated accounting operator permission is introduced.
do $test$
declare
  v_materialize text;
  v_approve text;
  v_post text;
begin
  select pg_get_functiondef('public.materialize_accounting_document_from_intake(uuid)'::regprocedure) into v_materialize;
  select pg_get_functiondef('public.approve_accounting_journal(uuid)'::regprocedure) into v_approve;
  select pg_get_functiondef('public.post_accounting_journal(uuid)'::regprocedure) into v_post;

  if v_materialize not ilike '%current_app_role() <> ''admin''%'
     or v_approve not ilike '%current_app_role() <> ''admin''%'
     or v_post not ilike '%current_app_role() <> ''admin''%' then
    raise exception 'POSTING REGRESSION: accounting mutation boundary is not admin-gated';
  end if;
end;
$test$;

-- Reporting views may only consume posted entries.
do $test$
declare
  v_view text;
begin
  select pg_get_viewdef('public.entity_profit_and_loss'::regclass, true) into v_view;
  if v_view not ilike '%status = ''posted''%' then
    raise exception 'POSTING REGRESSION: P&L can consume unposted journals';
  end if;

  select pg_get_viewdef('public.entity_balance_sheet'::regclass, true) into v_view;
  if v_view not ilike '%status = ''posted''%' then
    raise exception 'POSTING REGRESSION: balance sheet can consume unposted journals';
  end if;

  select pg_get_viewdef('public.entity_cash_flow'::regclass, true) into v_view;
  if v_view not ilike '%status = ''posted''%' then
    raise exception 'POSTING REGRESSION: cash flow can consume unposted journals';
  end if;
end;
$test$;

rollback;

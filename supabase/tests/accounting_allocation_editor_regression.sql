-- Black Swan OS accounting allocation editor regression gate.
-- Read-only assertions; rollback keeps the test non-destructive.

begin;

do $test$
declare
  v_replace text;
  v_create text;
begin
  select pg_get_functiondef('public.replace_accounting_document_allocations(uuid,jsonb)'::regprocedure)
  into v_replace;

  if v_replace not like '%current_app_role() <> ''admin''%' then
    raise exception 'ALLOCATION REGRESSION: allocation replacement is not admin-only';
  end if;

  if v_replace not like '%v_document.status <> ''approved''%' then
    raise exception 'ALLOCATION REGRESSION: non-approved documents remain editable';
  end if;

  if v_replace not like '%ACCOUNTING_ALLOCATIONS_NOT_RECONCILED%' then
    raise exception 'ALLOCATION REGRESSION: exact document-total reconciliation is not enforced';
  end if;

  if v_replace not like '%d.legal_entity_id = v_document.legal_entity_id%' then
    raise exception 'ALLOCATION REGRESSION: department entity ownership is not enforced';
  end if;

  if v_replace not like '%a.legal_entity_id = v_document.legal_entity_id%' then
    raise exception 'ALLOCATION REGRESSION: cost-center entity ownership is not enforced';
  end if;

  select pg_get_functiondef('public.create_draft_journal_for_document(uuid)'::regprocedure)
  into v_create;

  if v_create not like '%validate_accounting_document_allocations%' then
    raise exception 'ALLOCATION REGRESSION: journal creation does not validate allocations';
  end if;

  if v_create not like '%is_reconciled%' then
    raise exception 'ALLOCATION REGRESSION: journal creation does not require reconciled allocations';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon', 'public.replace_accounting_document_allocations(uuid,jsonb)', 'EXECUTE') then
    raise exception 'ALLOCATION REGRESSION: anon can replace document allocations';
  end if;
end;
$test$;

rollback;

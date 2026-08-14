-- Black Swan OS bank reconciliation review regression gate.
-- Read-only assertions; rollback keeps the test non-destructive.

begin;

do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.review_reconciliation_match(uuid,text,text)'::regprocedure)
  into v_definition;

  if v_definition not like '%current_app_role() <> ''admin''%' then
    raise exception 'RECONCILIATION REVIEW REGRESSION: review is not admin-only';
  end if;
  if v_definition not like '%v_match.status <> ''proposed''%' then
    raise exception 'RECONCILIATION REVIEW REGRESSION: already-reviewed matches are not immutable';
  end if;
  if v_definition not like '%RECONCILIATION_EXCEEDS_CASH_AMOUNT%' then
    raise exception 'RECONCILIATION REVIEW REGRESSION: cash overmatch protection missing';
  end if;
  if v_definition not like '%RECONCILIATION_EXCEEDS_DOCUMENT_AMOUNT%' then
    raise exception 'RECONCILIATION REVIEW REGRESSION: document overmatch protection missing';
  end if;
  if v_definition not like '%RECONCILIATION_ENTITY_MISMATCH%' then
    raise exception 'RECONCILIATION REVIEW REGRESSION: entity integrity protection missing';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon', 'public.review_reconciliation_match(uuid,text,text)', 'EXECUTE') then
    raise exception 'RECONCILIATION REVIEW REGRESSION: anon can review matches';
  end if;
end;
$test$;

rollback;

-- Black Swan OS bank ingestion/reconciliation regression gate.
begin;

do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.ingest_bank_transaction(uuid,uuid,text,date,text,numeric,text,text,text,uuid,jsonb,timestamptz,date,text)'::regprocedure)
  into v_definition;
  if v_definition not like '%current_app_role() <> ''admin''%' then
    raise exception 'BANK REGRESSION: bank ingestion is not admin-only';
  end if;
  if v_definition not like '%BANK_ACCOUNT_ENTITY_MISMATCH%' then
    raise exception 'BANK REGRESSION: bank-account legal entity ownership is not enforced';
  end if;

  select pg_get_functiondef('public.propose_reconciliation_matches(uuid)'::regprocedure)
  into v_definition;
  if v_definition like '%status, proposed_by%''approved''%' then
    raise exception 'BANK REGRESSION: reconciliation proposals appear to auto-approve';
  end if;
  if v_definition not like '%''proposed''%' then
    raise exception 'BANK REGRESSION: reconciliation proposal status is missing';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon', 'public.ingest_bank_transaction(uuid,uuid,text,date,text,numeric,text,text,text,uuid,jsonb,timestamptz,date,text)', 'EXECUTE') then
    raise exception 'BANK REGRESSION: anon can ingest bank transactions';
  end if;
  if has_function_privilege('anon', 'public.ingest_bank_balance_snapshot(uuid,text,numeric,text,timestamptz,jsonb)', 'EXECUTE') then
    raise exception 'BANK REGRESSION: anon can ingest bank balances';
  end if;
  if has_function_privilege('anon', 'public.propose_reconciliation_matches(uuid)', 'EXECUTE') then
    raise exception 'BANK REGRESSION: anon can create reconciliation proposals';
  end if;
end;
$test$;

rollback;

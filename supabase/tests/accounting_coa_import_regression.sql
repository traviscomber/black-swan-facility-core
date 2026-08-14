-- Black Swan OS Chart of Accounts import regression gate.
-- Read-only assertions; rollback keeps the gate non-destructive.

begin;

do $test$
declare
  v_validate text;
  v_apply text;
begin
  select pg_get_functiondef('public.validate_coa_import_batch(uuid)'::regprocedure) into v_validate;
  select pg_get_functiondef('public.apply_coa_import_batch(uuid)'::regprocedure) into v_apply;

  if v_validate not like '%current_app_role() <> ''admin''%' then
    raise exception 'COA IMPORT REGRESSION: validation is not admin-only';
  end if;
  if v_apply not like '%v_batch.status <> ''approved''%' then
    raise exception 'COA IMPORT REGRESSION: apply does not require approved batch';
  end if;
  if v_apply not like '%on conflict (legal_entity_id, account_code) do update%' then
    raise exception 'COA IMPORT REGRESSION: canonical upsert key is not entity + account code';
  end if;
  if v_apply not like '%source_reference = excluded.source_reference%' then
    raise exception 'COA IMPORT REGRESSION: canonical account source provenance is not preserved';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon', 'public.validate_coa_import_batch(uuid)', 'EXECUTE') then
    raise exception 'COA IMPORT REGRESSION: anon can validate imports';
  end if;
  if has_function_privilege('anon', 'public.review_coa_import_batch(uuid,text,text)', 'EXECUTE') then
    raise exception 'COA IMPORT REGRESSION: anon can approve imports';
  end if;
  if has_function_privilege('anon', 'public.apply_coa_import_batch(uuid)', 'EXECUTE') then
    raise exception 'COA IMPORT REGRESSION: anon can apply canonical accounts';
  end if;
end;
$test$;

rollback;

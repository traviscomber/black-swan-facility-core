-- Black Swan OS OCR reference catalog regression gate.
-- Read-only assertions; run after OCR reference catalog migration in development.

begin;

do $test$
declare
  v_body text;
begin
  select pg_get_functiondef(p.oid)
    into v_body
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ocr_get_reference_catalog'
  order by p.oid desc
  limit 1;

  if v_body is null then
    raise exception 'OCR REFERENCE REGRESSION: catalog RPC missing';
  end if;

  if v_body not ilike '%require_machine_scope(''ocr:reference'')%' then
    raise exception 'OCR REFERENCE REGRESSION: catalog is not protected by ocr:reference scope';
  end if;

  if v_body ilike '%employees%'
     or v_body ilike '%employee_employments%'
     or v_body ilike '%payments%'
     or v_body ilike '%cash_transactions%'
     or v_body ilike '%accounting_documents%'
     or v_body ilike '%bank_accounts%'
     or v_body ilike '%members%' then
    raise exception 'OCR REFERENCE REGRESSION: catalog exposes operational, financial, HR, or member records';
  end if;

  if v_body not ilike '%legal_entities%'
     or v_body not ilike '%entity_departments%'
     or v_body not ilike '%cost_centers%'
     or v_body not ilike '%accounting_counterparties%' then
    raise exception 'OCR REFERENCE REGRESSION: required canonical reference sources missing';
  end if;
end;
$test$;

-- The app's authenticated role must not receive machine catalog execution.
do $test$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='ocr_get_reference_catalog'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception 'OCR REFERENCE REGRESSION: authenticated app role can execute machine catalog';
  end if;
end;
$test$;

rollback;

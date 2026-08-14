-- Human accounting review regression gate. Run after accounting intake + review migrations.
begin;

do $test$
begin
  if to_regclass('public.accounting_intake_reviews') is null then
    raise exception 'REVIEW REGRESSION: accounting_intake_reviews missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='review_accounting_intake'
  ) then
    raise exception 'REVIEW REGRESSION: review_accounting_intake missing';
  end if;

  if has_function_privilege('anon', 'public.review_accounting_intake(uuid,text,jsonb,text)', 'EXECUTE') then
    raise exception 'REVIEW REGRESSION: anon can execute review_accounting_intake';
  end if;

  if not has_function_privilege('authenticated', 'public.review_accounting_intake(uuid,text,jsonb,text)', 'EXECUTE') then
    raise exception 'REVIEW REGRESSION: authenticated cannot execute review_accounting_intake';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='accounting_intake_reviews' and c.relrowsecurity
  ) then
    raise exception 'REVIEW REGRESSION: RLS disabled on accounting_intake_reviews';
  end if;
end;
$test$;

-- Review approval must not create canonical postings as a side effect.
do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='review_accounting_intake'
  limit 1;

  if v_definition ilike '%insert into public.journal_entries%'
     or v_definition ilike '%insert into public.accounting_documents%'
     or v_definition ilike '%cash_transactions%reconciled%'
  then
    raise exception 'REVIEW REGRESSION: human review function performs canonical posting/reconciliation';
  end if;
end;
$test$;

rollback;

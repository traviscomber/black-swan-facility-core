-- Regression gate for TUU Remote Payment integration.
do $gate$
begin
  if to_regclass('public.tuu_remote_payment_requests') is null then
    raise exception 'TUU payment table missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.tuu_remote_payment_requests'::regclass
      and conname='tuu_remote_amount_check'
  ) then raise exception 'TUU amount constraint missing'; end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='tuu_remote_payment_requests'
      and indexdef ilike '%idempotency_key%'
  ) then raise exception 'TUU idempotency uniqueness missing'; end if;

  if has_function_privilege('anon','public.prepare_tuu_remote_payment(uuid,integer,integer,integer,text)','EXECUTE') then
    raise exception 'Anon must not create TUU charges';
  end if;
  if has_function_privilege('anon','public.record_tuu_remote_payment_result(uuid,text,integer,text,text,jsonb,text)','EXECUTE') then
    raise exception 'Anon must not update TUU payment results';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tuu_remote_payment_requests'
      and column_name in ('api_key','api_secret','device_secret','merchant_secret')
  ) then raise exception 'TUU provider secrets must not be stored in Postgres'; end if;
end;
$gate$;

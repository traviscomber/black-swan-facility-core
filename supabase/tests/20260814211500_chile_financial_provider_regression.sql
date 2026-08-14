-- Read-only regression gate for Chile financial provider architecture.
do $$
declare
  v_count integer;
  v_public_execute integer;
  v_anon_execute integer;
begin
  select count(*) into v_count
  from public.financial_provider_catalog
  where provider_key in ('fintoc','khipu','transbank','stripe');
  if v_count <> 4 then
    raise exception 'Expected four canonical financial providers, found %', v_count;
  end if;

  if not exists (
    select 1 from public.financial_provider_catalog
    where provider_key = 'fintoc' and chile_native and supports_bank_movements and supports_balances and supports_payment_initiation
  ) then
    raise exception 'Fintoc Chile capabilities changed unexpectedly';
  end if;

  if not exists (
    select 1 from public.financial_provider_catalog
    where provider_key = 'khipu' and chile_native and supports_payment_initiation and supports_webhooks
  ) then
    raise exception 'Khipu Chile capabilities changed unexpectedly';
  end if;

  if not exists (
    select 1 from public.financial_provider_catalog
    where provider_key = 'stripe' and not chile_native and status = 'optional'
  ) then
    raise exception 'Stripe must remain optional/non-Chile-native unless explicitly revalidated';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bank_connections' and column_name = 'webhook_status'
  ) then
    raise exception 'bank_connections.webhook_status missing';
  end if;

  select count(*) into v_public_execute
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'record_verified_bank_provider_event'
    and grantee = 'PUBLIC'
    and privilege_type = 'EXECUTE';
  if v_public_execute <> 0 then
    raise exception 'Public execute must not exist on record_verified_bank_provider_event';
  end if;

  -- anon execution is intentional, but the function must enforce a hashed machine token.
  select count(*) into v_anon_execute
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'record_verified_bank_provider_event'
    and grantee = 'anon'
    and privilege_type = 'EXECUTE';
  if v_anon_execute = 0 then
    raise exception 'anon execute missing for restricted webhook machine RPC';
  end if;

  if position('digest(p_machine_token' in lower(pg_get_functiondef('public.record_verified_bank_provider_event(text,uuid,text,text,text,jsonb)'::regprocedure))) = 0 then
    raise exception 'Webhook machine RPC no longer validates token hash';
  end if;
end $$;

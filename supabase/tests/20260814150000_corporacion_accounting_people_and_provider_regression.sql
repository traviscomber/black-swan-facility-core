-- Read-only regression gate for Corporacion accounting, People Graph, Orchard & Kitchen and event providers.
do $$
begin
  if not exists (
    select 1 from public.entity_departments d
    join public.legal_entities e on e.id=d.legal_entity_id
    where e.code='BS_CORPORACION' and d.code='ORCHARD_KITCHEN' and d.is_active
  ) then
    raise exception 'Missing Corporacion Orchard & Kitchen department';
  end if;

  if to_regclass('public.event_service_provider_profiles') is null
     or to_regclass('public.event_service_provider_engagements') is null then
    raise exception 'Missing event service-provider inventory';
  end if;

  if to_regclass('public.entity_chart_of_accounts') is null
     or to_regclass('public.accounting_journal_entries') is null
     or to_regclass('public.accounting_journal_lines') is null then
    raise exception 'Missing entity accounting ledger foundation';
  end if;

  if to_regclass('public.bank_connections') is null
     or to_regclass('public.bank_accounts') is null
     or to_regclass('public.bank_balance_snapshots') is null then
    raise exception 'Missing bank API/status foundation';
  end if;

  if exists (select 1 from public.entity_chart_of_accounts) then
    raise exception 'Chart of accounts must not be fabricated before canonical accountant import';
  end if;

  if exists (select 1 from public.bank_balance_snapshots) then
    raise exception 'Bank balances must not be fabricated before verified bank/API import';
  end if;

  if to_regclass('public.corporacion_operating_responsibilities') is null then
    raise exception 'Missing Corporacion operating responsibilities';
  end if;

  if exists (
    select 1 from public.corporacion_operating_responsibilities
    where employee_id is null and source_reference is not null
  ) then
    raise exception 'Named operating responsibility cannot be treated as canonical without employee match';
  end if;
end $$;

select 'corporacion_accounting_people_provider_regression_ok' as result;
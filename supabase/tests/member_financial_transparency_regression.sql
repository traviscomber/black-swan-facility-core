-- Black Swan OS member financial transparency regression gate.
-- Read-only assertions; rollback keeps this test non-destructive.

begin;

do $test$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.can_view_financial_report(uuid)'::regprocedure)
  into v_definition;

  if v_definition not like '%BS_INFRA%' or v_definition not like '%BS_CORPORACION%' then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: member-visible entities are missing';
  end if;

  if v_definition like '%AGRICOLA%' or v_definition like '%BLUE_MARBLE%' then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: private entities leaked into member access';
  end if;

  if v_definition not like '%member_auth_links%' then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: member access is not explicitly auth-linked';
  end if;

  select pg_get_functiondef('public.get_entity_financial_report(uuid,text,date,date)'::regprocedure)
  into v_definition;

  if v_definition not like '%can_view_financial_report(p_legal_entity_id)%' then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: report RPC bypasses canonical access check';
  end if;

  if v_definition not like '%je.status = ''posted''%' then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: reports can include unposted journal data';
  end if;

  if v_definition not like '%bbs.balance_type%' or v_definition not like '%bank_balance_snapshots%' then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: cash status is not sourced from verified bank snapshots';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon', 'public.get_entity_financial_report(uuid,text,date,date)', 'EXECUTE') then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: anon can execute financial reports';
  end if;

  if has_function_privilege('anon', 'public.list_financial_report_entities()', 'EXECUTE') then
    raise exception 'FINANCE TRANSPARENCY REGRESSION: anon can list report entities';
  end if;
end;
$test$;

rollback;

-- Black Swan OS member HR transparency regression gate.
-- Read-only assertions; rollback keeps the test non-destructive.

begin;

do $test$
declare
  v_access text;
  v_report text;
begin
  select pg_get_functiondef('public.can_view_hr_transparency(uuid)'::regprocedure) into v_access;
  select pg_get_functiondef('public.get_entity_hr_transparency(uuid)'::regprocedure) into v_report;

  if v_access not like '%BS_INFRA%' or v_access not like '%BS_CORPORACION%' then
    raise exception 'HR TRANSPARENCY REGRESSION: member-visible entities missing';
  end if;
  if v_access like '%AGRICOLA''%' or v_access like '%BLUE_MARBLE''%' then
    raise exception 'HR TRANSPARENCY REGRESSION: private entities entered member policy';
  end if;
  if v_access not like '%member_auth_links%' then
    raise exception 'HR TRANSPARENCY REGRESSION: member access is not tied to explicit auth link';
  end if;
  if v_report like '%e.email%' or v_report like '%e.phone%' then
    raise exception 'HR TRANSPARENCY REGRESSION: direct contact fields leaked into curated HR report';
  end if;
  if v_report like '%salary%' or v_report like '%payroll%' then
    raise exception 'HR TRANSPARENCY REGRESSION: sensitive compensation/payroll references entered report query';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon', 'public.get_entity_hr_transparency(uuid)', 'EXECUTE') then
    raise exception 'HR TRANSPARENCY REGRESSION: anon can read HR transparency';
  end if;
end;
$test$;

rollback;

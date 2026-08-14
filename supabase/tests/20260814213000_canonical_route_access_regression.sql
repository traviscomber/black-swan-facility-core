-- Read-only regression gate for canonical route authorization.
-- Run after migrations in a non-production validation database.

do $test$
declare
  v_def text;
  v_public_exec boolean;
  v_anon_exec boolean;
begin
  select pg_get_functiondef('public.get_current_route_access()'::regprocedure)
  into v_def;

  if v_def is null or position('current_app_role' in v_def) = 0 then
    raise exception 'ROUTE_ACCESS_REGRESSION: get_current_route_access must derive from current_app_role()';
  end if;

  select has_function_privilege('public', 'public.get_current_route_access()', 'EXECUTE')
  into v_public_exec;
  if v_public_exec then
    raise exception 'ROUTE_ACCESS_REGRESSION: public must not execute get_current_route_access()';
  end if;

  select has_function_privilege('anon', 'public.get_current_route_access()', 'EXECUTE')
  into v_anon_exec;
  if v_anon_exec then
    raise exception 'ROUTE_ACCESS_REGRESSION: anon must not execute get_current_route_access()';
  end if;
end;
$test$;

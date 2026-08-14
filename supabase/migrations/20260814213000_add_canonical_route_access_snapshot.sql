-- Black Swan OS: canonical route-access snapshot for server-side routing.
-- Keeps Next.js proxy decisions aligned with current_app_role() instead of JWT claims.

create or replace function public.get_current_route_access()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_role := public.current_app_role();

  return jsonb_build_object(
    'role_key', v_role,
    'is_admin', v_role = 'admin',
    'can_approve_procurement', v_role in ('admin','approver')
  );
end;
$function$;

revoke all on function public.get_current_route_access() from public;
grant execute on function public.get_current_route_access() to authenticated;

comment on function public.get_current_route_access() is
  'Canonical authenticated route-access snapshot derived from current_app_role(); do not derive routing authority from JWT app_metadata claims.';

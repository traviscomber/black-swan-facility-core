-- Black Swan OS: nested authorization helpers are not client RPC APIs.
-- They remain callable by trusted backend/service-role paths and by SECURITY DEFINER
-- owner execution inside their canonical business RPC callers.

revoke all on function public.can_access_orchard_allocation(uuid) from public, anon, authenticated;
revoke all on function public.can_finance_admin() from public, anon, authenticated;

grant execute on function public.can_access_orchard_allocation(uuid) to service_role;
grant execute on function public.can_finance_admin() to service_role;

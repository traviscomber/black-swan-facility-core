-- Black Swan OS: internal navigation RPCs require an authenticated caller.
--
-- The functions already fail closed when auth.uid() is null. These grants
-- remove the unnecessary anonymous API surface without changing behavior or data.

revoke all on function public.get_black_swan_os_navigation() from public, anon;
revoke all on function public.get_current_route_access() from public, anon;

grant execute on function public.get_black_swan_os_navigation() to authenticated, service_role;
grant execute on function public.get_current_route_access() to authenticated, service_role;

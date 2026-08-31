-- Black Swan OS: guest-presence authorization helpers are internal only.
-- They are not client RPC APIs. Keep service-role execution for trusted backend
-- operations while removing the unnecessary authenticated PostgREST surface.

revoke all on function public.can_guest_enter(uuid, timestamp with time zone) from public, anon, authenticated;
revoke all on function public.is_member_on_ground(uuid, timestamp with time zone) from public, anon, authenticated;

grant execute on function public.can_guest_enter(uuid, timestamp with time zone) to service_role;
grant execute on function public.is_member_on_ground(uuid, timestamp with time zone) to service_role;

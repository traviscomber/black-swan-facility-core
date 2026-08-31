-- Black Swan OS: make the public guest portal a narrow capability surface.
-- Guest access remains intentional through token/passcode-protected SECURITY DEFINER RPCs.
-- Direct anonymous table privileges are unnecessary because all guest data access flows through those RPCs.

revoke all on table public.event_guest_portals from anon;
revoke all on table public.event_portal_invites from anon;
revoke all on table public.event_portal_registrations from anon;
revoke all on table public.discovery_intents from anon;
revoke all on table public.discovery_opportunities from anon;

-- Remove implicit PUBLIC execution, then explicitly preserve only the intended callers.
revoke all on function public.resolve_event_guest_portal(text, text) from public;
revoke all on function public.register_event_portal_guest(text, text, text, text, text, text, text, text, jsonb, boolean, boolean) from public;
revoke all on function public.start_guest_event_discovery_session(text, text, uuid, text) from public;
revoke all on function public.get_guest_discovery_workspace(text) from public;
revoke all on function public.create_guest_event_discovery_intent(text, text, text, text, text) from public;
revoke all on function public.respond_guest_discovery_opportunity(text, uuid, text) from public;

grant execute on function public.resolve_event_guest_portal(text, text) to anon, authenticated, service_role;
grant execute on function public.register_event_portal_guest(text, text, text, text, text, text, text, text, jsonb, boolean, boolean) to anon, authenticated, service_role;
grant execute on function public.start_guest_event_discovery_session(text, text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.get_guest_discovery_workspace(text) to anon, authenticated, service_role;
grant execute on function public.create_guest_event_discovery_intent(text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.respond_guest_discovery_opportunity(text, uuid, text) to anon, authenticated, service_role;

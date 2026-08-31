-- Orchard lifecycle synchronization is an internal trigger/helper operation.
-- The SECURITY DEFINER trigger executes it with owner privileges; end users must
-- not invoke it directly to force canonical lifecycle transitions or audit rows.

revoke all on function public.orchard_sync_succession_lifecycle(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.orchard_sync_succession_lifecycle(uuid, text, text)
  to service_role;

-- Minimal staff directory for Booking handovers.
-- Does not expose employee email or broader People data to operators.

create or replace function public.get_booking_handover_staff()
returns table(id uuid, name text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('booking.modify') then raise exception 'Booking permission required'; end if;

  return query
  select e.id, e.name
  from public.employees e
  where e.is_active is distinct from false
  order by e.name;
end;
$function$;

revoke all on function public.get_booking_handover_staff() from public, anon;
grant execute on function public.get_booking_handover_staff() to authenticated, service_role;

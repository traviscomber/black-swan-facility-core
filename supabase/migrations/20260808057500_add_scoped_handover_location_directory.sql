-- Return only Booking locations the current user can operate.
create or replace function public.get_booking_handover_locations()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select l.id, l.name
  from public.locations l
  where auth.uid() is not null
    and public.can_app_action('booking.modify')
    and public.can_access_operational_scope('booking', l.id)
  order by l.name;
$function$;

revoke all on function public.get_booking_handover_locations() from public, anon;
grant execute on function public.get_booking_handover_locations() to authenticated, service_role;

-- Canonical reservation state transitions used by the primary Hospitality operations UI.
-- Side effects remain owned by existing reservation triggers (audit, booking events,
-- financial close, room state and housekeeping lifecycle).

create or replace function public.transition_reservation_status(
  p_reservation_id uuid,
  p_action text
)
returns public.reservations
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_reservation public.reservations%rowtype;
  v_next_status text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_app_action('booking.modify') then
    raise exception 'Booking modification permission required';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if not public.can_access_operational_scope('booking', v_reservation.location_id) then
    raise exception 'Reservation outside operational scope';
  end if;

  if p_action = 'confirm' then
    if v_reservation.status <> 'pending' then
      raise exception 'Only pending reservations can be confirmed';
    end if;
    v_next_status := 'confirmed';
  elsif p_action = 'checkout' then
    if v_reservation.status not in ('checked_in','checked-in') then
      raise exception 'Only checked-in reservations can be checked out';
    end if;
    v_next_status := 'checked_out';
  else
    raise exception 'Unsupported reservation transition';
  end if;

  update public.reservations
  set status = v_next_status,
      arrival_status = case
        when p_action = 'checkout' then 'checked_out'
        else arrival_status
      end,
      updated_at = now()
  where id = p_reservation_id
  returning * into v_reservation;

  return v_reservation;
end;
$function$;

revoke all on function public.transition_reservation_status(uuid,text) from public, anon;
grant execute on function public.transition_reservation_status(uuid,text) to authenticated, service_role;

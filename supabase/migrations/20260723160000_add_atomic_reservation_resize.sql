create or replace function public.resize_booking_reservation(
  p_reservation_id uuid,
  p_check_in date,
  p_check_out date
)
returns table (
  success boolean,
  message text,
  check_in date,
  check_out date
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_room_id uuid;
  v_location_id uuid;
begin
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    return query select false, 'Check-out must be after check-in', p_check_in, p_check_out;
    return;
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    return query select false, 'Reservation not found', p_check_in, p_check_out;
    return;
  end if;

  v_room_id := public.reservation_scope_room_id(v_reservation.bed_id, v_reservation.room_id);

  select coalesce(v_reservation.location_id, r.location_id)
  into v_location_id
  from public.rooms r
  where r.id = v_room_id;

  if not public.is_booking_inventory_available(
    v_reservation.bed_id,
    v_room_id,
    v_location_id,
    p_check_in,
    p_check_out,
    p_reservation_id
  ) then
    return query select false, 'Inventory is not available for the requested dates', v_reservation.check_in, v_reservation.check_out;
    return;
  end if;

  update public.reservations
  set
    check_in = p_check_in,
    check_out = p_check_out,
    updated_at = now()
  where id = p_reservation_id;

  return query select true, 'Reservation dates updated', p_check_in, p_check_out;
end;
$$;

grant execute on function public.resize_booking_reservation(uuid, date, date) to authenticated;
grant execute on function public.resize_booking_reservation(uuid, date, date) to service_role;

comment on function public.resize_booking_reservation(uuid, date, date) is
'Atomically validates booking inventory and updates reservation check-in/check-out dates.';

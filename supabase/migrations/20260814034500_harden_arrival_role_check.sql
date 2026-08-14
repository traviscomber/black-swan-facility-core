-- Black Swan OS Phase 1: canonical arrival authorization
-- Replace the last direct JWT role read in the simple arrival/check-in path.

create or replace function public.check_in_or_queue(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reservation public.reservations%rowtype;
  v_room public.rooms%rowtype;
  v_role text := public.current_app_role();
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para registrar llegadas';
  end if;

  select * into v_reservation
  from public.reservations
  where id=p_reservation_id
  for update;
  if not found then raise exception 'Reserva no encontrada'; end if;

  if auth.role() <> 'service_role'
     and not public.can_access_operational_scope('booking',v_reservation.location_id) then
    raise exception 'Reserva fuera de su alcance operacional';
  end if;
  if v_reservation.room_id is null then raise exception 'La reserva no tiene habitación asignada'; end if;

  select * into v_room from public.rooms where id=v_reservation.room_id for update;
  if not found then raise exception 'Habitación no encontrada'; end if;

  if v_room.operational_status in ('ready','inspected') then
    update public.reservations
    set status='checked_in',arrival_status='checked_in',arrived_at=coalesce(arrived_at,now()),queued_at=null
    where id=p_reservation_id;
    update public.rooms set status='occupied',operational_status='occupied' where id=v_room.id;
    return jsonb_build_object('result','checked_in','room_status','occupied');
  end if;

  update public.reservations
  set arrival_status='waiting_for_room',arrived_at=coalesce(arrived_at,now()),queued_at=coalesce(queued_at,now())
  where id=p_reservation_id;
  return jsonb_build_object('result','waiting_for_room','room_status',v_room.operational_status);
end;
$function$;
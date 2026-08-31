-- Black Swan OS: fail closed before the booking drag convenience wrapper reads
-- reservation state under SECURITY DEFINER. The canonical change RPC repeats the
-- same checks, so this is defense in depth and removes reservation-existence probing.

create or replace function public.apply_or_queue_booking_drag(
  p_reservation_id uuid,
  p_target_bed_id uuid,
  p_check_in date,
  p_check_out date,
  p_reason text default 'Ajuste realizado desde el timeline operacional'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reservation public.reservations%rowtype;
  v_role text;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select role_key
    into v_role
  from public.user_access_profiles
  where user_id = auth.uid()
    and is_active = true;

  if v_role is null then
    raise exception 'No existe un perfil de acceso activo';
  end if;

  select allowed
    into v_allowed
  from public.booking_action_permissions
  where role_key = v_role
    and action_key = 'booking.modify';

  if coalesce(v_allowed, false) = false then
    raise exception 'No autorizado para modificar reservas';
  end if;

  select r.*
    into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and public.can_access_operational_scope('booking', r.location_id);

  if not found then
    raise exception 'Reserva no encontrada o fuera de alcance operacional';
  end if;

  return public.apply_or_queue_booking_change(
    p_reservation_id,
    p_target_bed_id,
    p_check_in,
    p_check_out,
    v_reservation.bed_id,
    v_reservation.check_in,
    v_reservation.check_out,
    p_reason
  );
end;
$function$;

revoke all on function public.apply_or_queue_booking_drag(uuid, uuid, date, date, text) from public, anon;
grant execute on function public.apply_or_queue_booking_drag(uuid, uuid, date, date, text) to authenticated, service_role;

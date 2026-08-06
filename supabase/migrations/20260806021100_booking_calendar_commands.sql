create or replace function public.perform_booking_calendar_change(
  p_reservation_id uuid,
  p_target_bed_id uuid,
  p_check_in date,
  p_check_out date,
  p_expected_bed_id uuid,
  p_expected_check_in date,
  p_expected_check_out date,
  p_actor_id uuid,
  p_actor_role text,
  p_reason text,
  p_source_type text,
  p_record_command boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reservation public.reservations%rowtype;
  v_after public.reservations%rowtype;
  v_result record;
  v_change_id uuid;
  v_undo_until timestamptz;
  v_action_type text;
  v_before jsonb;
  v_after_payload jsonb;
begin
  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  if v_reservation.bed_id is distinct from p_expected_bed_id
     or v_reservation.check_in is distinct from p_expected_check_in
     or v_reservation.check_out is distinct from p_expected_check_out then
    raise exception using
      errcode = '40001',
      message = 'La reserva cambió después de iniciar la acción. Actualice el calendario e inténtelo nuevamente.';
  end if;

  if public.booking_source_edit_policy(v_reservation.source) = 'external_read_only' then
    raise exception 'Reserva sincronizada con un canal externo. Modifique habitación o fechas en el canal de origen.';
  end if;

  if coalesce(v_reservation.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_reservation.arrival_status, 'not_arrived') not in ('not_arrived', 'expected') then
    raise exception using
      errcode = '40001',
      message = 'La estadía ya inició o cambió de estado y no puede modificarse desde el calendario.';
  end if;

  if p_target_bed_id is null or p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'El destino y las fechas propuestas no son válidos';
  end if;

  v_action_type := case
    when v_reservation.bed_id is distinct from p_target_bed_id then 'move'
    else 'resize'
  end;

  v_before := jsonb_build_object(
    'reservation_id', v_reservation.id,
    'bed_id', v_reservation.bed_id,
    'room_id', v_reservation.room_id,
    'location_id', v_reservation.location_id,
    'check_in', v_reservation.check_in,
    'check_out', v_reservation.check_out,
    'status', v_reservation.status,
    'arrival_status', v_reservation.arrival_status,
    'source', v_reservation.source
  );

  if v_action_type = 'move' then
    select * into v_result
    from public.move_booking_reservation(p_reservation_id, p_target_bed_id, p_check_in, p_check_out);
  else
    select * into v_result
    from public.resize_booking_reservation(p_reservation_id, p_check_in, p_check_out);
  end if;

  if coalesce(v_result.success, false) = false then
    raise exception '%', coalesce(v_result.message, 'No fue posible actualizar la reserva');
  end if;

  select * into v_after from public.reservations where id = p_reservation_id;
  v_after_payload := jsonb_build_object(
    'reservation_id', v_after.id,
    'bed_id', v_after.bed_id,
    'room_id', v_after.room_id,
    'location_id', v_after.location_id,
    'check_in', v_after.check_in,
    'check_out', v_after.check_out,
    'status', v_after.status,
    'arrival_status', v_after.arrival_status,
    'source', v_after.source
  );

  if p_record_command then
    v_undo_until := now() + interval '15 seconds';
    insert into public.booking_change_commands (
      action_type,
      primary_reservation_id,
      before_payload,
      after_payload,
      actor_id,
      actor_role,
      reason,
      source_type,
      undo_expires_at
    ) values (
      v_action_type,
      p_reservation_id,
      v_before,
      v_after_payload,
      p_actor_id,
      p_actor_role,
      nullif(trim(p_reason), ''),
      coalesce(nullif(trim(p_source_type), ''), 'booking_calendar'),
      v_undo_until
    ) returning id into v_change_id;
  end if;

  return jsonb_build_object(
    'result', 'applied',
    'message', coalesce(v_result.message, 'Reserva actualizada'),
    'reservation_id', p_reservation_id,
    'bed_id', v_after.bed_id,
    'check_in', v_after.check_in,
    'check_out', v_after.check_out,
    'change_id', v_change_id,
    'undo_until', v_undo_until
  );
end;
$function$;

create or replace function public.perform_booking_calendar_swap(
  p_reservation_a_id uuid,
  p_reservation_b_id uuid,
  p_expected_a jsonb,
  p_expected_b jsonb,
  p_actor_id uuid,
  p_actor_role text,
  p_reason text,
  p_source_type text,
  p_record_command boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_a public.reservations%rowtype;
  v_b public.reservations%rowtype;
  v_a_after public.reservations%rowtype;
  v_b_after public.reservations%rowtype;
  v_a_target_bed public.beds%rowtype;
  v_b_target_bed public.beds%rowtype;
  v_a_target_room public.rooms%rowtype;
  v_b_target_room public.rooms%rowtype;
  v_change_id uuid;
  v_undo_until timestamptz;
  v_before jsonb;
  v_after jsonb;
begin
  if p_reservation_a_id is null or p_reservation_b_id is null or p_reservation_a_id = p_reservation_b_id then
    raise exception 'El intercambio requiere dos reservas diferentes';
  end if;

  perform 1
  from public.reservations
  where id in (p_reservation_a_id, p_reservation_b_id)
  order by id
  for update;

  select * into v_a from public.reservations where id = p_reservation_a_id;
  select * into v_b from public.reservations where id = p_reservation_b_id;
  if v_a.id is null or v_b.id is null then
    raise exception 'No fue posible encontrar ambas reservas para el intercambio';
  end if;

  if v_a.bed_id is null or v_b.bed_id is null then
    raise exception 'Solo se pueden intercambiar reservas asignadas a camas específicas';
  end if;

  if v_a.bed_id is distinct from nullif(p_expected_a ->> 'bed_id', '')::uuid
     or v_a.check_in is distinct from nullif(p_expected_a ->> 'check_in', '')::date
     or v_a.check_out is distinct from nullif(p_expected_a ->> 'check_out', '')::date
     or v_b.bed_id is distinct from nullif(p_expected_b ->> 'bed_id', '')::uuid
     or v_b.check_in is distinct from nullif(p_expected_b ->> 'check_in', '')::date
     or v_b.check_out is distinct from nullif(p_expected_b ->> 'check_out', '')::date then
    raise exception using
      errcode = '40001',
      message = 'Una de las reservas cambió después de iniciar el intercambio. Actualice el calendario.';
  end if;

  if public.booking_source_edit_policy(v_a.source) = 'external_read_only'
     or public.booking_source_edit_policy(v_b.source) = 'external_read_only' then
    raise exception 'Una de las reservas proviene de un canal externo y no puede intercambiarse localmente';
  end if;

  if coalesce(v_a.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_b.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_a.arrival_status, 'not_arrived') not in ('not_arrived', 'expected')
     or coalesce(v_b.arrival_status, 'not_arrived') not in ('not_arrived', 'expected') then
    raise exception using
      errcode = '40001',
      message = 'Una de las estadías ya inició o cambió de estado. El intercambio fue anulado.';
  end if;

  select * into v_a_target_bed from public.beds where id = v_b.bed_id and is_available = true;
  select * into v_b_target_bed from public.beds where id = v_a.bed_id and is_available = true;
  if v_a_target_bed.id is null or v_b_target_bed.id is null then
    raise exception 'Una de las camas del intercambio está deshabilitada';
  end if;

  select * into v_a_target_room from public.rooms where id = v_a_target_bed.room_id;
  select * into v_b_target_room from public.rooms where id = v_b_target_bed.room_id;
  if v_a_target_room.operational_status in ('out_of_service', 'out_of_inventory')
     or v_b_target_room.operational_status in ('out_of_service', 'out_of_inventory') then
    raise exception 'Una de las habitaciones del intercambio no está disponible';
  end if;

  perform set_config(
    'app.booking_swap_ids',
    p_reservation_a_id::text || ',' || p_reservation_b_id::text,
    true
  );

  if not public.is_booking_inventory_available(
    v_a_target_bed.id,
    v_a_target_room.id,
    v_a_target_room.location_id,
    v_a.check_in,
    v_a.check_out,
    v_a.id
  ) then
    raise exception 'El destino de la primera reserva tiene un conflicto adicional';
  end if;

  if not public.is_booking_inventory_available(
    v_b_target_bed.id,
    v_b_target_room.id,
    v_b_target_room.location_id,
    v_b.check_in,
    v_b.check_out,
    v_b.id
  ) then
    raise exception 'El destino de la segunda reserva tiene un conflicto adicional';
  end if;

  v_before := jsonb_build_object(
    'a', jsonb_build_object(
      'reservation_id', v_a.id,
      'bed_id', v_a.bed_id,
      'room_id', v_a.room_id,
      'location_id', v_a.location_id,
      'check_in', v_a.check_in,
      'check_out', v_a.check_out,
      'status', v_a.status,
      'arrival_status', v_a.arrival_status,
      'source', v_a.source
    ),
    'b', jsonb_build_object(
      'reservation_id', v_b.id,
      'bed_id', v_b.bed_id,
      'room_id', v_b.room_id,
      'location_id', v_b.location_id,
      'check_in', v_b.check_in,
      'check_out', v_b.check_out,
      'status', v_b.status,
      'arrival_status', v_b.arrival_status,
      'source', v_b.source
    )
  );

  update public.reservations
  set bed_id = v_a_target_bed.id,
      room_id = v_a_target_room.id,
      location_id = v_a_target_room.location_id,
      booking_type = 'BED',
      updated_at = now()
  where id = v_a.id;

  update public.reservations
  set bed_id = v_b_target_bed.id,
      room_id = v_b_target_room.id,
      location_id = v_b_target_room.location_id,
      booking_type = 'BED',
      updated_at = now()
  where id = v_b.id;

  select * into v_a_after from public.reservations where id = v_a.id;
  select * into v_b_after from public.reservations where id = v_b.id;

  v_after := jsonb_build_object(
    'a', jsonb_build_object(
      'reservation_id', v_a_after.id,
      'bed_id', v_a_after.bed_id,
      'room_id', v_a_after.room_id,
      'location_id', v_a_after.location_id,
      'check_in', v_a_after.check_in,
      'check_out', v_a_after.check_out,
      'status', v_a_after.status,
      'arrival_status', v_a_after.arrival_status,
      'source', v_a_after.source
    ),
    'b', jsonb_build_object(
      'reservation_id', v_b_after.id,
      'bed_id', v_b_after.bed_id,
      'room_id', v_b_after.room_id,
      'location_id', v_b_after.location_id,
      'check_in', v_b_after.check_in,
      'check_out', v_b_after.check_out,
      'status', v_b_after.status,
      'arrival_status', v_b_after.arrival_status,
      'source', v_b_after.source
    )
  );

  if p_record_command then
    v_undo_until := now() + interval '15 seconds';
    insert into public.booking_change_commands (
      action_type,
      primary_reservation_id,
      secondary_reservation_id,
      before_payload,
      after_payload,
      actor_id,
      actor_role,
      reason,
      source_type,
      undo_expires_at
    ) values (
      'swap',
      v_a.id,
      v_b.id,
      v_before,
      v_after,
      p_actor_id,
      p_actor_role,
      nullif(trim(p_reason), ''),
      coalesce(nullif(trim(p_source_type), ''), 'booking_calendar'),
      v_undo_until
    ) returning id into v_change_id;
  end if;

  return jsonb_build_object(
    'result', 'applied',
    'message', 'Reservas intercambiadas correctamente',
    'reservation_id', v_a.id,
    'secondary_reservation_id', v_b.id,
    'change_id', v_change_id,
    'undo_until', v_undo_until
  );
end;
$function$;

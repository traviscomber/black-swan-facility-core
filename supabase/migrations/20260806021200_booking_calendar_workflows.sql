create or replace function public.apply_or_queue_booking_change(
  p_reservation_id uuid,
  p_target_bed_id uuid,
  p_check_in date,
  p_check_out date,
  p_expected_bed_id uuid,
  p_expected_check_in date,
  p_expected_check_out date,
  p_reason text default 'Ajuste realizado desde el timeline operacional'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_email text;
  v_allowed boolean;
  v_requires_approval boolean;
  v_requires_reason boolean;
  v_reservation public.reservations%rowtype;
  v_operation text;
  v_payload jsonb;
  v_request_id uuid;
  v_existing_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select role_key, email into v_role, v_email
  from public.user_access_profiles
  where user_id = auth.uid() and is_active = true;

  if v_role is null then raise exception 'No existe un perfil de acceso activo'; end if;

  select allowed, requires_approval, requires_reason
    into v_allowed, v_requires_approval, v_requires_reason
  from public.booking_action_permissions
  where role_key = v_role and action_key = 'booking.modify';

  if coalesce(v_allowed, false) = false then raise exception 'No autorizado para modificar reservas'; end if;
  if v_requires_reason and nullif(trim(p_reason), '') is null then
    raise exception 'Debe registrar un motivo para modificar la reserva';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'Reserva no encontrada'; end if;

  if v_reservation.bed_id is distinct from p_expected_bed_id
     or v_reservation.check_in is distinct from p_expected_check_in
     or v_reservation.check_out is distinct from p_expected_check_out then
    raise exception using
      errcode = '40001',
      message = 'La reserva cambió después de iniciar la acción. Actualice el calendario.';
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

  if not exists (
    select 1
    from public.beds bed
    join public.rooms room on room.id = bed.room_id
    where bed.id = p_target_bed_id
      and bed.is_available = true
      and room.operational_status not in ('out_of_service', 'out_of_inventory')
  ) then
    raise exception 'La cama o habitación seleccionada no está disponible';
  end if;

  if not public.is_booking_inventory_available(
    p_target_bed_id,
    null,
    null,
    p_check_in,
    p_check_out,
    p_reservation_id
  ) then
    raise exception 'El destino tiene un conflicto de inventario o un bloqueo operativo';
  end if;

  v_operation := case
    when v_reservation.bed_id is distinct from p_target_bed_id then 'move_room'
    else 'resize_stay'
  end;

  v_payload := jsonb_build_object(
    'operation', v_operation,
    'target_bed_id', p_target_bed_id,
    'check_in', p_check_in,
    'check_out', p_check_out,
    'previous_bed_id', v_reservation.bed_id,
    'previous_room_id', v_reservation.room_id,
    'previous_check_in', v_reservation.check_in,
    'previous_check_out', v_reservation.check_out,
    'source', v_reservation.source,
    'source_policy', public.booking_source_edit_policy(v_reservation.source)
  );

  if coalesce(v_requires_approval, false) then
    select id into v_existing_id
    from public.operational_approval_requests
    where status = 'pending'
      and action_key = 'booking.modify'
      and reservation_id = p_reservation_id
    order by created_at desc
    limit 1;

    if v_existing_id is not null then
      return jsonb_build_object(
        'result', 'queued',
        'request_id', v_existing_id,
        'message', 'Esta reserva ya tiene un cambio pendiente de aprobación'
      );
    end if;

    insert into public.operational_approval_requests (
      action_key, title, summary, source_type, source_id,
      reservation_id, room_id, requested_by, requested_by_name,
      priority, status, proposed_payload, reason
    ) values (
      'booking.modify',
      case when v_operation = 'move_room' then 'Cambiar habitación de ' else 'Cambiar fechas de ' end || v_reservation.guest_name,
      format(
        'Cambiar %s–%s a %s–%s. Destino %s.',
        v_reservation.check_in,
        v_reservation.check_out,
        p_check_in,
        p_check_out,
        p_target_bed_id
      ),
      'booking_timeline_native',
      p_reservation_id,
      p_reservation_id,
      v_reservation.room_id,
      auth.uid(),
      coalesce(v_email, 'Operación'),
      case when public.booking_source_edit_policy(v_reservation.source) = 'review' then 'high' else 'normal' end,
      'pending',
      v_payload,
      nullif(trim(p_reason), '')
    ) returning id into v_request_id;

    return jsonb_build_object(
      'result', 'queued',
      'request_id', v_request_id,
      'message', 'Cambio enviado a Santiago para aprobación'
    );
  end if;

  return public.perform_booking_calendar_change(
    p_reservation_id,
    p_target_bed_id,
    p_check_in,
    p_check_out,
    p_expected_bed_id,
    p_expected_check_in,
    p_expected_check_out,
    auth.uid(),
    v_role,
    p_reason,
    'booking_timeline_native',
    true
  );
end;
$function$;

create or replace function public.apply_or_queue_booking_drag(
  p_reservation_id uuid,
  p_target_bed_id uuid,
  p_check_in date,
  p_check_out date,
  p_reason text default 'Ajuste realizado desde el timeline operacional'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reservation public.reservations%rowtype;
begin
  select * into v_reservation from public.reservations where id = p_reservation_id;
  if not found then raise exception 'Reserva no encontrada'; end if;

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

create or replace function public.apply_or_queue_booking_swap(
  p_reservation_a_id uuid,
  p_reservation_b_id uuid,
  p_expected_a jsonb,
  p_expected_b jsonb,
  p_reason text default 'Intercambio controlado desde el timeline operacional'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_email text;
  v_allowed boolean;
  v_requires_approval boolean;
  v_requires_reason boolean;
  v_a public.reservations%rowtype;
  v_b public.reservations%rowtype;
  v_request_id uuid;
  v_existing_id uuid;
  v_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select role_key, email into v_role, v_email
  from public.user_access_profiles
  where user_id = auth.uid() and is_active = true;

  select allowed, requires_approval, requires_reason
    into v_allowed, v_requires_approval, v_requires_reason
  from public.booking_action_permissions
  where role_key = v_role and action_key = 'booking.modify';

  if coalesce(v_allowed, false) = false then raise exception 'No autorizado para modificar reservas'; end if;
  if v_requires_reason and nullif(trim(p_reason), '') is null then
    raise exception 'Debe registrar un motivo para intercambiar reservas';
  end if;

  perform 1
  from public.reservations
  where id in (p_reservation_a_id, p_reservation_b_id)
  order by id
  for update;

  select * into v_a from public.reservations where id = p_reservation_a_id;
  select * into v_b from public.reservations where id = p_reservation_b_id;
  if v_a.id is null or v_b.id is null then raise exception 'No fue posible encontrar ambas reservas'; end if;

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

  if v_a.bed_id is null or v_b.bed_id is null then
    raise exception 'Solo se pueden intercambiar reservas asignadas a camas específicas';
  end if;

  if coalesce(v_a.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_b.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_a.arrival_status, 'not_arrived') not in ('not_arrived', 'expected')
     or coalesce(v_b.arrival_status, 'not_arrived') not in ('not_arrived', 'expected') then
    raise exception using
      errcode = '40001',
      message = 'Una de las estadías ya inició o cambió de estado. El intercambio fue anulado.';
  end if;

  if public.booking_source_edit_policy(v_a.source) = 'external_read_only'
     or public.booking_source_edit_policy(v_b.source) = 'external_read_only' then
    raise exception 'Una de las reservas proviene de un canal externo y no puede intercambiarse localmente';
  end if;

  v_payload := jsonb_build_object(
    'operation', 'swap_reservations',
    'secondary_reservation_id', v_b.id,
    'expected_a', p_expected_a,
    'expected_b', p_expected_b,
    'source_policy_a', public.booking_source_edit_policy(v_a.source),
    'source_policy_b', public.booking_source_edit_policy(v_b.source)
  );

  if coalesce(v_requires_approval, false) then
    select id into v_existing_id
    from public.operational_approval_requests
    where status = 'pending'
      and action_key = 'booking.modify'
      and (
        reservation_id in (p_reservation_a_id, p_reservation_b_id)
        or proposed_payload ->> 'secondary_reservation_id' in (
          p_reservation_a_id::text,
          p_reservation_b_id::text
        )
      )
    order by created_at desc
    limit 1;

    if v_existing_id is not null then
      return jsonb_build_object(
        'result', 'queued',
        'request_id', v_existing_id,
        'message', 'Una de las reservas ya tiene un cambio pendiente de aprobación'
      );
    end if;

    insert into public.operational_approval_requests (
      action_key, title, summary, source_type, source_id,
      reservation_id, room_id, requested_by, requested_by_name,
      priority, status, proposed_payload, reason
    ) values (
      'booking.modify',
      'Intercambiar ' || v_a.guest_name || ' y ' || v_b.guest_name,
      format('Intercambiar las habitaciones asignadas a %s y %s, conservando sus fechas.', v_a.guest_name, v_b.guest_name),
      'booking_timeline_swap',
      v_a.id,
      v_a.id,
      v_a.room_id,
      auth.uid(),
      coalesce(v_email, 'Operación'),
      'high',
      'pending',
      v_payload,
      nullif(trim(p_reason), '')
    ) returning id into v_request_id;

    return jsonb_build_object(
      'result', 'queued',
      'request_id', v_request_id,
      'message', 'Intercambio enviado a Santiago para aprobación'
    );
  end if;

  return public.perform_booking_calendar_swap(
    p_reservation_a_id,
    p_reservation_b_id,
    p_expected_a,
    p_expected_b,
    auth.uid(),
    v_role,
    p_reason,
    'booking_timeline_native',
    true
  );
end;
$function$;

create or replace function public.undo_booking_change(p_change_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_command public.booking_change_commands%rowtype;
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role_key into v_role
  from public.user_access_profiles
  where user_id = auth.uid() and is_active = true;

  select * into v_command
  from public.booking_change_commands
  where id = p_change_id
  for update;

  if not found then raise exception 'Cambio no encontrado'; end if;
  if v_command.status <> 'applied' then raise exception 'Este cambio ya no puede deshacerse'; end if;
  if v_command.undo_expires_at is null or now() > v_command.undo_expires_at then
    raise exception 'El tiempo para deshacer este cambio expiró';
  end if;
  if v_command.actor_id is distinct from auth.uid() and v_role not in ('admin', 'approver') then
    raise exception 'No autorizado para deshacer este cambio';
  end if;

  v_before := v_command.before_payload;
  v_after := v_command.after_payload;

  if v_command.action_type = 'swap' then
    v_result := public.perform_booking_calendar_swap(
      (v_after -> 'a' ->> 'reservation_id')::uuid,
      (v_after -> 'b' ->> 'reservation_id')::uuid,
      v_after -> 'a',
      v_after -> 'b',
      auth.uid(),
      v_role,
      'Deshacer intercambio desde el calendario',
      'booking_calendar_undo',
      false
    );
  else
    v_result := public.perform_booking_calendar_change(
      (v_after ->> 'reservation_id')::uuid,
      (v_before ->> 'bed_id')::uuid,
      (v_before ->> 'check_in')::date,
      (v_before ->> 'check_out')::date,
      (v_after ->> 'bed_id')::uuid,
      (v_after ->> 'check_in')::date,
      (v_after ->> 'check_out')::date,
      auth.uid(),
      v_role,
      'Deshacer cambio desde el calendario',
      'booking_calendar_undo',
      false
    );
  end if;

  update public.booking_change_commands
  set status = 'undone',
      undone_at = now(),
      undone_by = auth.uid(),
      updated_at = now()
  where id = p_change_id;

  return jsonb_build_object(
    'result', 'applied',
    'message', 'Cambio deshecho correctamente',
    'change_id', p_change_id,
    'execution', v_result
  );
end;
$function$;

create or replace function public.decide_operational_approval(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.operational_approval_requests
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_row public.operational_approval_requests;
  v_operation text;
  v_result jsonb;
  v_error text;
  v_state text;
begin
  select role_key into v_role
  from public.user_access_profiles
  where user_id = auth.uid() and is_active = true;

  if v_role not in ('admin', 'approver') then
    raise exception 'No autorizado para decidir solicitudes operacionales';
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Decisión inválida'; end if;

  select * into v_row
  from public.operational_approval_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_row.id is null then raise exception 'Solicitud no encontrada o ya resuelta'; end if;

  if p_decision = 'rejected' then
    update public.operational_approval_requests
    set status = 'rejected',
        decision_notes = nullif(trim(p_notes), ''),
        decided_by = auth.uid(),
        decided_at = now(),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  if v_row.action_key <> 'booking.modify' then
    update public.operational_approval_requests
    set execution_error = 'Acción aún no ejecutable automáticamente: ' || v_row.action_key,
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  v_operation := v_row.proposed_payload ->> 'operation';

  begin
    if v_operation = 'swap_reservations' then
      v_result := public.perform_booking_calendar_swap(
        v_row.reservation_id,
        (v_row.proposed_payload ->> 'secondary_reservation_id')::uuid,
        v_row.proposed_payload -> 'expected_a',
        v_row.proposed_payload -> 'expected_b',
        auth.uid(),
        v_role,
        coalesce(v_row.reason, 'Intercambio aprobado por Santiago'),
        'booking_approval',
        true
      );
    elsif v_operation in ('move_room', 'resize_stay', 'late_checkout') then
      v_result := public.perform_booking_calendar_change(
        v_row.reservation_id,
        (v_row.proposed_payload ->> 'target_bed_id')::uuid,
        (v_row.proposed_payload ->> 'check_in')::date,
        (v_row.proposed_payload ->> 'check_out')::date,
        (v_row.proposed_payload ->> 'previous_bed_id')::uuid,
        (v_row.proposed_payload ->> 'previous_check_in')::date,
        (v_row.proposed_payload ->> 'previous_check_out')::date,
        auth.uid(),
        v_role,
        coalesce(v_row.reason, 'Cambio aprobado por Santiago'),
        'booking_approval',
        true
      );
    else
      raise exception 'Operación de reserva no soportada: %', coalesce(v_operation, 'sin definir');
    end if;

    update public.operational_approval_requests
    set status = 'approved',
        decision_notes = nullif(trim(p_notes), ''),
        decided_by = auth.uid(),
        decided_at = now(),
        executed_at = now(),
        execution_error = null,
        proposed_payload = proposed_payload || jsonb_build_object('execution_result', v_result),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
  exception when others then
    get stacked diagnostics v_error = message_text, v_state = returned_sqlstate;
    update public.operational_approval_requests
    set status = case when v_state = '40001' then 'cancelled' else 'pending' end,
        execution_error = v_error,
        decided_by = case when v_state = '40001' then auth.uid() else decided_by end,
        decided_at = case when v_state = '40001' then now() else decided_at end,
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
  end;

  return v_row;
end;
$function$;

revoke execute on function public.perform_booking_calendar_change(uuid, uuid, date, date, uuid, date, date, uuid, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.perform_booking_calendar_swap(uuid, uuid, jsonb, jsonb, uuid, text, text, text, boolean) from public, anon, authenticated;

grant execute on function public.booking_source_edit_policy(text) to authenticated;
grant execute on function public.apply_or_queue_booking_change(uuid, uuid, date, date, uuid, date, date, text) to authenticated;
grant execute on function public.apply_or_queue_booking_drag(uuid, uuid, date, date, text) to authenticated;
grant execute on function public.apply_or_queue_booking_swap(uuid, uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.undo_booking_change(uuid) to authenticated;
grant execute on function public.decide_operational_approval(uuid, text, text) to authenticated;

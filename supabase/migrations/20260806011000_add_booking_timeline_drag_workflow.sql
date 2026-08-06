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
  v_role text;
  v_email text;
  v_allowed boolean;
  v_requires_approval boolean;
  v_requires_reason boolean;
  v_reservation public.reservations%rowtype;
  v_operation text;
  v_payload jsonb;
  v_title text;
  v_summary text;
  v_request_id uuid;
  v_existing_id uuid;
  v_result record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select role_key, email
    into v_role, v_email
  from public.user_access_profiles
  where user_id = auth.uid() and is_active = true;

  if v_role is null then
    raise exception 'No existe un perfil de acceso activo';
  end if;

  select allowed, requires_approval, requires_reason
    into v_allowed, v_requires_approval, v_requires_reason
  from public.booking_action_permissions
  where role_key = v_role and action_key = 'booking.modify';

  if coalesce(v_allowed, false) = false then
    raise exception 'No autorizado para modificar reservas';
  end if;

  if v_requires_reason and nullif(trim(p_reason), '') is null then
    raise exception 'Debe registrar un motivo para modificar la reserva';
  end if;

  if p_target_bed_id is null or p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'El destino y las fechas propuestas no son válidos';
  end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  if coalesce(v_reservation.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_reservation.arrival_status, 'not_arrived') not in ('not_arrived', 'expected') then
    raise exception 'Solo se pueden mover reservas futuras que todavía no han iniciado';
  end if;

  if v_reservation.bed_id = p_target_bed_id
     and v_reservation.check_in = p_check_in
     and v_reservation.check_out = p_check_out then
    return jsonb_build_object('result', 'unchanged', 'message', 'La reserva no cambió');
  end if;

  v_operation := case when v_reservation.bed_id is distinct from p_target_bed_id then 'move_room' else 'resize_stay' end;
  v_payload := jsonb_build_object(
    'operation', v_operation,
    'target_bed_id', p_target_bed_id,
    'check_in', p_check_in,
    'check_out', p_check_out,
    'previous_bed_id', v_reservation.bed_id,
    'previous_check_in', v_reservation.check_in,
    'previous_check_out', v_reservation.check_out
  );

  v_title := case when v_operation = 'move_room' then 'Cambiar habitación de ' else 'Cambiar fechas de ' end || v_reservation.guest_name;
  v_summary := case
    when v_operation = 'move_room' then format('Mover la reserva del %s al %s y dejar la estadía entre %s y %s.', coalesce(v_reservation.bed_id::text, 'sin cama'), p_target_bed_id::text, p_check_in, p_check_out)
    else format('Cambiar la estadía desde %s–%s a %s–%s.', v_reservation.check_in, v_reservation.check_out, p_check_in, p_check_out)
  end;

  if coalesce(v_requires_approval, false) then
    select id into v_existing_id
    from public.operational_approval_requests
    where status = 'pending'
      and action_key = 'booking.modify'
      and reservation_id = p_reservation_id
      and proposed_payload = v_payload
    order by created_at desc
    limit 1;

    if v_existing_id is not null then
      return jsonb_build_object(
        'result', 'queued',
        'request_id', v_existing_id,
        'message', 'Este cambio ya está pendiente de aprobación'
      );
    end if;

    insert into public.operational_approval_requests (
      action_key,
      title,
      summary,
      source_type,
      source_id,
      reservation_id,
      room_id,
      requested_by,
      requested_by_name,
      priority,
      status,
      proposed_payload,
      reason
    ) values (
      'booking.modify',
      v_title,
      v_summary,
      'booking_timeline_drag',
      p_reservation_id,
      p_reservation_id,
      v_reservation.room_id,
      auth.uid(),
      coalesce(v_email, 'Operación'),
      'normal',
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

  if v_operation = 'move_room' then
    select * into v_result
    from public.move_booking_reservation(p_reservation_id, p_target_bed_id, p_check_in, p_check_out);
  else
    select * into v_result
    from public.resize_booking_reservation(p_reservation_id, p_check_in, p_check_out);
  end if;

  if coalesce(v_result.success, false) = false then
    raise exception '%', coalesce(v_result.message, 'No fue posible actualizar la reserva');
  end if;

  return jsonb_build_object(
    'result', 'applied',
    'message', coalesce(v_result.message, 'Reserva actualizada'),
    'reservation_id', p_reservation_id,
    'bed_id', p_target_bed_id,
    'check_in', p_check_in,
    'check_out', p_check_out
  );
end;
$function$;

grant execute on function public.apply_or_queue_booking_drag(uuid, uuid, date, date, text) to authenticated;

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
  v_target_bed_id uuid;
  v_check_in date;
  v_check_out date;
  v_result record;
begin
  select role_key into v_role
  from public.user_access_profiles
  where user_id = auth.uid() and is_active = true;

  if v_role not in ('admin', 'approver') then
    raise exception 'No autorizado para decidir solicitudes operacionales';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_row
  from public.operational_approval_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_row.id is null then
    raise exception 'Solicitud no encontrada o ya resuelta';
  end if;

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
  v_target_bed_id := nullif(v_row.proposed_payload ->> 'target_bed_id', '')::uuid;
  v_check_in := coalesce(
    nullif(v_row.proposed_payload ->> 'check_in', '')::date,
    (select check_in from public.reservations where id = v_row.reservation_id)
  );
  v_check_out := coalesce(
    nullif(v_row.proposed_payload ->> 'check_out', '')::date,
    (select check_out from public.reservations where id = v_row.reservation_id)
  );

  begin
    if v_operation = 'move_room' then
      if v_row.reservation_id is null or v_target_bed_id is null then
        raise exception 'Solicitud de cambio de habitación incompleta';
      end if;
      select * into v_result
      from public.move_booking_reservation(v_row.reservation_id, v_target_bed_id, v_check_in, v_check_out);
    elsif v_operation in ('late_checkout', 'resize_stay') then
      if v_row.reservation_id is null or v_check_in is null or v_check_out is null then
        raise exception 'Solicitud de cambio de fechas incompleta';
      end if;
      select * into v_result
      from public.resize_booking_reservation(v_row.reservation_id, v_check_in, v_check_out);
    else
      raise exception 'Operación de reserva no soportada: %', coalesce(v_operation, 'sin definir');
    end if;

    if coalesce(v_result.success, false) = false then
      raise exception '%', coalesce(v_result.message, 'No fue posible ejecutar el cambio');
    end if;

    update public.operational_approval_requests
    set status = 'approved',
        decision_notes = nullif(trim(p_notes), ''),
        decided_by = auth.uid(),
        decided_at = now(),
        executed_at = now(),
        execution_error = null,
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
  exception when others then
    update public.operational_approval_requests
    set status = 'pending',
        execution_error = sqlerrm,
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end;

  return v_row;
end;
$function$;

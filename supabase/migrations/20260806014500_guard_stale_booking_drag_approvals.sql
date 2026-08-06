create unique index if not exists operational_approval_requests_one_pending_booking_modify_idx
on public.operational_approval_requests (reservation_id)
where action_key = 'booking.modify'
  and status = 'pending'
  and reservation_id is not null;

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
  v_current public.reservations%rowtype;
  v_operation text;
  v_target_bed_id uuid;
  v_previous_bed_id uuid;
  v_previous_check_in date;
  v_previous_check_out date;
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
  v_previous_bed_id := nullif(v_row.proposed_payload ->> 'previous_bed_id', '')::uuid;
  v_previous_check_in := nullif(v_row.proposed_payload ->> 'previous_check_in', '')::date;
  v_previous_check_out := nullif(v_row.proposed_payload ->> 'previous_check_out', '')::date;
  v_check_in := nullif(v_row.proposed_payload ->> 'check_in', '')::date;
  v_check_out := nullif(v_row.proposed_payload ->> 'check_out', '')::date;

  select * into v_current
  from public.reservations
  where id = v_row.reservation_id
  for update;

  if not found then
    update public.operational_approval_requests
    set status = 'cancelled',
        execution_error = 'La reserva ya no existe. La solicitud fue anulada.',
        decision_notes = 'Anulada automáticamente al intentar aprobar una reserva inexistente.',
        decided_by = auth.uid(),
        decided_at = now(),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  if v_current.bed_id is distinct from v_previous_bed_id
     or v_current.check_in is distinct from v_previous_check_in
     or v_current.check_out is distinct from v_previous_check_out then
    update public.operational_approval_requests
    set status = 'cancelled',
        execution_error = 'La reserva cambió después de crear esta solicitud. Revise el calendario y genere una nueva propuesta.',
        decision_notes = 'Solicitud anulada automáticamente por cambio concurrente de la reserva.',
        decided_by = auth.uid(),
        decided_at = now(),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  if coalesce(v_current.status, 'confirmed') not in ('pending', 'confirmed')
     or coalesce(v_current.arrival_status, 'not_arrived') not in ('not_arrived', 'expected') then
    update public.operational_approval_requests
    set status = 'cancelled',
        execution_error = 'La estadía ya inició o cambió de estado. El movimiento pendiente fue anulado.',
        decision_notes = 'Solicitud anulada automáticamente por cambio de estado operacional.',
        decided_by = auth.uid(),
        decided_at = now(),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  begin
    if v_operation = 'move_room' then
      if v_row.reservation_id is null or v_target_bed_id is null or v_check_in is null or v_check_out is null then
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

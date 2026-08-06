create or replace function public.decide_operational_approval(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.operational_approval_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_row public.operational_approval_requests;
  v_operation text;
  v_target_bed_id uuid;
  v_check_in date;
  v_check_out date;
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

  begin
    if v_row.action_key = 'booking.modify' then
      v_operation := v_row.proposed_payload ->> 'operation';

      if v_operation = 'move_room' then
        v_target_bed_id := nullif(v_row.proposed_payload ->> 'target_bed_id', '')::uuid;
        v_check_in := coalesce(
          nullif(v_row.proposed_payload ->> 'check_in', '')::date,
          (select check_in from public.reservations where id = v_row.reservation_id)
        );
        v_check_out := coalesce(
          nullif(v_row.proposed_payload ->> 'check_out', '')::date,
          (select check_out from public.reservations where id = v_row.reservation_id)
        );

        if v_row.reservation_id is null or v_target_bed_id is null then
          raise exception 'Solicitud de cambio de habitación incompleta';
        end if;

        perform public.move_booking_reservation(
          v_row.reservation_id,
          v_target_bed_id,
          v_check_in,
          v_check_out
        );

      elsif v_operation = 'late_checkout' then
        v_check_in := (
          select check_in from public.reservations where id = v_row.reservation_id
        );
        v_check_out := nullif(v_row.proposed_payload ->> 'check_out', '')::date;

        if v_row.reservation_id is null or v_check_out is null then
          raise exception 'Solicitud de late check-out incompleta';
        end if;

        perform public.resize_booking_reservation(
          v_row.reservation_id,
          v_check_in,
          v_check_out
        );

      else
        raise exception 'Operación de reserva no soportada: %', coalesce(v_operation, 'sin definir');
      end if;
    else
      raise exception 'Acción aún no ejecutable automáticamente: %', v_row.action_key;
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

    raise exception 'No fue posible ejecutar la acción aprobada: %', sqlerrm;
  end;

  return v_row;
end;
$$;

revoke all on function public.decide_operational_approval(uuid, text, text) from public;
grant execute on function public.decide_operational_approval(uuid, text, text) to authenticated;

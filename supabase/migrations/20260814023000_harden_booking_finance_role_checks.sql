-- Black Swan OS Phase 1: harden high-risk booking/finance mutations
--
-- Replace legacy JWT app_metadata role reads with the canonical
-- public.current_app_role() resolver. Keep service-role compatibility and
-- existing operational-scope checks. This migration is committed for review
-- and is not applied automatically to production.

create or replace function public.create_reservation_atomic(
  p_bed_id uuid default null,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_check_in date default null,
  p_check_out date default null,
  p_num_guests integer default 1,
  p_total_amount numeric default 0,
  p_status text default 'confirmed',
  p_special_requests text default null,
  p_invoice_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_location_id uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' and v_role not in ('admin', 'approver') then
    raise exception 'Insufficient permissions to create reservations';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    select r.location_id into v_location_id
    from public.beds b
    join public.rooms r on r.id = b.room_id
    where b.id = p_bed_id;
    if v_location_id is null then raise exception 'No fue posible resolver la ubicación de la cama'; end if;
    if not public.can_access_operational_scope('booking', v_location_id) then
      raise exception 'No autorizado para crear reservas en esta ubicación';
    end if;
  end if;

  return public.create_reservation_atomic_internal(
    p_bed_id,p_guest_name,p_guest_email,p_guest_phone,p_check_in,p_check_out,
    p_num_guests,p_total_amount,p_status,p_special_requests,p_invoice_due_date
  );
end;
$function$;

create or replace function public.create_walk_in_reservation(
  p_bed_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_check_out date,
  p_num_guests integer,
  p_reason text,
  p_special_requests text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_result jsonb;
  v_reservation_id uuid;
  v_location_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para registrar walk-in';
  end if;
  if auth.role() <> 'service_role' then
    select r.location_id into v_location_id
    from public.beds b join public.rooms r on r.id=b.room_id
    where b.id=p_bed_id;
    if v_location_id is null or not public.can_access_operational_scope('booking', v_location_id) then
      raise exception 'No autorizado para registrar walk-in en esta ubicación';
    end if;
  end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'Debe indicar el motivo del walk-in'; end if;
  if p_check_out <= current_date then raise exception 'La salida debe ser posterior a hoy'; end if;

  v_result := public.create_reservation_atomic_internal(
    p_bed_id,p_guest_name,nullif(trim(coalesce(p_guest_email,'')),''),
    nullif(trim(coalesce(p_guest_phone,'')),''),current_date,p_check_out,
    greatest(coalesce(p_num_guests,1),1),0,'confirmed',p_special_requests,null
  );
  v_reservation_id := (v_result ->> 'reservation_id')::uuid;

  update public.reservations
  set source='walk_in', estimated_arrival_time=localtime::time, arrived_at=now(),
      actual_arrival_at=now(), arrival_status='arrived'
  where id=v_reservation_id;

  perform public.record_booking_event(
    v_reservation_id,'walk_in_created','exception','Walk-in registrado',trim(p_reason),
    'walk_in',null,null,'confirmed',jsonb_build_object('bed_id',p_bed_id,'check_out',p_check_out)
  );

  return jsonb_build_object('success',true,'reservation_id',v_reservation_id,'message','Walk-in creado. Debe completar el check-in guiado.');
end;
$function$;

create or replace function public.add_reservation_financial_adjustment(
  p_reservation_id uuid,
  p_adjustment_type text,
  p_description text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_id uuid;
  v_folio jsonb;
  v_location_id uuid;
begin
  if auth.role() <> 'service_role' and v_role <> 'admin' then raise exception 'Solo administración puede registrar ajustes financieros'; end if;
  if p_adjustment_type not in ('discount','credit','fee','refund') then raise exception 'Tipo de ajuste inválido'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  if nullif(trim(coalesce(p_description,'')),'') is null then raise exception 'Descripción requerida'; end if;
  select location_id into v_location_id from public.reservations where id=p_reservation_id;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if auth.role() <> 'service_role' and not public.can_access_operational_scope('finance',v_location_id) then raise exception 'Reserva fuera de su alcance financiero'; end if;
  insert into public.reservation_financial_adjustments(reservation_id,adjustment_type,description,amount,created_by)
  values(p_reservation_id,p_adjustment_type,trim(p_description),p_amount,auth.uid()) returning id into v_id;
  perform public.sync_reservation_payment_status(p_reservation_id);
  v_folio := public.get_reservation_folio(p_reservation_id);
  return jsonb_build_object('adjustmentId',v_id,'folio',v_folio);
end;
$function$;

create or replace function public.reverse_reservation_payment(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_payment public.payments%rowtype;
  v_folio jsonb;
  v_location_id uuid;
begin
  if auth.role() <> 'service_role' and v_role <> 'admin' then raise exception 'Solo administración puede revertir pagos'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Motivo requerido'; end if;
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  select r.location_id into v_location_id from public.reservations r where r.id=v_payment.reservation_id;
  if auth.role() <> 'service_role' and not public.can_access_operational_scope('finance',v_location_id) then raise exception 'Pago fuera de su alcance financiero'; end if;
  if v_payment.reversed_at is not null then raise exception 'El pago ya fue revertido'; end if;
  update public.payments set reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(p_reason),payment_status='reversed' where id=p_payment_id;
  perform public.sync_reservation_payment_status(v_payment.reservation_id);
  perform public.record_booking_event(v_payment.reservation_id,'payment_reversed','finance','Pago revertido',trim(p_reason),'payment',p_payment_id,'paid','reversed',jsonb_build_object('amount',v_payment.amount));
  v_folio := public.get_reservation_folio(v_payment.reservation_id);
  return jsonb_build_object('paymentId',p_payment_id,'folio',v_folio);
end;
$function$;

create or replace function public.void_reservation_financial_adjustment(
  p_adjustment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_adjustment public.reservation_financial_adjustments%rowtype;
  v_folio jsonb;
  v_location_id uuid;
begin
  if auth.role() <> 'service_role' and v_role <> 'admin' then raise exception 'Solo administración puede anular ajustes'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Motivo requerido'; end if;
  select * into v_adjustment from public.reservation_financial_adjustments where id=p_adjustment_id for update;
  if not found then raise exception 'Ajuste no encontrado'; end if;
  select r.location_id into v_location_id from public.reservations r where r.id=v_adjustment.reservation_id;
  if auth.role() <> 'service_role' and not public.can_access_operational_scope('finance',v_location_id) then raise exception 'Ajuste fuera de su alcance financiero'; end if;
  if v_adjustment.voided_at is not null then raise exception 'El ajuste ya fue anulado'; end if;
  update public.reservation_financial_adjustments set voided_at=now(), voided_by=auth.uid(), void_reason=trim(p_reason) where id=p_adjustment_id;
  perform public.sync_reservation_payment_status(v_adjustment.reservation_id);
  perform public.record_booking_event(v_adjustment.reservation_id,'adjustment_voided','finance','Ajuste financiero anulado',trim(p_reason),'financial_adjustment',p_adjustment_id,v_adjustment.adjustment_type,'voided',jsonb_build_object('amount',v_adjustment.amount));
  v_folio := public.get_reservation_folio(v_adjustment.reservation_id);
  return jsonb_build_object('adjustmentId',p_adjustment_id,'folio',v_folio);
end;
$function$;

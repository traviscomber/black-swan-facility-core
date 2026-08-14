-- Black Swan OS Phase 1: harden booking lifecycle and messaging role checks
--
-- Replace legacy JWT app_metadata role reads with public.current_app_role().
-- Preserve existing service-role bypasses, action semantics and operational
-- scope checks. This migration is committed for review and is not applied
-- automatically to production.

create or replace function public.guided_check_in(
  p_reservation_id uuid,
  p_identity_verified boolean,
  p_contact_verified boolean,
  p_guest_count_verified boolean,
  p_payment_guarantee_verified boolean,
  p_terms_accepted boolean,
  p_access_issued boolean,
  p_special_requests_reviewed boolean,
  p_exception_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reservation public.reservations%rowtype;
  v_room public.rooms%rowtype;
  v_role text := public.current_app_role();
  v_missing text[] := array[]::text[];
  v_exception boolean := nullif(trim(coalesce(p_exception_reason,'')),'') is not null;
begin
  if auth.uid() is null and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para registrar check-in';
  end if;

  select * into v_reservation
  from public.reservations
  where id=p_reservation_id
  for update;
  if not found then raise exception 'Reserva no encontrada'; end if;

  if auth.role() <> 'service_role'
     and not public.can_access_operational_scope('booking', v_reservation.location_id) then
    raise exception 'No autorizado para registrar check-in en esta ubicación';
  end if;

  if v_reservation.status not in ('confirmed','pending') then
    raise exception 'La reserva no está disponible para check-in';
  end if;
  if v_reservation.room_id is null then raise exception 'La reserva no tiene habitación asignada'; end if;

  select * into v_room from public.rooms where id=v_reservation.room_id for update;
  if not found then raise exception 'Habitación no encontrada'; end if;
  if v_room.operational_status not in ('ready','inspected') then
    raise exception 'La habitación debe estar lista o inspeccionada antes del check-in';
  end if;

  if not p_identity_verified then v_missing := array_append(v_missing,'identidad'); end if;
  if not p_contact_verified then v_missing := array_append(v_missing,'contacto'); end if;
  if not p_guest_count_verified then v_missing := array_append(v_missing,'cantidad de huéspedes'); end if;
  if not p_payment_guarantee_verified then v_missing := array_append(v_missing,'pago o garantía'); end if;
  if not p_terms_accepted then v_missing := array_append(v_missing,'condiciones aceptadas'); end if;
  if not p_access_issued then v_missing := array_append(v_missing,'llaves o accesos'); end if;
  if not p_special_requests_reviewed then v_missing := array_append(v_missing,'solicitudes especiales'); end if;

  if cardinality(v_missing) > 0 then
    if not v_exception then raise exception 'Checklist incompleto: %',array_to_string(v_missing,', '); end if;
    if auth.role() <> 'service_role' and v_role <> 'admin' then
      raise exception 'Solo un administrador puede autorizar excepciones de check-in';
    end if;
  end if;

  update public.reservations
  set status='checked_in',arrival_status='checked_in',arrived_at=coalesce(arrived_at,now()),
      actual_arrival_at=coalesce(actual_arrival_at,now()),queued_at=null,
      identity_verified=p_identity_verified,contact_verified=p_contact_verified,
      guest_count_verified=p_guest_count_verified,payment_guarantee_verified=p_payment_guarantee_verified,
      terms_accepted=p_terms_accepted,access_issued=p_access_issued,
      special_requests_reviewed=p_special_requests_reviewed,check_in_completed_at=now(),
      check_in_completed_by=auth.uid(),check_in_exception_reason=case when v_exception then trim(p_exception_reason) else null end
  where id=p_reservation_id;

  update public.rooms set status='occupied',operational_status='occupied' where id=v_room.id;

  insert into public.reservation_history(reservation_id,status_change,changed_by,notes)
  values(p_reservation_id,'confirmed -> checked_in',auth.uid(),
    case when v_exception
      then format('Check-in guiado con excepción autorizada. Motivo: %s. Pendientes: %s',trim(p_exception_reason),array_to_string(v_missing,', '))
      else 'Check-in guiado completado con checklist íntegro.' end);

  return jsonb_build_object('result','checked_in','room_status','occupied','exception_used',v_exception,'missing_checks',v_missing,'completed_at',now());
end;
$function$;

create or replace function public.handle_booking_exception(
  p_reservation_id uuid,
  p_action text,
  p_reason text,
  p_parameters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_reservation public.reservations%rowtype;
  v_target_bed public.beds%rowtype;
  v_target_room public.rooms%rowtype;
  v_old_room_id uuid;
  v_new_check_out date;
  v_new_time time;
  v_target_bed_id uuid;
  v_event_title text;
  v_previous_state text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then raise exception 'No autorizado para gestionar excepciones operativas'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Debe indicar el motivo de la excepción'; end if;
  if p_action not in ('cancel','no_show','request_early_check_in','request_late_check_out','extend_stay','early_departure','room_move') then raise exception 'Acción de excepción no válida'; end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if auth.role() <> 'service_role' and not public.can_access_operational_scope('booking', v_reservation.location_id) then
    raise exception 'Reserva fuera de su alcance operacional';
  end if;

  v_previous_state := coalesce(v_reservation.status, 'sin_estado');

  if p_action = 'cancel' then
    if v_reservation.status not in ('pending','confirmed') then raise exception 'Solo se pueden cancelar reservas que aún no han iniciado'; end if;
    update public.reservations set status = 'cancelled' where id = p_reservation_id;
    update public.housekeeping_tasks set status = 'cancelled', updated_at = now() where reservation_id = p_reservation_id and status in ('pending','assigned');
    v_event_title := 'Reserva cancelada';
  elsif p_action = 'no_show' then
    if v_reservation.status not in ('pending','confirmed') then raise exception 'La reserva no puede marcarse como no-show en su estado actual'; end if;
    if v_reservation.check_in > current_date then raise exception 'No se puede registrar no-show antes de la fecha de llegada'; end if;
    update public.reservations set status = 'no_show', arrival_status = 'no_show' where id = p_reservation_id;
    update public.housekeeping_tasks set status = 'cancelled', updated_at = now() where reservation_id = p_reservation_id and status in ('pending','assigned');
    v_event_title := 'No-show registrado';
  elsif p_action = 'request_early_check_in' then
    if v_reservation.status not in ('pending','confirmed') then raise exception 'El early check-in solo puede solicitarse antes del inicio de la estadía'; end if;
    v_new_time := nullif(p_parameters ->> 'estimated_arrival_time','')::time;
    update public.reservations set early_check_in_requested = true, estimated_arrival_time = coalesce(v_new_time, estimated_arrival_time) where id = p_reservation_id;
    v_event_title := 'Early check-in solicitado';
  elsif p_action = 'request_late_check_out' then
    if v_reservation.status not in ('confirmed','checked_in','checked-in') then raise exception 'El late check-out no está disponible para esta reserva'; end if;
    v_new_time := nullif(p_parameters ->> 'estimated_departure_time','')::time;
    update public.reservations set late_check_out_requested = true, estimated_departure_time = coalesce(v_new_time, estimated_departure_time) where id = p_reservation_id;
    v_event_title := 'Late check-out solicitado';
  elsif p_action = 'extend_stay' then
    if v_reservation.status not in ('confirmed','checked_in','checked-in') then raise exception 'La estadía no puede extenderse en su estado actual'; end if;
    v_new_check_out := nullif(p_parameters ->> 'new_check_out','')::date;
    if v_new_check_out is null or v_new_check_out <= v_reservation.check_out then raise exception 'La nueva fecha de salida debe ser posterior a la salida actual'; end if;
    if not public.is_booking_inventory_available(v_reservation.bed_id,v_reservation.room_id,v_reservation.location_id,v_reservation.check_in,v_new_check_out,v_reservation.id) then raise exception 'La cama o habitación no está disponible para extender la estadía'; end if;
    update public.reservations set check_out = v_new_check_out where id = p_reservation_id;
    v_event_title := 'Estadía extendida';
  elsif p_action = 'early_departure' then
    if v_reservation.status not in ('checked_in','checked-in') then raise exception 'La salida anticipada requiere una estadía activa'; end if;
    update public.reservations set status = 'checked_out', arrival_status = 'departed', actual_departure_at = now() where id = p_reservation_id;
    if v_reservation.room_id is not null then
      update public.rooms set operational_status = 'dirty', status = 'available' where id = v_reservation.room_id;
      insert into public.housekeeping_tasks(reservation_id,room_id,task_type,status,priority,notes,scheduled_for,due_at,sla_minutes,service_date,requires_inspection)
      values(p_reservation_id,v_reservation.room_id,'turnover','pending','high',format('Limpieza por salida anticipada de %s. Motivo: %s',v_reservation.guest_name,trim(p_reason)),now(),now()+interval '2 hours',120,current_date,true)
      on conflict do nothing;
    end if;
    v_event_title := 'Salida anticipada registrada';
  elsif p_action = 'room_move' then
    if v_reservation.status not in ('checked_in','checked-in') then raise exception 'El cambio de habitación durante estadía requiere un check-in activo'; end if;
    v_target_bed_id := nullif(p_parameters ->> 'target_bed_id','')::uuid;
    if v_target_bed_id is null then raise exception 'Debe seleccionar una cama de destino'; end if;
    select * into v_target_bed from public.beds where id = v_target_bed_id and is_available = true;
    if not found then raise exception 'La cama de destino no está disponible'; end if;
    select * into v_target_room from public.rooms where id = v_target_bed.room_id for update;
    if not found then raise exception 'Habitación de destino no encontrada'; end if;
    if auth.role() <> 'service_role' and not public.can_access_operational_scope('booking', v_target_room.location_id) then raise exception 'Habitación de destino fuera de su alcance operacional'; end if;
    if v_target_room.operational_status not in ('ready','inspected') then raise exception 'La habitación de destino debe estar lista o inspeccionada'; end if;
    if not public.is_booking_inventory_available(v_target_bed.id,v_target_room.id,v_target_room.location_id,current_date,v_reservation.check_out,v_reservation.id) then raise exception 'La cama de destino no está disponible para el resto de la estadía'; end if;
    v_old_room_id := v_reservation.room_id;
    update public.reservations set bed_id=v_target_bed.id,room_id=v_target_room.id,location_id=v_target_room.location_id,booking_type='BED' where id=p_reservation_id;
    update public.rooms set operational_status='occupied',status='occupied' where id=v_target_room.id;
    if v_old_room_id is not null and v_old_room_id <> v_target_room.id then
      update public.rooms set operational_status='dirty',status='available' where id=v_old_room_id;
      insert into public.housekeeping_tasks(reservation_id,room_id,task_type,status,priority,notes,scheduled_for,due_at,sla_minutes,service_date,requires_inspection)
      values(p_reservation_id,v_old_room_id,'room_move_turnover','pending','high',format('Limpieza posterior al cambio de habitación de %s. Motivo: %s',v_reservation.guest_name,trim(p_reason)),now(),now()+interval '2 hours',120,current_date,true);
    end if;
    v_event_title := 'Cambio de habitación durante estadía';
  end if;

  perform public.record_booking_event(p_reservation_id,p_action,'exception',v_event_title,trim(p_reason),'booking_exception',null,v_previous_state,
    case when p_action='cancel' then 'cancelled' when p_action='no_show' then 'no_show' when p_action='early_departure' then 'checked_out' else v_previous_state end,
    coalesce(p_parameters,'{}'::jsonb) || jsonb_build_object('action',p_action));
  return jsonb_build_object('success',true,'action',p_action,'reservation_id',p_reservation_id,'message',v_event_title);
end;
$function$;

create or replace function public.link_reservation_guest(
  p_reservation_id uuid,
  p_guest_id uuid
)
returns public.reservations
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_guest public.guests%rowtype;
  v_result public.reservations%rowtype;
  v_location_id uuid;
begin
  if auth.role()<>'service_role' and v_role not in ('admin','approver') then raise exception 'No autorizado para vincular huéspedes'; end if;
  select location_id into v_location_id from public.reservations where id=p_reservation_id;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if auth.role()<>'service_role' and not public.can_access_operational_scope('booking',v_location_id) then raise exception 'Reserva fuera de su alcance operacional'; end if;
  select * into v_guest from public.guests where id=p_guest_id;
  if not found then raise exception 'Huésped no encontrado'; end if;
  update public.reservations set guest_id=v_guest.id,guest_name=v_guest.name,guest_email=coalesce(v_guest.email,guest_email),guest_phone=coalesce(v_guest.phone,guest_phone)
  where id=p_reservation_id returning * into v_result;
  update public.guests set last_stay_at=greatest(coalesce(last_stay_at,'epoch'::timestamptz),v_result.check_out::timestamptz),updated_at=now() where id=v_guest.id;
  return v_result;
end;
$function$;

create or replace function public.record_booking_message(
  p_reservation_id uuid,
  p_channel text,
  p_direction text,
  p_recipient text,
  p_subject text,
  p_text text,
  p_template_key text default null,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_role text := public.current_app_role();
  v_location_id uuid;
  v_service_role boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if auth.uid() is null and not v_service_role then
    raise exception 'Authentication required';
  end if;

  if not v_service_role and v_role not in ('admin','approver','operator') then
    raise exception 'Insufficient permissions';
  end if;
  if p_channel not in ('whatsapp','email','sms','internal') then raise exception 'Invalid channel'; end if;
  if p_direction not in ('outbound','inbound','internal') then raise exception 'Invalid direction'; end if;
  if p_status not in ('draft','queued','sent','delivered','failed','received','cancelled') then raise exception 'Invalid message status'; end if;

  if not v_service_role then
    if p_direction = 'inbound' then raise exception 'Inbound messages can only be recorded by the messaging service'; end if;
    if p_status not in ('draft','queued') then raise exception 'Delivery state must be updated through the controlled messaging workflow'; end if;
  end if;

  if p_reservation_id is not null then
    select location_id into v_location_id from public.reservations where id = p_reservation_id;
    if not found then raise exception 'Reservation not found'; end if;
    if not v_service_role and not public.can_access_operational_scope('booking', v_location_id) then raise exception 'Reservation outside operational scope'; end if;
  end if;

  insert into public.messages(phone,direction,text,reservation_id,channel,status,recipient,subject,template_key,created_by)
  values(coalesce(p_recipient,'internal'),p_direction,p_text,p_reservation_id,p_channel,p_status,p_recipient,p_subject,p_template_key,auth.uid())
  returning id into v_id;

  if p_reservation_id is not null then
    insert into public.booking_events(reservation_id,event_type,title,description,source,related_entity_type,related_entity_id,created_by,metadata)
    values(p_reservation_id,'message_'||p_status,'Mensaje '||p_status,p_text,'messaging','message',v_id,auth.uid(),jsonb_build_object('channel',p_channel,'recipient',p_recipient,'template_key',p_template_key));
  end if;

  return v_id;
end;
$function$;

create or replace function public.schedule_stayover_housekeeping(
  p_reservation_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reservation public.reservations%rowtype;
  v_day date;
  v_created integer:=0;
  v_role text:=public.current_app_role();
begin
  if auth.role()<>'service_role' and v_role not in ('admin','approver') then raise exception 'No autorizado para programar housekeeping'; end if;
  select * into v_reservation from public.reservations where id=p_reservation_id;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if auth.role()<>'service_role' and not public.can_access_operational_scope('housekeeping',v_reservation.location_id) then raise exception 'Reserva fuera de su alcance de housekeeping'; end if;
  if v_reservation.room_id is null then return 0; end if;
  if v_reservation.housekeeping_preference in ('no_service','privacy') then return 0; end if;
  v_day:=v_reservation.check_in+v_reservation.housekeeping_frequency_days;
  while v_day<v_reservation.check_out loop
    insert into public.housekeeping_tasks(reservation_id,room_id,task_type,status,priority,notes,service_date,scheduled_for,due_at,sla_minutes,requires_inspection)
    values(v_reservation.id,v_reservation.room_id,'stayover_cleaning','pending','normal','Limpieza programada durante la estadía de '||v_reservation.guest_name||'.',v_day,(v_day::timestamp+time '10:00') at time zone 'America/Santiago',(v_day::timestamp+time '14:00') at time zone 'America/Santiago',240,false)
    on conflict do nothing;
    if found then v_created:=v_created+1; end if;
    v_day:=v_day+v_reservation.housekeeping_frequency_days;
  end loop;
  return v_created;
end;
$function$;

create or replace function public.update_booking_message_status(
  p_message_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_message public.messages%rowtype;
  v_location_id uuid;
begin
  if auth.uid() is null and coalesce(auth.role(),'') <> 'service_role' then raise exception 'Authentication required'; end if;
  if p_status not in ('queued','sent','delivered','failed','received','cancelled') then raise exception 'Invalid message status'; end if;
  if coalesce(auth.role(),'') <> 'service_role' and v_role not in ('admin','approver','operator') then raise exception 'Insufficient permissions'; end if;

  select * into v_message from public.messages where id=p_message_id for update;
  if not found then raise exception 'Message not found'; end if;

  if v_message.reservation_id is not null and coalesce(auth.role(),'') <> 'service_role' then
    select location_id into v_location_id from public.reservations where id=v_message.reservation_id;
    if not public.can_access_operational_scope('booking', v_location_id) then raise exception 'Message outside operational scope'; end if;
  end if;

  perform set_config('app.message_status_writer','controlled_rpc',true);
  update public.messages set status=p_status,
    sent_at=case when p_status='sent' then coalesce(sent_at,now()) else sent_at end,
    delivered_at=case when p_status='delivered' then coalesce(delivered_at,now()) else delivered_at end,
    failed_at=case when p_status='failed' then coalesce(failed_at,now()) else failed_at end,
    error_message=case when p_status='failed' then p_error else null end
  where id=p_message_id;

  insert into public.critical_action_audit_log(entity_type,entity_id,action,category,actor_id,actor_email,actor_role,old_data,new_data,changed_fields)
  values('message',p_message_id,'message_status_changed','communications',auth.uid(),auth.jwt()->>'email',v_role,to_jsonb(v_message),jsonb_build_object('status',p_status,'error',p_error),array['status']);
end
$function$;
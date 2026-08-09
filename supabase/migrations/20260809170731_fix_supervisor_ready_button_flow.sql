create or replace function public.supervisor_mark_reservation_ready(
  p_reservation_id uuid,
  p_reason text default 'Verificación física de supervisor'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_res public.reservations%rowtype;
  v_room public.rooms%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if auth.uid() is not null then
    if not public.can_app_action('housekeeping.manage') then
      raise exception 'Se requiere permiso de supervisión de limpieza';
    end if;
  elsif coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  select * into v_res from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_res.room_id is null then raise exception 'La reserva no tiene habitación asignada'; end if;
  if auth.uid() is not null and not public.can_access_operational_scope('booking',v_res.location_id) then
    raise exception 'Reserva fuera de su alcance operacional';
  end if;
  if v_res.status in ('checked_in','checked-in','checked_out','checked-out','cancelled','canceled','void','voided','no_show') then
    raise exception 'La reserva no está en un estado que permita marcarla lista para entrada';
  end if;

  select * into v_room from public.rooms where id=v_res.room_id for update;
  if not found then raise exception 'Habitación no encontrada'; end if;
  if v_room.operational_status in ('occupied','out_of_service','maintenance','out_of_inventory') then
    raise exception 'La habitación no puede marcarse lista desde su estado actual: %',v_room.operational_status;
  end if;

  update public.reservations set arrival_status='ready_for_checkin' where id=p_reservation_id;

  update public.housekeeping_tasks
     set status='completed',
         completed_at=coalesce(completed_at,now()),
         inspection_status=case when requires_inspection then 'approved' else coalesce(inspection_status,'not_required') end,
         inspection_notes=case when requires_inspection then coalesce(v_reason,'Verificación física de supervisor') else inspection_notes end,
         inspected_by=case when requires_inspection then auth.uid() else inspected_by end,
         inspected_at=case when requires_inspection then now() else inspected_at end,
         verified_by=case when requires_inspection then coalesce(verified_by,auth.uid()) else verified_by end,
         verified_at=case when requires_inspection then coalesce(verified_at,now()) else verified_at end,
         resolution_notes=concat_ws(' · ',nullif(resolution_notes,''),'Override supervisor: '||coalesce(v_reason,'Verificación física de supervisor')),
         updated_at=now()
   where reservation_id=p_reservation_id
     and task_type in ('pre_arrival_preparation','pre_arrival_inspection')
     and status not in ('completed','cancelled');

  update public.rooms set operational_status='ready',status='available' where id=v_res.room_id;

  insert into public.booking_events(
    reservation_id,event_type,category,title,description,source_type,source_id,previous_state,new_state,metadata,actor_id,occurred_at,created_at
  ) values (
    p_reservation_id,'supervisor_override','arrival_readiness','Habitación marcada lista para entrada',
    coalesce(v_reason,'Verificación física de supervisor'),'reservation',p_reservation_id,
    coalesce(v_room.operational_status,'unknown'),'ready',
    jsonb_build_object('room_id',v_res.room_id,'override',true,'reason',coalesce(v_reason,'Verificación física de supervisor')),
    auth.uid(),now(),now()
  );

  return jsonb_build_object('result','ready_for_checkin','room_status','ready','reservation_id',p_reservation_id,'room_id',v_res.room_id);
end;
$function$;

revoke all on function public.supervisor_mark_reservation_ready(uuid,text) from public, anon;
grant execute on function public.supervisor_mark_reservation_ready(uuid,text) to authenticated, service_role;

create or replace function public.set_room_operational_status(
  p_room_id uuid,
  p_status text,
  p_reason text default null,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
  v_room public.rooms%rowtype;
  v_waiting integer := 0;
  v_candidate_count integer := 0;
  v_candidate_id uuid;
  v_today date := (now() at time zone 'America/Santiago')::date;
begin
  if auth.uid() is null and coalesce(auth.role(),'') <> 'service_role' then raise exception 'Authentication required'; end if;
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then raise exception 'No autorizado para actualizar habitación'; end if;
  if p_status not in ('ready','dirty','cleaning','clean_pending_inspection','inspected','occupied','out_of_service','out_of_inventory') then raise exception 'Estado operativo inválido'; end if;
  if p_status in ('out_of_service','out_of_inventory') and coalesce(trim(p_reason),'')='' then raise exception 'Debe indicar un motivo para retirar la habitación de servicio o inventario'; end if;

  select * into v_room from public.rooms where id=p_room_id for update;
  if not found then raise exception 'Habitación no encontrada'; end if;
  if auth.role() <> 'service_role' and not public.can_access_operational_scope('hospitality',v_room.location_id) then raise exception 'No autorizado para operar esta habitación'; end if;
  if auth.role() <> 'service_role' and p_status in ('out_of_service','out_of_inventory') and not public.can_app_action('room.out_of_service') then raise exception 'No autorizado para retirar habitaciones de servicio o inventario'; end if;

  if v_room.operational_status='occupied' and p_status in ('ready','inspected','dirty','cleaning','clean_pending_inspection') then
    raise exception 'La habitación está ocupada; no corresponde cambiar su preparación mientras el huésped está alojado';
  end if;

  if p_status in ('ready','inspected') and auth.uid() is not null and public.can_app_action('housekeeping.manage') then
    select count(*),min(id) into v_candidate_count,v_candidate_id
    from public.reservations
    where room_id=p_room_id
      and status in ('pending','confirmed','waiting_for_room')
      and check_in<=v_today
      and check_out>v_today
      and coalesce(arrival_status,'not_arrived') not in ('checked_in','departed','no_show');

    if v_candidate_count=1 then
      perform public.supervisor_mark_reservation_ready(v_candidate_id,coalesce(nullif(trim(p_reason),''),'Verificación física desde control de habitación'));
      if p_status='inspected' then update public.rooms set operational_status='inspected',status='available' where id=p_room_id; end if;
      return jsonb_build_object('room_id',p_room_id,'previous_status',v_room.operational_status,'operational_status',p_status,'commercial_status','available','waiting_reservations_ready',1,'reservation_override',true,'reservation_id',v_candidate_id);
    end if;
  end if;

  perform set_config('app.room_status_reason',coalesce(p_reason,''),true);
  perform set_config('app.room_status_source',coalesce(nullif(p_source,''),'manual'),true);

  update public.rooms
  set operational_status=p_status,
      status=case
        when p_status in ('out_of_service','out_of_inventory') then 'unavailable'
        when p_status='occupied' then 'occupied'
        when status in ('unavailable','occupied') and p_status in ('ready','inspected','dirty','cleaning','clean_pending_inspection') then 'available'
        else status end
  where id=p_room_id;

  if p_status in ('ready','inspected') then
    update public.reservations
    set arrival_status='ready_for_checkin',room_ready_notified_at=coalesce(room_ready_notified_at,now())
    where room_id=p_room_id and arrival_status='waiting_for_room';
    get diagnostics v_waiting=row_count;
  end if;

  return jsonb_build_object('room_id',p_room_id,'previous_status',v_room.operational_status,'operational_status',p_status,'commercial_status',(select status from public.rooms where id=p_room_id),'waiting_reservations_ready',v_waiting,'reservation_override',false);
end;
$function$;

revoke all on function public.set_room_operational_status(uuid,text,text,text) from public, anon;
grant execute on function public.set_room_operational_status(uuid,text,text,text) to authenticated, service_role;

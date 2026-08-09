create or replace function public.supervisor_mark_reservation_ready(
  p_reservation_id uuid,
  p_reason text default 'Verificación física de supervisor'
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

  select * into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_res.room_id is null then raise exception 'La reserva no tiene habitación asignada'; end if;

  if auth.uid() is not null
     and not public.can_access_operational_scope('booking', v_res.location_id) then
    raise exception 'Reserva fuera de su alcance operacional';
  end if;

  select * into v_room
  from public.rooms
  where id = v_res.room_id
  for update;

  if not found then raise exception 'Habitación no encontrada'; end if;

  if v_room.operational_status in ('occupied','out_of_service','maintenance','out_of_inventory') then
    raise exception 'La habitación no puede marcarse lista desde su estado actual: %', v_room.operational_status;
  end if;

  update public.housekeeping_tasks
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         inspection_status = case when requires_inspection then 'approved' else coalesce(inspection_status,'not_required') end,
         inspection_notes = case when requires_inspection then coalesce(v_reason,'Verificación física de supervisor') else inspection_notes end,
         inspected_by = case when requires_inspection then auth.uid() else inspected_by end,
         inspected_at = case when requires_inspection then now() else inspected_at end,
         resolution_notes = concat_ws(' · ', nullif(resolution_notes,''), 'Override supervisor: ' || coalesce(v_reason,'Verificación física de supervisor')),
         updated_at = now()
   where reservation_id = p_reservation_id
     and task_type in ('pre_arrival_preparation','pre_arrival_inspection')
     and status not in ('completed','cancelled');

  update public.rooms
     set operational_status = 'ready',
         status = 'available'
   where id = v_res.room_id;

  update public.reservations
     set arrival_status = 'ready_for_checkin'
   where id = p_reservation_id;

  insert into public.booking_events(
    reservation_id,
    event_type,
    category,
    title,
    description,
    source_type,
    source_id,
    previous_state,
    new_state,
    metadata,
    actor_id,
    occurred_at,
    created_at
  ) values (
    p_reservation_id,
    'supervisor_override',
    'arrival_readiness',
    'Habitación marcada lista para entrada',
    coalesce(v_reason,'Verificación física de supervisor'),
    'reservation',
    p_reservation_id,
    coalesce(v_room.operational_status,'unknown'),
    'ready',
    jsonb_build_object(
      'room_id', v_res.room_id,
      'override', true,
      'reason', coalesce(v_reason,'Verificación física de supervisor')
    ),
    auth.uid(),
    now(),
    now()
  );

  return jsonb_build_object(
    'result','ready_for_checkin',
    'room_status','ready',
    'reservation_id',p_reservation_id,
    'room_id',v_res.room_id
  );
end;
$function$;

revoke all on function public.supervisor_mark_reservation_ready(uuid, text) from public;
revoke all on function public.supervisor_mark_reservation_ready(uuid, text) from anon;
grant execute on function public.supervisor_mark_reservation_ready(uuid, text) to authenticated;
grant execute on function public.supervisor_mark_reservation_ready(uuid, text) to service_role;

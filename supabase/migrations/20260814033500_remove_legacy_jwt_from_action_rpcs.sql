-- Black Swan OS Phase 1: remove redundant legacy JWT reads from action-gated RPCs.
-- These RPCs already authorize through can_app_action(), which resolves against
-- the canonical access model. No production data mutation is performed here.

create or replace function public.book_reservation_activity(
  p_reservation_id uuid,
  p_activity_id uuid,
  p_attendee_count integer default 1,
  p_unit_price numeric default 0,
  p_transport_required boolean default false,
  p_pickup_location text default null,
  p_notes text default null
)
returns public.reservation_activity_bookings
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_activity public.activities%rowtype;
  v_booking public.reservation_activity_bookings%rowtype;
  v_reserved integer;
begin
  if not public.can_app_action('activities.manage') then raise exception 'No autorizado para reservar actividades'; end if;
  if p_attendee_count is null or p_attendee_count <= 0 then raise exception 'Cantidad de asistentes inválida'; end if;
  if not exists(select 1 from public.reservations where id=p_reservation_id and status not in ('cancelled','canceled','void','voided','no_show')) then raise exception 'Reserva no disponible'; end if;
  select * into v_activity from public.activities where id=p_activity_id and status not in ('cancelled','closed');
  if not found then raise exception 'Actividad no disponible'; end if;
  select coalesce(sum(attendee_count),0) into v_reserved from public.reservation_activity_bookings where activity_id=p_activity_id and status not in ('cancelled','no_show');
  if v_activity.capacity is not null and v_reserved+p_attendee_count>v_activity.capacity then raise exception 'Capacidad insuficiente para la actividad'; end if;
  insert into public.reservation_activity_bookings(reservation_id,activity_id,attendee_count,status,unit_price,transport_required,pickup_location,notes,created_by)
  values(p_reservation_id,p_activity_id,p_attendee_count,'confirmed',greatest(coalesce(p_unit_price,0),0),coalesce(p_transport_required,false),nullif(trim(coalesce(p_pickup_location,'')),''),nullif(trim(coalesce(p_notes,'')),''),auth.uid())
  on conflict(reservation_id,activity_id) do update set attendee_count=excluded.attendee_count,unit_price=excluded.unit_price,transport_required=excluded.transport_required,pickup_location=excluded.pickup_location,notes=excluded.notes,status='confirmed',cancelled_at=null,updated_at=now()
  returning * into v_booking;
  return v_booking;
end;
$function$;

create or replace function public.update_reservation_activity_status(
  p_booking_id uuid,
  p_status text,
  p_notes text default null
)
returns public.reservation_activity_bookings
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_booking public.reservation_activity_bookings%rowtype;
begin
  if not public.can_app_action('activities.manage') then raise exception 'No autorizado para actualizar actividades'; end if;
  if p_status not in ('requested','confirmed','checked_in','completed','cancelled','no_show') then raise exception 'Estado inválido'; end if;
  update public.reservation_activity_bookings set status=p_status,notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),cancelled_at=case when p_status='cancelled' then now() else cancelled_at end,completed_at=case when p_status='completed' then now() else completed_at end,updated_at=now() where id=p_booking_id returning * into v_booking;
  if not found then raise exception 'Reserva de actividad no encontrada'; end if;
  return v_booking;
end;
$function$;

create or replace function public.confirm_vehicle_classification(
  p_vehicle_id uuid,
  p_operational_class text,
  p_operational_subtype text default null,
  p_serial_number text default null,
  p_fuel_tracking_enabled boolean default false,
  p_reason text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.vehicles;
  v_previous text;
begin
  if v_actor is null or not public.can_app_action('fleet.classify') then raise exception 'Not authorized to classify fleet assets'; end if;
  if p_operational_class not in ('road_vehicle','machinery','vessel','small_equipment','drone','trailer','other') then raise exception 'Invalid operational class'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Classification reason is required'; end if;
  select operational_class into v_previous from public.vehicles where id=p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found'; end if;
  update public.vehicles set operational_class=p_operational_class,operational_subtype=nullif(trim(coalesce(p_operational_subtype,'')),''),serial_number=coalesce(nullif(trim(coalesce(p_serial_number,'')),''),serial_number),fuel_tracking_enabled=p_fuel_tracking_enabled,classification_status='confirmed',classified_by=v_actor,classified_at=now(),updated_at=now() where id=p_vehicle_id returning * into v_row;
  insert into public.vehicle_classification_events(vehicle_id,previous_class,new_class,subtype,reason,actor_id) values(p_vehicle_id,v_previous,p_operational_class,v_row.operational_subtype,trim(p_reason),v_actor);
  return v_row;
end;
$function$;

create or replace function public.review_fuel_consumption(
  p_fuel_consumption_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.fuel_consumption
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_previous text;
  v_result public.fuel_consumption;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not public.can_app_action('fuel.review') then raise exception 'insufficient privileges'; end if;
  if p_decision not in ('verified','rejected','pending') then raise exception 'invalid decision'; end if;
  if p_decision='rejected' and nullif(trim(coalesce(p_notes,'')),'') is null then raise exception 'rejection notes are required'; end if;
  select validation_status into v_previous from public.fuel_consumption where id=p_fuel_consumption_id for update;
  if not found then raise exception 'fuel record not found'; end if;
  update public.fuel_consumption set validation_status=p_decision,validation_notes=nullif(trim(coalesce(p_notes,'')),''),is_verified=(p_decision='verified'),verified_by=case when p_decision='verified' then v_actor else null end,verified_at=case when p_decision='verified' then now()::timestamp else null end,rejected_by=case when p_decision='rejected' then v_actor else null end,rejected_at=case when p_decision='rejected' then now() else null end,updated_at=now()::timestamp where id=p_fuel_consumption_id returning * into v_result;
  insert into public.fuel_validation_events(fuel_consumption_id,previous_status,new_status,notes,actor_id) values(p_fuel_consumption_id,v_previous,p_decision,nullif(trim(coalesce(p_notes,'')),''),v_actor);
  return v_result;
end;
$function$;

-- Harden arrival preparation when reservation.location_id is present but room_id is missing.

create or replace function public.create_ai_arrival_preparation_proposal(
  p_reservation_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns public.ai_action_proposals
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.reservations%rowtype;
  v_location_id uuid;
  v_location_name text;
  v_room_number text;
  v_existing integer := 0;
  v_proposal public.ai_action_proposals;
begin
  if v_user_id is null then raise exception using errcode='42501', message='unauthorized'; end if;
  if not exists (select 1 from public.ai_agentic_access a where a.user_id=v_user_id and a.enabled=true) then
    raise exception using errcode='42501', message='agentic_access_denied';
  end if;
  if public.current_app_role() not in ('admin','approver') then
    raise exception using errcode='42501', message='arrival_preparation_denied';
  end if;

  select * into v_reservation from public.reservations where id=p_reservation_id for update;
  if not found then raise exception using errcode='P0002', message='reservation_not_found'; end if;
  if coalesce(v_reservation.status,'') in ('cancelled','checked_out','checked-out') then
    raise exception using errcode='22023', message='reservation_not_preparable';
  end if;

  v_location_id := v_reservation.location_id;

  if v_reservation.room_id is not null then
    select r.location_id, r.room_number
    into v_location_id, v_room_number
    from public.rooms r
    where r.id=v_reservation.room_id;

    v_location_id := coalesce(v_reservation.location_id,v_location_id);
  end if;

  if v_location_id is null then
    raise exception using errcode='22023', message='arrival_location_required';
  end if;

  select l.name into v_location_name from public.locations l where l.id=v_location_id;

  select count(*) into v_existing
  from public.hospitality_requests hr
  where hr.reservation_id=v_reservation.id
    and hr.request_type in (
      'luggage_labeling','luggage_distribution','firewood_delivery','light_fireplace',
      'turn_on_heating','arrival_lighting','hot_water_check','drinking_water',
      'amenities','access_check','final_walkthrough'
    );

  insert into public.ai_action_proposals(created_by,capability,payload,context)
  values (
    v_user_id,
    'hospitality.prepare_arrival',
    jsonb_build_object(
      'reservation_id',v_reservation.id,
      'guest_name',v_reservation.guest_name,
      'check_in',v_reservation.check_in,
      'room_id',v_reservation.room_id,
      'room_number',v_room_number,
      'location_id',v_location_id,
      'location_name',v_location_name,
      'bundle_size',11,
      'existing_tasks',v_existing
    ),
    coalesce(p_context,'{}'::jsonb)
  )
  returning * into v_proposal;

  return v_proposal;
end;
$function$;

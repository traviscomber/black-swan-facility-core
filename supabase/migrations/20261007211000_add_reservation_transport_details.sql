alter table public.reservation_logistics
  add column if not exists carrier_name text,
  add column if not exists service_number text,
  add column if not exists origin_destination text,
  add column if not exists pickup_required boolean not null default false,
  add column if not exists transport_coordinator_id uuid references public.employees(id) on delete set null;

create or replace function public.save_reservation_logistics_plan_v2(
  p_reservation_id uuid,
  p_direction text,
  p_transport_mode text,
  p_hub text,
  p_anchor_at timestamptz,
  p_margin_minutes integer,
  p_carrier_name text default null,
  p_service_number text default null,
  p_origin_destination text default null,
  p_pickup_required boolean default false,
  p_transport_coordinator_id uuid default null,
  p_boat_duration_minutes integer default 30,
  p_road_duration_minutes integer default 30,
  p_boat_id uuid default null,
  p_vehicle_id uuid default null,
  p_driver_id uuid default null,
  p_boat_responsible_id uuid default null,
  p_status text default 'planned',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_location_id uuid;
  v_transport_coordinator_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select location_id into v_location_id
  from public.reservations
  where id = p_reservation_id;
  if not found then raise exception 'Reserva no encontrada'; end if;

  if not public.can_app_action('hospitality.operate')
     or not public.can_access_operational_scope('hospitality', v_location_id) then
    raise exception 'No autorizado para modificar la logística de esta reserva';
  end if;

  if p_direction not in ('arrival','departure') then raise exception 'Dirección inválida'; end if;
  if p_transport_mode not in ('flight','bus','private_vehicle','other','unknown') then raise exception 'Modo inválido'; end if;
  if p_hub not in ('pichoy','valdivia_bus_terminal','rebellin','direct','other','unknown') then raise exception 'Destino inválido'; end if;
  if p_status not in ('draft','planned','confirmed','completed','cancelled') then raise exception 'Estado inválido'; end if;
  if p_margin_minutes is not null and p_margin_minutes < 0 then raise exception 'Margen inválido'; end if;
  if p_boat_duration_minutes <= 0 or p_road_duration_minutes < 0 then raise exception 'Duración inválida'; end if;

  v_transport_coordinator_id := p_transport_coordinator_id;
  if v_transport_coordinator_id is null and coalesce(p_pickup_required,false) then
    select e.id into v_transport_coordinator_id
    from public.employees e
    where e.is_active
      and lower(e.name) in ('juan pablo atiaga','juan pablo arteaga')
    order by case when lower(e.name) = 'juan pablo atiaga' then 0 else 1 end
    limit 1;
  end if;

  insert into public.reservation_logistics(
    reservation_id,direction,transport_mode,hub,anchor_at,margin_minutes,
    carrier_name,service_number,origin_destination,pickup_required,transport_coordinator_id,
    boat_duration_minutes,road_duration_minutes,boat_id,vehicle_id,driver_id,
    boat_responsible_id,status,notes,updated_at
  ) values (
    p_reservation_id,p_direction,p_transport_mode,p_hub,p_anchor_at,p_margin_minutes,
    nullif(trim(p_carrier_name),''),
    nullif(trim(p_service_number),''),
    nullif(trim(p_origin_destination),''),
    coalesce(p_pickup_required,false),
    v_transport_coordinator_id,
    p_boat_duration_minutes,p_road_duration_minutes,p_boat_id,p_vehicle_id,p_driver_id,
    p_boat_responsible_id,p_status,p_notes,now()
  )
  on conflict (reservation_id,direction) do update set
    transport_mode=excluded.transport_mode,
    hub=excluded.hub,
    anchor_at=excluded.anchor_at,
    margin_minutes=excluded.margin_minutes,
    carrier_name=excluded.carrier_name,
    service_number=excluded.service_number,
    origin_destination=excluded.origin_destination,
    pickup_required=excluded.pickup_required,
    transport_coordinator_id=excluded.transport_coordinator_id,
    boat_duration_minutes=excluded.boat_duration_minutes,
    road_duration_minutes=excluded.road_duration_minutes,
    boat_id=excluded.boat_id,
    vehicle_id=excluded.vehicle_id,
    driver_id=excluded.driver_id,
    boat_responsible_id=excluded.boat_responsible_id,
    status=excluded.status,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;

  return jsonb_build_object('id',v_id,'saved',true);
end;
$function$;

revoke all on function public.save_reservation_logistics_plan_v2(uuid,text,text,text,timestamptz,integer,text,text,text,boolean,uuid,integer,integer,uuid,uuid,uuid,uuid,text,text) from public, anon;
grant execute on function public.save_reservation_logistics_plan_v2(uuid,text,text,text,timestamptz,integer,text,text,text,boolean,uuid,integer,integer,uuid,uuid,uuid,uuid,text,text) to authenticated, service_role;

create or replace function public.get_reservation_logistics_editor(p_reservation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_location_id uuid;
  v_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('hospitality.operate') then
    raise exception 'Hospitality operation permission required';
  end if;

  select r.location_id into v_location_id
  from public.reservations r
  where r.id = p_reservation_id;

  if not found then raise exception 'Reservation not found'; end if;
  if not public.can_access_operational_scope('hospitality', v_location_id) then
    raise exception 'Hospitality scope denied';
  end if;

  select jsonb_build_object(
    'reservation', (
      select jsonb_build_object(
        'id', r.id,
        'guestName', r.guest_name,
        'checkIn', r.check_in,
        'checkOut', r.check_out,
        'arrivalTime', r.estimated_arrival_time,
        'departureTime', r.estimated_departure_time,
        'status', r.status
      ) from public.reservations r where r.id = p_reservation_id
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'direction', l.direction,
        'transportMode', l.transport_mode,
        'hub', l.hub,
        'anchorAt', l.anchor_at,
        'marginMinutes', l.margin_minutes,
        'carrierName', l.carrier_name,
        'serviceNumber', l.service_number,
        'originDestination', l.origin_destination,
        'pickupRequired', l.pickup_required,
        'transportCoordinatorId', l.transport_coordinator_id,
        'transportCoordinatorName', (select e.name from public.employees e where e.id = l.transport_coordinator_id),
        'boatDurationMinutes', l.boat_duration_minutes,
        'roadDurationMinutes', l.road_duration_minutes,
        'boatId', l.boat_id,
        'vehicleId', l.vehicle_id,
        'driverId', l.driver_id,
        'boatResponsibleId', l.boat_responsible_id,
        'status', l.status,
        'notes', l.notes
      ) order by l.direction)
      from public.reservation_logistics l where l.reservation_id = p_reservation_id
    ), '[]'::jsonb),
    'boats', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'capacity', b.capacity) order by b.name) from public.ports_boats b where b.type='boat' and b.status='operational'), '[]'::jsonb),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', coalesce(v.name, v.code), 'plateNumber', v.plate_number) order by coalesce(v.name, v.code)) from public.vehicles v where v.status='active' and coalesce(v.operational_class,'road_vehicle')='road_vehicle'), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'role', e.role) order by e.name) from public.employees e where e.is_active), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

revoke all on function public.get_reservation_logistics_editor(uuid) from public, anon;
grant execute on function public.get_reservation_logistics_editor(uuid) to authenticated, service_role;


create or replace function public.create_reservation_with_arrival_logistics(
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
  p_invoice_due_date date default null,
  p_arrival_transport_mode text default 'unknown',
  p_arrival_hub text default 'unknown',
  p_arrival_at timestamptz default null,
  p_arrival_carrier_name text default null,
  p_arrival_service_number text default null,
  p_arrival_origin text default null,
  p_arrival_pickup_required boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_reservation_id uuid;
  v_transport_coordinator_id uuid;
begin
  if p_arrival_transport_mode not in ('flight','bus','private_vehicle','other','unknown') then
    return jsonb_build_object('success',false,'error','Modo de transporte inválido','error_code','22023');
  end if;
  if p_arrival_hub not in ('pichoy','valdivia_bus_terminal','rebellin','direct','other','unknown') then
    return jsonb_build_object('success',false,'error','Punto de llegada inválido','error_code','22023');
  end if;

  v_result := public.create_reservation_atomic(
    p_bed_id,p_guest_name,p_guest_email,p_guest_phone,p_check_in,p_check_out,
    p_num_guests,p_total_amount,p_status,p_special_requests,p_invoice_due_date
  );

  if coalesce((v_result->>'success')::boolean,false) is not true then
    return v_result;
  end if;

  v_reservation_id := (v_result->>'reservation_id')::uuid;

  if p_arrival_transport_mode <> 'unknown' then
    if coalesce(p_arrival_pickup_required,false) then
      select e.id into v_transport_coordinator_id
      from public.employees e
      where e.is_active
        and lower(e.name) in ('juan pablo atiaga','juan pablo arteaga')
      order by case when lower(e.name)='juan pablo atiaga' then 0 else 1 end
      limit 1;
    end if;

    insert into public.reservation_logistics(
      reservation_id,direction,transport_mode,hub,anchor_at,margin_minutes,
      carrier_name,service_number,origin_destination,pickup_required,transport_coordinator_id,
      boat_duration_minutes,road_duration_minutes,status,notes,updated_at
    ) values (
      v_reservation_id,'arrival',p_arrival_transport_mode,p_arrival_hub,p_arrival_at,null,
      nullif(trim(p_arrival_carrier_name),''),
      nullif(trim(p_arrival_service_number),''),
      nullif(trim(p_arrival_origin),''),
      coalesce(p_arrival_pickup_required,false),
      v_transport_coordinator_id,
      30,30,'planned',null,now()
    );
  end if;

  return v_result || jsonb_build_object(
    'arrival_logistics_saved', p_arrival_transport_mode <> 'unknown',
    'transport_coordinator_id', v_transport_coordinator_id
  );
exception when others then
  raise;
end;
$function$;

revoke all on function public.create_reservation_with_arrival_logistics(uuid,text,text,text,date,date,integer,numeric,text,text,date,text,text,timestamptz,text,text,text,boolean) from public, anon;
grant execute on function public.create_reservation_with_arrival_logistics(uuid,text,text,text,date,date,integer,numeric,text,text,date,text,text,timestamptz,text,text,text,boolean) to authenticated, service_role;


create or replace function public.get_upcoming_reservation_pickups(
  p_from_date date default current_date,
  p_to_date date default current_date + 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.can_app_action('hospitality.operate') or public.can_app_action('booking.modify')) then
    raise exception 'Operational booking permission required';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'reservationId', r.id,
      'guestName', r.guest_name,
      'checkIn', r.check_in,
      'transportMode', l.transport_mode,
      'carrierName', l.carrier_name,
      'serviceNumber', l.service_number,
      'originDestination', l.origin_destination,
      'hub', l.hub,
      'anchorAt', l.anchor_at,
      'pickupRequired', l.pickup_required,
      'transportCoordinatorId', l.transport_coordinator_id,
      'transportCoordinatorName', e.name,
      'driverId', l.driver_id,
      'vehicleId', l.vehicle_id,
      'status', l.status
    ) order by coalesce(l.anchor_at, r.check_in::timestamptz), r.guest_name)
    from public.reservation_logistics l
    join public.reservations r on r.id=l.reservation_id
    left join public.employees e on e.id=l.transport_coordinator_id
    where l.direction='arrival'
      and l.pickup_required
      and l.status not in ('completed','cancelled')
      and r.status not in ('cancelled','canceled','void','voided')
      and r.check_in between p_from_date and p_to_date
      and public.can_access_operational_scope('hospitality', r.location_id)
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_upcoming_reservation_pickups(date,date) from public, anon;
grant execute on function public.get_upcoming_reservation_pickups(date,date) to authenticated, service_role;

create unique index if not exists hospitality_requests_one_open_logistics_review_idx
on public.hospitality_requests (reservation_id, request_type)
where request_type = 'logistics_review'
  and status in ('pending', 'assigned', 'in_progress', 'blocked')
  and reservation_id is not null;

create or replace function public.reconcile_logistics_after_reservation_move()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_description text;
begin
  if old.check_in is not distinct from new.check_in
     and old.check_out is not distinct from new.check_out
     and old.room_id is not distinct from new.room_id
     and old.bed_id is not distinct from new.bed_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.reservation_logistics logistics
    where logistics.reservation_id = new.id
      and logistics.status in ('planned', 'confirmed')
  ) then
    return new;
  end if;

  update public.reservation_logistics
  set status = 'draft',
      updated_at = now()
  where reservation_id = new.id
    and status in ('planned', 'confirmed');

  v_description := format(
    'Revisar logística después de modificar la reserva. Fechas: %s–%s → %s–%s. Habitación: %s → %s.',
    old.check_in,
    old.check_out,
    new.check_in,
    new.check_out,
    coalesce(old.room_id::text, 'sin asignar'),
    coalesce(new.room_id::text, 'sin asignar')
  );

  update public.hospitality_requests
  set room_id = new.room_id,
      location_id = new.location_id,
      guest_name = new.guest_name,
      guest_phone = new.guest_phone,
      guest_email = new.guest_email,
      description = v_description,
      priority = 'high',
      updated_at = now(),
      data_quality_status = 'verified',
      data_quality_notes = null
  where reservation_id = new.id
    and request_type = 'logistics_review'
    and status in ('pending', 'assigned', 'in_progress', 'blocked');

  if not found then
    insert into public.hospitality_requests (
      reservation_id,
      room_id,
      location_id,
      guest_name,
      guest_phone,
      guest_email,
      request_type,
      category,
      description,
      priority,
      status,
      department,
      source_channel,
      data_quality_status
    ) values (
      new.id,
      new.room_id,
      new.location_id,
      new.guest_name,
      new.guest_phone,
      new.guest_email,
      'logistics_review',
      'hospitality',
      v_description,
      'high',
      'pending',
      'hospitality',
      'booking_calendar',
      'verified'
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists reservations_reconcile_logistics_after_move on public.reservations;
create trigger reservations_reconcile_logistics_after_move
after update of check_in, check_out, room_id, bed_id on public.reservations
for each row
execute function public.reconcile_logistics_after_reservation_move();

create or replace function public.save_reservation_logistics_plan(
  p_reservation_id uuid,
  p_direction text,
  p_transport_mode text,
  p_hub text,
  p_anchor_at timestamptz,
  p_margin_minutes integer,
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
begin
  if p_direction not in ('arrival','departure') then raise exception 'Dirección inválida'; end if;
  if p_transport_mode not in ('flight','bus','private_vehicle','other','unknown') then raise exception 'Modo inválido'; end if;
  if p_hub not in ('pichoy','valdivia_bus_terminal','rebellin','direct','other','unknown') then raise exception 'Destino inválido'; end if;
  if p_status not in ('draft','planned','confirmed','completed','cancelled') then raise exception 'Estado inválido'; end if;
  if p_margin_minutes is not null and p_margin_minutes < 0 then raise exception 'Margen inválido'; end if;
  if p_boat_duration_minutes <= 0 or p_road_duration_minutes < 0 then raise exception 'Duración inválida'; end if;
  if not exists(select 1 from public.reservations where id=p_reservation_id) then raise exception 'Reserva no encontrada'; end if;

  insert into public.reservation_logistics(
    reservation_id,direction,transport_mode,hub,anchor_at,margin_minutes,
    boat_duration_minutes,road_duration_minutes,boat_id,vehicle_id,driver_id,
    boat_responsible_id,status,notes,updated_at
  ) values (
    p_reservation_id,p_direction,p_transport_mode,p_hub,p_anchor_at,p_margin_minutes,
    p_boat_duration_minutes,p_road_duration_minutes,p_boat_id,p_vehicle_id,p_driver_id,
    p_boat_responsible_id,p_status,p_notes,now()
  )
  on conflict (reservation_id,direction) do update set
    transport_mode=excluded.transport_mode,
    hub=excluded.hub,
    anchor_at=excluded.anchor_at,
    margin_minutes=excluded.margin_minutes,
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

  if not exists (
    select 1
    from public.reservation_logistics
    where reservation_id = p_reservation_id
      and status = 'draft'
  ) then
    update public.hospitality_requests
    set status = 'completed',
        completed_at = now(),
        completion_notes = 'Plan logístico revisado y guardado después del cambio de reserva.',
        updated_at = now()
    where reservation_id = p_reservation_id
      and request_type = 'logistics_review'
      and status in ('pending', 'assigned', 'in_progress', 'blocked');
  end if;

  return jsonb_build_object('id',v_id,'saved',true);
end;
$function$;

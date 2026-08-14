-- Black Swan OS Phase 1: harden finance/service authorization
--
-- Continue removal of direct JWT procurement_role reads. Financial wrappers
-- now use the canonical application role and enforce financial location scope.
-- Service/activity/fleet/fuel RPCs already use can_app_action(); remove the
-- redundant legacy role source from those functions.

create or replace function public.create_reservation_invoice(
  p_reservation_id uuid,
  p_due_date date default null,
  p_notes text default null
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
    raise exception 'Insufficient permissions to create invoices';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    select location_id into v_location_id from public.reservations where id=p_reservation_id;
    if not found then raise exception 'Reservation not found'; end if;
    if not public.can_access_operational_scope('finance', v_location_id) then
      raise exception 'Reservation outside financial scope';
    end if;
  end if;

  return public.create_reservation_invoice_internal(p_reservation_id, p_due_date, p_notes);
end;
$function$;

create or replace function public.get_booking_financial_readiness(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_folio jsonb;
  v_open_services integer;
  v_balance numeric;
  v_location_id uuid;
begin
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then raise exception 'No autorizado'; end if;
  if auth.role() <> 'service_role' then
    select location_id into v_location_id from public.reservations where id=p_reservation_id;
    if not found then raise exception 'Reserva no encontrada'; end if;
    if not public.can_access_operational_scope('finance',v_location_id) then raise exception 'Reserva fuera de su alcance financiero'; end if;
  end if;
  v_folio := public.get_reservation_folio(p_reservation_id);
  select count(*) into v_open_services from public.reservation_extras where reservation_id=p_reservation_id and service_status in ('requested','confirmed','assigned','in_progress');
  v_balance := coalesce((v_folio #>> '{summary,balance}')::numeric,0);
  return jsonb_build_object(
    'reservationId',p_reservation_id,
    'openServices',v_open_services,
    'balance',v_balance,
    'paymentStatus',v_folio #>> '{summary,paymentStatus}',
    'canFinalizeInvoice',v_open_services=0,
    'canCheckout',v_open_services=0 and v_balance<=0
  );
end;
$function$;

create or replace function public.get_reservation_final_invoice(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_invoice public.invoices%rowtype;
  v_location_id uuid;
begin
  if auth.role() <> 'service_role' and v_role not in ('admin','approver') then
    raise exception 'No autorizado para consultar factura';
  end if;
  if auth.role() <> 'service_role' then
    select location_id into v_location_id from public.reservations where id=p_reservation_id;
    if not found then raise exception 'Reserva no encontrada'; end if;
    if not public.can_access_operational_scope('finance',v_location_id) then raise exception 'Reserva fuera de su alcance financiero'; end if;
  end if;
  select * into v_invoice from public.invoices
  where reservation_id=p_reservation_id and finalized_at is not null and voided_at is null
  order by finalized_at desc limit 1;
  if not found then return null; end if;
  return to_jsonb(v_invoice);
end;
$function$;

create or replace function public.upsert_booking_extra(
  p_extra_id uuid default null,
  p_name text default null,
  p_category text default null,
  p_unit text default 'unidad',
  p_price numeric default 0,
  p_tax_rate numeric default 0,
  p_service_kind text default 'charge',
  p_requires_scheduling boolean default false,
  p_default_duration_minutes integer default null,
  p_capacity integer default null,
  p_location_id uuid default null,
  p_department text default null,
  p_operational_notes text default null,
  p_is_active boolean default true
)
returns public.booking_extras
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_result public.booking_extras%rowtype;
begin
  if auth.role() <> 'service_role' and v_role <> 'admin' then
    raise exception 'Solo administración puede gestionar el catálogo';
  end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'Nombre requerido'; end if;
  if p_price < 0 or p_price <> trunc(p_price) then raise exception 'El precio CLP debe ser entero y no negativo'; end if;
  if p_tax_rate < 0 or p_tax_rate > 100 then raise exception 'Tasa de impuesto inválida'; end if;
  if p_requires_scheduling and coalesce(p_default_duration_minutes,0) <= 0 then raise exception 'Los servicios programados requieren duración'; end if;
  if p_service_kind not in ('charge','scheduled_service','activity','transport','food_beverage','amenity') then raise exception 'Tipo de servicio inválido'; end if;

  if p_extra_id is null then
    insert into public.booking_extras(name,category,unit,price,tax_rate,service_kind,requires_scheduling,default_duration_minutes,capacity,location_id,department,operational_notes,is_active)
    values(trim(p_name),nullif(trim(coalesce(p_category,'')),''),coalesce(nullif(trim(p_unit),''),'unidad'),p_price,p_tax_rate,p_service_kind,p_requires_scheduling,p_default_duration_minutes,p_capacity,p_location_id,nullif(trim(coalesce(p_department,'')),''),nullif(trim(coalesce(p_operational_notes,'')),''),p_is_active)
    returning * into v_result;
  else
    update public.booking_extras
    set name=trim(p_name), category=nullif(trim(coalesce(p_category,'')),''), unit=coalesce(nullif(trim(p_unit),''),'unidad'), price=p_price,
        tax_rate=p_tax_rate, service_kind=p_service_kind, requires_scheduling=p_requires_scheduling,
        default_duration_minutes=p_default_duration_minutes, capacity=p_capacity, location_id=p_location_id,
        department=nullif(trim(coalesce(p_department,'')),''), operational_notes=nullif(trim(coalesce(p_operational_notes,'')),''),
        is_active=p_is_active, updated_at=now()
    where id=p_extra_id returning * into v_result;
    if not found then raise exception 'Servicio no encontrado'; end if;
  end if;
  return v_result;
end;
$function$;

create or replace function public.add_reservation_service(
  p_reservation_id uuid,
  p_extra_id uuid,
  p_quantity numeric default 1,
  p_scheduled_start timestamptz default null,
  p_assigned_to uuid default null,
  p_notes text default null
)
returns public.reservation_extras
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_extra public.booking_extras%rowtype;
  v_reservation public.reservations%rowtype;
  v_result public.reservation_extras%rowtype;
  v_end timestamptz;
begin
  if not public.can_app_action('services.manage') then raise exception 'No autorizado para agregar servicios a una reserva'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  select * into v_reservation from public.reservations where id=p_reservation_id;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if v_reservation.status in ('cancelled','canceled','void','voided','no_show') then raise exception 'No se pueden agregar servicios a una reserva cerrada'; end if;
  select * into v_extra from public.booking_extras where id=p_extra_id and is_active=true;
  if not found then raise exception 'Servicio no encontrado o inactivo'; end if;
  if v_extra.requires_scheduling and p_scheduled_start is null then raise exception 'Este servicio requiere fecha y hora'; end if;
  v_end := case when p_scheduled_start is not null and v_extra.default_duration_minutes is not null then p_scheduled_start + make_interval(mins=>v_extra.default_duration_minutes) else null end;
  insert into public.reservation_extras(reservation_id,extra_id,name,unit,quantity,unit_price,tax_rate,total_amount,notes,service_status,scheduled_start,scheduled_end,assigned_to,location_id,created_by)
  values(p_reservation_id,v_extra.id,v_extra.name,v_extra.unit,p_quantity,v_extra.price,v_extra.tax_rate,round((p_quantity*v_extra.price*(1+v_extra.tax_rate/100.0))::numeric,2),nullif(trim(coalesce(p_notes,'')),''),case when v_extra.requires_scheduling then 'confirmed' else 'requested' end,p_scheduled_start,v_end,p_assigned_to,v_extra.location_id,auth.uid()) returning * into v_result;
  return v_result;
end;
$function$;

create or replace function public.update_reservation_service_status(
  p_reservation_extra_id uuid,
  p_status text,
  p_assigned_to uuid default null,
  p_notes text default null
)
returns public.reservation_extras
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_result public.reservation_extras%rowtype;
begin
  if not public.can_app_action('services.manage') then raise exception 'No autorizado para actualizar servicios'; end if;
  if p_status not in ('requested','confirmed','assigned','in_progress','completed','cancelled') then raise exception 'Estado de servicio inválido'; end if;
  update public.reservation_extras set service_status=p_status,assigned_to=coalesce(p_assigned_to,assigned_to),notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),completed_at=case when p_status='completed' then coalesce(completed_at,now()) else completed_at end,cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,updated_at=now() where id=p_reservation_extra_id returning * into v_result;
  if not found then raise exception 'Servicio de reserva no encontrado'; end if;
  return v_result;
end;
$function$;

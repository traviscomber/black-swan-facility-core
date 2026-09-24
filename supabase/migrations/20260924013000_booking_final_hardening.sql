-- Booking final hardening: serialize room writes and make payment capture balance-safe.
begin;

create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and conname = 'reservations_no_active_bed_overlap'
  ) then
    alter table public.reservations
      add constraint reservations_no_active_bed_overlap
      exclude using gist (
        bed_id with =,
        daterange(check_in, check_out, '[)') with &&
      )
      where (
        bed_id is not null
        and coalesce(status, 'confirmed') not in ('cancelled','canceled','void','voided','checked_out','checked-out')
      );
  end if;
end
$$;

create or replace function public.ensure_reservation_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_room_id uuid;
begin
  if new.check_out <= new.check_in then
    raise exception 'Reservation check-out must be after check-in';
  end if;

  if coalesce(new.status, 'confirmed') in ('cancelled','canceled','void','voided','checked_out','checked-out') then
    return new;
  end if;

  resolved_room_id := new.room_id;
  if resolved_room_id is null and new.bed_id is not null then
    select room_id into resolved_room_id from public.beds where id = new.bed_id;
  end if;

  if resolved_room_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking-room:' || resolved_room_id::text, 0));
  end if;

  if new.bed_id is not null and exists (
    select 1
    from public.reservations existing
    where existing.id <> coalesce(new.id, gen_random_uuid())
      and existing.bed_id = new.bed_id
      and coalesce(existing.status, 'confirmed') not in ('cancelled','canceled','void','voided','checked_out','checked-out')
      and existing.check_out > existing.check_in
      and daterange(existing.check_in, existing.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
  ) then
    raise exception 'Reservation overlaps another active reservation for this bed';
  end if;

  if resolved_room_id is not null and exists (
    select 1
    from public.room_blocks block
    where block.room_id = resolved_room_id
      and block.status = 'active'
      and daterange(block.start_date, block.end_date, '[)') && daterange(new.check_in, new.check_out, '[)')
  ) then
    raise exception 'Reservation overlaps an active room block';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_room_block_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.end_date <= new.start_date then
    raise exception 'Room block end date must be after start date';
  end if;

  if new.status <> 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('booking-room:' || new.room_id::text, 0));

  if exists (
    select 1
    from public.reservations reservation
    left join public.beds bed on bed.id = reservation.bed_id
    where coalesce(reservation.room_id, bed.room_id) = new.room_id
      and coalesce(reservation.status, 'confirmed') not in ('cancelled','canceled','void','voided','checked_out','checked-out')
      and reservation.check_out > reservation.check_in
      and daterange(reservation.check_in, reservation.check_out, '[)') && daterange(new.start_date, new.end_date, '[)')
  ) then
    raise exception 'Room block overlaps an active reservation';
  end if;

  return new;
end;
$$;

create or replace function public.record_reservation_payment(
  p_reservation_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_transaction_id text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id uuid;
  v_folio jsonb;
  v_location_id uuid;
  v_balance numeric;
begin
  if auth.uid() is null and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Authentication required';
  end if;
  if not public.can_app_action('finance.record_payment') then
    raise exception 'No autorizado para registrar pagos';
  end if;

  select location_id
  into v_location_id
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'Reserva no encontrada'; end if;

  if coalesce(auth.role(),'') <> 'service_role'
     and not public.can_access_operational_scope('hospitality', v_location_id) then
    raise exception 'No autorizado para registrar pagos en esta ubicación';
  end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  if nullif(trim(coalesce(p_payment_method,'')),'') is null then raise exception 'Método de pago requerido'; end if;

  v_folio := public.get_reservation_folio(p_reservation_id);
  v_balance := coalesce((v_folio->'summary'->>'balance')::numeric, 0);

  if v_balance <= 0 then
    raise exception 'La reserva no tiene saldo pendiente';
  end if;
  if p_amount > v_balance then
    raise exception 'El pago supera el saldo pendiente';
  end if;

  insert into public.payments(
    reservation_id, amount, payment_method, payment_status,
    transaction_id, paid_at, created_by, notes
  )
  values(
    p_reservation_id, p_amount, trim(p_payment_method), 'paid',
    nullif(trim(coalesce(p_transaction_id,'')),''),
    now(), auth.uid(), nullif(trim(coalesce(p_notes,'')),'')
  )
  returning id into v_payment_id;

  perform public.sync_reservation_payment_status(p_reservation_id);
  v_folio := public.get_reservation_folio(p_reservation_id);

  return jsonb_build_object('paymentId',v_payment_id,'folio',v_folio);
end;
$$;

commit;

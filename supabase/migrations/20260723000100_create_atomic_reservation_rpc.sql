-- Phase 2: Atomic Reservation Creation
-- Creates reservation, validates conflicts, and generates invoice in a single transaction
-- Ensures data consistency: if invoice fails, reservation is rolled back

begin;

create or replace function public.create_reservation_atomic(
  p_bed_id uuid,
  p_guest_name text,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_check_in date,
  p_check_out date,
  p_num_guests integer default 1,
  p_total_amount numeric default 0,
  p_status text default 'confirmed',
  p_special_requests text default null,
  p_invoice_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_reservation public.reservations%rowtype;
  v_invoice jsonb;
  v_conflict_count integer;
  v_room_id uuid;
  v_error_message text;
begin
  -- Validate required inputs
  if p_bed_id is null then
    raise exception 'bed_id is required';
  end if;

  if p_check_out <= p_check_in then
    raise exception 'check_out date must be after check_in date';
  end if;

  if p_guest_name is null or trim(p_guest_name) = '' then
    raise exception 'guest_name is required';
  end if;

  -- Get room_id from bed
  select room_id into v_room_id
  from public.beds
  where id = p_bed_id;

  if v_room_id is null then
    raise exception 'Bed not found or does not have a room assigned';
  end if;

  -- Check for room blocks
  if exists (
    select 1
    from public.room_blocks rb
    where rb.room_id = v_room_id
      and rb.status = 'active'
      and daterange(rb.start_date, rb.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'Reservation dates overlap with an active room block';
  end if;

  -- Check for conflicting reservations (race condition protection)
  select count(*)
  into v_conflict_count
  from public.reservations r
  where r.bed_id = p_bed_id
    and r.status not in ('cancelled', 'canceled', 'void', 'voided')
    and p_check_in < r.check_out
    and p_check_out > r.check_in;

  if v_conflict_count > 0 then
    raise exception 'This bed is already booked for the selected dates. Conflict detected at %.', current_timestamp;
  end if;

  -- Insert reservation (will trigger conflict check once more)
  insert into public.reservations (
    bed_id,
    guest_name,
    guest_email,
    guest_phone,
    check_in,
    check_out,
    num_guests,
    total_amount,
    status,
    special_requests
  ) values (
    p_bed_id,
    trim(p_guest_name),
    nullif(trim(coalesce(p_guest_email, '')), ''),
    nullif(trim(coalesce(p_guest_phone, '')), ''),
    p_check_in,
    p_check_out,
    greatest(1, coalesce(p_num_guests, 1)),
    greatest(0, coalesce(p_total_amount, 0)),
    coalesce(p_status, 'confirmed'),
    nullif(trim(coalesce(p_special_requests, '')), '')
  ) returning * into v_reservation;

  v_reservation_id := v_reservation.id;

  -- Create invoice atomically (will roll back entire transaction if it fails)
  begin
    select json_build_object(
      'created', true,
      'invoice_id', (public.create_reservation_invoice(v_reservation_id, coalesce(p_invoice_due_date, current_date + 7), null)::jsonb ->> 'invoice')::json
    ) into v_invoice;
  exception when others then
    v_error_message := 'Invoice creation failed: ' || SQLERRM;
    raise exception '%', v_error_message;
  end;

  -- Return success with full reservation and invoice data
  return jsonb_build_object(
    'success', true,
    'reservation', to_jsonb(v_reservation),
    'reservation_id', v_reservation_id,
    'invoice_created', true,
    'message', 'Reservation created successfully with invoice'
  );

exception when others then
  return jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_code', SQLSTATE,
    'timestamp', now()
  );
end;
$$;

-- Grant execute permission to authenticated users and service role
revoke all on function public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date) from public;
revoke execute on function public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date) from anon;
grant execute on function public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date) to authenticated;
grant execute on function public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date) to service_role;

-- Add comment documenting the atomic nature
comment on function public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date)
is 'Atomically creates a reservation with conflict detection and automatic invoice generation. All-or-nothing operation: if invoice creation fails, entire reservation is rolled back.';

commit;

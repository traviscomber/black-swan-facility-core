-- Prevent invalid and conflicting booking writes without rewriting historical data.

begin;

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

  if coalesce(new.status, 'confirmed') in ('cancelled', 'checked_out', 'checked-out') then
    return new;
  end if;

  if new.bed_id is not null and exists (
    select 1
    from public.reservations existing
    where existing.id <> coalesce(new.id, gen_random_uuid())
      and existing.bed_id = new.bed_id
      and coalesce(existing.status, 'confirmed') not in ('cancelled', 'checked_out', 'checked-out')
      and existing.check_out > existing.check_in
      and daterange(existing.check_in, existing.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
  ) then
    raise exception 'Reservation overlaps another active reservation for this bed';
  end if;

  resolved_room_id := new.room_id;
  if resolved_room_id is null and new.bed_id is not null then
    select room_id into resolved_room_id from public.beds where id = new.bed_id;
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

drop trigger if exists reservations_ensure_integrity on public.reservations;
create trigger reservations_ensure_integrity
before insert or update of bed_id, room_id, check_in, check_out, status
on public.reservations
for each row execute function public.ensure_reservation_integrity();

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

  if exists (
    select 1
    from public.reservations reservation
    left join public.beds bed on bed.id = reservation.bed_id
    where coalesce(reservation.room_id, bed.room_id) = new.room_id
      and coalesce(reservation.status, 'confirmed') not in ('cancelled', 'checked_out', 'checked-out')
      and reservation.check_out > reservation.check_in
      and daterange(reservation.check_in, reservation.check_out, '[)') && daterange(new.start_date, new.end_date, '[)')
  ) then
    raise exception 'Room block overlaps an active reservation';
  end if;

  return new;
end;
$$;

drop trigger if exists room_blocks_ensure_integrity on public.room_blocks;
create trigger room_blocks_ensure_integrity
before insert or update of room_id, start_date, end_date, status
on public.room_blocks
for each row execute function public.ensure_room_block_integrity();

create unique index if not exists invoices_one_active_per_reservation_idx
on public.invoices (reservation_id)
where reservation_id is not null
  and coalesce(status, 'draft') not in ('void', 'cancelled');

create sequence if not exists public.invoice_number_seq start with 1001;

select setval(
  'public.invoice_number_seq',
  greatest(
    1000,
    coalesce((
      select max(nullif(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::bigint)
      from public.invoices
    ), 1000)
  ),
  true
);

create or replace function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'INV-' || nextval('public.invoice_number_seq')::text;
$$;

revoke all on function public.next_invoice_number() from public;
grant execute on function public.next_invoice_number() to authenticated;

commit;

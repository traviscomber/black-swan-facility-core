-- Phase 1: Double-booking prevention
-- Prevents concurrent bookings of the same bed during overlapping date ranges
-- Solves race condition where multiple admins can book same bed/dates simultaneously

begin;

-- 1. Create function to detect overlapping reservations
create or replace function public.check_reservation_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_count integer;
begin
  -- Skip check for cancelled reservations
  if new.status in ('cancelled', 'canceled', 'void', 'voided') then
    return new;
  end if;

  -- Check if dates are valid
  if new.check_out <= new.check_in then
    raise exception 'check_out date must be after check_in date';
  end if;

  -- Look for overlapping reservations on the same bed
  -- Date ranges overlap if: check_in < other.check_out AND check_out > other.check_in
  select count(*)
  into v_conflict_count
  from public.reservations
  where id != new.id
    and bed_id = new.bed_id
    and status not in ('cancelled', 'canceled', 'void', 'voided')
    and new.check_in < check_out
    and new.check_out > check_in;

  if v_conflict_count > 0 then
    raise exception 'This bed is already booked for the selected dates. Please choose different dates or a different bed.';
  end if;

  return new;
end;
$$;

-- 2. Create trigger on INSERT and UPDATE
drop trigger if exists prevent_reservation_conflicts on public.reservations;

create trigger prevent_reservation_conflicts
before insert or update of bed_id, check_in, check_out, status
on public.reservations
for each row
execute function public.check_reservation_conflict();

-- 3. Add comment documenting the prevention mechanism
comment on function public.check_reservation_conflict()
is 'Prevents double-booking by checking for overlapping reservations on the same bed';

-- 4. Create index to speed up conflict checking (important for performance with many reservations)
create index if not exists idx_reservations_bed_dates
on public.reservations(bed_id, check_in, check_out)
where status not in ('cancelled', 'canceled', 'void', 'voided');

commit;

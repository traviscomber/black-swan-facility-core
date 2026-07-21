create or replace function public.ensure_reservation_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
begin
  if new.status in ('cancelled', 'checked_out', 'checked-out') then
    return new;
  end if;

  select room_id into target_room_id
  from public.beds
  where id = new.bed_id;

  if target_room_id is null then
    raise exception 'Unable to resolve room for bed %', new.bed_id;
  end if;

  if exists (
    select 1
    from public.room_blocks rb
    where rb.room_id = target_room_id
      and rb.status = 'active'
      and daterange(rb.start_date, rb.end_date, '[)') && daterange(new.check_in, new.check_out, '[)')
  ) then
    raise exception 'Reservation dates overlap an active room block';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_prevent_room_block_overlap on public.reservations;

create trigger reservations_prevent_room_block_overlap
before insert or update of bed_id, check_in, check_out, status
on public.reservations
for each row
execute function public.ensure_reservation_not_blocked();

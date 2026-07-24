create or replace function public.validate_reservation_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.check_in is null or new.check_out is null or new.check_out <= new.check_in then
    raise exception using
      errcode = '22007',
      message = 'Reservation check-out must be after check-in';
  end if;

  if coalesce(new.status, '') not in ('cancelled', 'canceled') and exists (
    select 1
    from public.reservations existing
    where existing.bed_id = new.bed_id
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(existing.status, '') not in ('cancelled', 'canceled')
      and existing.check_in is not null
      and existing.check_out is not null
      and existing.check_out > existing.check_in
      and daterange(existing.check_in, existing.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Reservation overlaps an existing active reservation for this bed';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_validate_integrity on public.reservations;
create trigger reservations_validate_integrity
before insert or update of bed_id, check_in, check_out, status
on public.reservations
for each row
execute function public.validate_reservation_integrity();

create index if not exists reservations_bed_dates_active_idx
on public.reservations (bed_id, check_in, check_out)
where status not in ('cancelled', 'canceled');

comment on function public.validate_reservation_integrity() is
'Prevents invalid reservation date ranges and overlapping active reservations at the database boundary.';

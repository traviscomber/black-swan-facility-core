-- Prevent cross-property contamination inside a booking shift handover.

create or replace function public.guard_booking_handover_item_consistency()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_handover_location uuid;
  v_reservation_location uuid;
begin
  select location_id into v_handover_location
  from public.booking_shift_handovers
  where id = new.handover_id;

  if v_handover_location is null then
    raise exception 'Handover not found or missing property';
  end if;

  if new.reservation_id is not null then
    select location_id into v_reservation_location
    from public.reservations
    where id = new.reservation_id;

    if v_reservation_location is null then
      raise exception 'Reservation not found or missing property';
    end if;
    if v_reservation_location <> v_handover_location then
      raise exception 'Handover item reservation belongs to a different property';
    end if;
  end if;

  if new.source_type = 'reservation_logistics' then
    if new.source_id is null or new.reservation_id is null then
      raise exception 'Logistics handover item requires source and reservation';
    end if;
    if not exists (
      select 1
      from public.reservation_logistics l
      where l.id = new.source_id
        and l.reservation_id = new.reservation_id
    ) then
      raise exception 'Logistics source does not match reservation';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_booking_handover_item_consistency() from public, anon, authenticated;
grant execute on function public.guard_booking_handover_item_consistency() to service_role;

drop trigger if exists booking_handover_items_guard_consistency on public.booking_handover_items;
create trigger booking_handover_items_guard_consistency
before insert or update of handover_id,reservation_id,source_type,source_id
on public.booking_handover_items
for each row execute function public.guard_booking_handover_item_consistency();

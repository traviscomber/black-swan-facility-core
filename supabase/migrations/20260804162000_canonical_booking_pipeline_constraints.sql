-- Canonical booking and room-operation state contract.
-- This migration validates state vocabularies without rewriting production records.

alter table public.reservations
  drop constraint if exists reservations_status_canonical_check,
  add constraint reservations_status_canonical_check
  check (status is null or status = any (array[
    'pending', 'confirmed', 'checked_in', 'checked-in',
    'checked_out', 'checked-out', 'cancelled', 'canceled',
    'no_show', 'void', 'voided'
  ]));

alter table public.reservations
  drop constraint if exists reservations_arrival_status_canonical_check,
  add constraint reservations_arrival_status_canonical_check
  check (arrival_status is null or arrival_status = any (array[
    'not_arrived', 'expected', 'arrived', 'waiting_for_room',
    'ready_for_checkin', 'checked_in', 'departed', 'no_show'
  ]));

alter table public.rooms
  drop constraint if exists rooms_operational_status_canonical_check,
  add constraint rooms_operational_status_canonical_check
  check (operational_status = any (array[
    'ready', 'dirty', 'cleaning', 'clean_pending_inspection',
    'inspected', 'occupied', 'out_of_service', 'out_of_inventory'
  ]));

comment on column public.reservations.status is
  'Canonical commercial/stay lifecycle status. Do not use for room readiness or arrival queue state.';
comment on column public.reservations.arrival_status is
  'Canonical guest-arrival state: expected, arrived, waiting_for_room, ready_for_checkin, checked_in, departed, or no_show.';
comment on column public.rooms.operational_status is
  'Canonical physical room condition independent of commercial inventory status.';

create or replace function public.validate_canonical_booking_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if old.status in ('checked_out', 'checked-out', 'cancelled', 'canceled', 'void', 'voided', 'no_show')
       and new.status not in (old.status) then
      raise exception 'La reserva está cerrada y no puede volver a un estado activo';
    end if;

    if new.status in ('checked_in', 'checked-in')
       and coalesce(new.arrival_status, '') not in ('ready_for_checkin', 'checked_in') then
      raise exception 'El check-in requiere arrival_status ready_for_checkin o checked_in';
    end if;

    if new.status in ('checked_out', 'checked-out')
       and old.status not in ('checked_in', 'checked-in') then
      raise exception 'El check-out requiere una reserva previamente alojada';
    end if;
  end if;

  if new.status in ('checked_in', 'checked-in') then
    new.arrival_status := 'checked_in';
  elsif new.status in ('checked_out', 'checked-out') then
    new.arrival_status := 'departed';
  elsif new.status = 'no_show' then
    new.arrival_status := 'no_show';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_validate_canonical_transition on public.reservations;
create trigger reservations_validate_canonical_transition
before update of status, arrival_status on public.reservations
for each row execute function public.validate_canonical_booking_transition();

revoke all on function public.validate_canonical_booking_transition() from public, anon, authenticated;

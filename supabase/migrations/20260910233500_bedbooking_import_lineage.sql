create unique index if not exists reservations_bedbooking_ref_unique
  on public.reservations (bedbooking_ref)
  where bedbooking_ref is not null;

create table if not exists public.booking_import_records (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  entity_type text not null,
  external_ref text not null,
  observed_at timestamptz not null default now(),
  source_period text,
  payload jsonb not null default '{}'::jsonb,
  reconciliation_status text not null default 'observed',
  canonical_table text,
  canonical_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, entity_type, external_ref)
);

alter table public.booking_import_records enable row level security;

alter table public.booking_settings
  add column if not exists prepayment_percent numeric not null default 0;

alter table public.booking_settings
  add column if not exists prepayment_due_days_before_arrival integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_settings_prepayment_percent_check'
      and conrelid = 'public.booking_settings'::regclass
  ) then
    alter table public.booking_settings
      add constraint booking_settings_prepayment_percent_check
      check (prepayment_percent >= 0 and prepayment_percent <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_settings_prepayment_due_days_check'
      and conrelid = 'public.booking_settings'::regclass
  ) then
    alter table public.booking_settings
      add constraint booking_settings_prepayment_due_days_check
      check (prepayment_due_days_before_arrival >= 0);
  end if;
end $$;

create or replace function public.ensure_reservation_not_blocked()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  target_room_id uuid;
begin
  if new.status in ('cancelled', 'canceled', 'checked_out', 'checked-out', 'void', 'voided') then
    return new;
  end if;

  if new.room_id is not null then
    target_room_id := new.room_id;
  elsif new.bed_id is not null then
    select room_id into target_room_id from public.beds where id = new.bed_id;
  end if;

  if target_room_id is not null then
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
  end if;

  if new.booking_type = 'LOCATION' and new.location_id is not null then
    if exists (
      select 1
      from public.room_blocks rb
      join public.rooms r on r.id = rb.room_id
      where r.location_id = new.location_id
        and rb.status = 'active'
        and daterange(rb.start_date, rb.end_date, '[)') && daterange(new.check_in, new.check_out, '[)')
    ) then
      raise exception 'Location reservation dates overlap an active room block';
    end if;
    return new;
  end if;

  raise exception 'Unable to resolve reservation inventory target';
end;
$function$;

drop trigger if exists reservations_prevent_room_block_overlap on public.reservations;
create trigger reservations_prevent_room_block_overlap
before insert or update of bed_id, room_id, location_id, booking_type, check_in, check_out, status
on public.reservations
for each row execute function public.ensure_reservation_not_blocked();

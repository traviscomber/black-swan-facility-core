create or replace function public.booking_source_edit_policy(p_source text)
returns text
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when lower(trim(coalesce(p_source, ''))) in (
      '', 'internal', 'manual', 'direct', 'phone', 'email', 'walk_in', 'walk-in',
      'website', 'canonical_event_xls', 'legacy_import'
    ) then 'editable'
    when lower(trim(coalesce(p_source, ''))) ~ '(ical|airbnb|booking([.]|_)?com|expedia|vrbo|agoda|trip([.]|_)?com|ota|channel(_|-)?manager)'
      then 'external_read_only'
    else 'review'
  end;
$function$;

create table if not exists public.booking_change_commands (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('move', 'resize', 'swap')),
  primary_reservation_id uuid not null references public.reservations(id) on delete cascade,
  secondary_reservation_id uuid references public.reservations(id) on delete set null,
  before_payload jsonb not null default '{}'::jsonb,
  after_payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  reason text,
  source_type text not null default 'booking_calendar',
  status text not null default 'applied' check (status in ('applied', 'undone', 'expired', 'failed')),
  undo_expires_at timestamptz,
  undone_at timestamptz,
  undone_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_change_commands_primary_idx
  on public.booking_change_commands(primary_reservation_id, created_at desc);
create index if not exists booking_change_commands_secondary_idx
  on public.booking_change_commands(secondary_reservation_id, created_at desc)
  where secondary_reservation_id is not null;

alter table public.booking_change_commands enable row level security;

drop policy if exists booking_change_commands_select on public.booking_change_commands;
create policy booking_change_commands_select
on public.booking_change_commands
for select
to authenticated
using (
  actor_id = auth.uid()
  or public.current_app_role() in ('admin', 'approver')
);

revoke insert, update, delete on public.booking_change_commands from anon, authenticated;
grant select on public.booking_change_commands to authenticated;

create or replace function public.booking_swap_excluded_ids()
returns uuid[]
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_raw text;
begin
  v_raw := current_setting('app.booking_swap_ids', true);
  if v_raw is null or trim(v_raw) = '' then
    return '{}'::uuid[];
  end if;
  return string_to_array(v_raw, ',')::uuid[];
exception when others then
  return '{}'::uuid[];
end;
$function$;

create or replace function public.is_booking_inventory_available(
  p_bed_id uuid,
  p_room_id uuid,
  p_location_id uuid,
  p_check_in date,
  p_check_out date,
  p_exclude_reservation_id uuid default null
)
returns boolean
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_room_id uuid;
  v_location_id uuid;
  v_swap_excluded uuid[] := public.booking_swap_excluded_ids();
begin
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    return false;
  end if;

  v_room_id := public.reservation_scope_room_id(p_bed_id, p_room_id);

  select coalesce(p_location_id, r.location_id)
    into v_location_id
  from public.rooms r
  where r.id = v_room_id;

  if exists (
    select 1
    from public.room_blocks rb
    where rb.status = 'active'
      and rb.room_id = v_room_id
      and daterange(rb.start_date, rb.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.reservations existing
    left join public.beds existing_bed on existing_bed.id = existing.bed_id
    where existing.id <> coalesce(p_exclude_reservation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and not (existing.id = any(v_swap_excluded))
      and coalesce(existing.status, '') not in (
        'cancelled', 'canceled', 'void', 'voided', 'checked_out', 'checked-out', 'no_show'
      )
      and existing.check_out > existing.check_in
      and daterange(existing.check_in, existing.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
      and (
        (p_bed_id is not null and existing.bed_id = p_bed_id)
        or (
          v_room_id is not null
          and coalesce(existing.room_id, existing_bed.room_id) = v_room_id
          and (existing.bed_id is null or p_bed_id is null)
        )
        or (
          v_location_id is not null
          and existing.booking_type = 'LOCATION'
          and existing.location_id = v_location_id
        )
      )
  ) then
    return false;
  end if;

  return true;
end;
$function$;

create or replace function public.validate_reservation_integrity()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_room_id uuid;
  v_location_id uuid;
begin
  if new.check_in is null or new.check_out is null or new.check_out <= new.check_in then
    raise exception using
      errcode = '22007',
      message = 'Reservation check-out must be after check-in';
  end if;

  if coalesce(new.status, '') in (
    'cancelled', 'canceled', 'void', 'voided', 'checked_out', 'checked-out', 'no_show'
  ) then
    return new;
  end if;

  v_room_id := public.reservation_scope_room_id(new.bed_id, new.room_id);
  select coalesce(new.location_id, room.location_id)
    into v_location_id
  from public.rooms room
  where room.id = v_room_id;

  -- Lock the hierarchy in a stable order so concurrent writes cannot silently double-book.
  if v_location_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking:location:' || v_location_id::text, 0));
  end if;
  if v_room_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking:room:' || v_room_id::text, 0));
  end if;
  if new.bed_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking:bed:' || new.bed_id::text, 0));
  end if;

  if not public.is_booking_inventory_available(
    new.bed_id,
    v_room_id,
    v_location_id,
    new.check_in,
    new.check_out,
    new.id
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Reservation conflicts with an active reservation or room block';
  end if;

  return new;
end;
$function$;

create or replace function public.check_reservation_conflict()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_conflict_count integer;
  v_swap_excluded uuid[] := public.booking_swap_excluded_ids();
begin
  if new.status in ('cancelled', 'canceled', 'void', 'voided') then
    return new;
  end if;

  if new.check_out <= new.check_in then
    raise exception 'check_out date must be after check_in date';
  end if;

  select count(*)
    into v_conflict_count
  from public.reservations
  where id != new.id
    and not (id = any(v_swap_excluded))
    and bed_id = new.bed_id
    and status not in ('cancelled', 'canceled', 'void', 'voided', 'checked_out', 'checked-out', 'no_show')
    and new.check_in < check_out
    and new.check_out > check_in;

  if v_conflict_count > 0 then
    raise exception 'This bed is already booked for the selected dates. Please choose different dates or a different bed.';
  end if;

  return new;
end;
$function$;

create or replace function public.ensure_reservation_integrity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  resolved_room_id uuid;
  v_swap_excluded uuid[] := public.booking_swap_excluded_ids();
begin
  if new.check_out <= new.check_in then
    raise exception 'Reservation check-out must be after check-in';
  end if;

  if coalesce(new.status, 'confirmed') in (
    'cancelled', 'canceled', 'void', 'voided', 'checked_out', 'checked-out', 'no_show'
  ) then
    return new;
  end if;

  if new.bed_id is not null and exists (
    select 1
    from public.reservations existing
    where existing.id <> coalesce(new.id, gen_random_uuid())
      and not (existing.id = any(v_swap_excluded))
      and existing.bed_id = new.bed_id
      and coalesce(existing.status, 'confirmed') not in (
        'cancelled', 'canceled', 'void', 'voided', 'checked_out', 'checked-out', 'no_show'
      )
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
$function$;

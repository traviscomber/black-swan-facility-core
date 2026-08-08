-- Blackswan Facility Core — Stage 2 hardening contract
--
-- Purpose:
--   Reconcile the final data-integrity / authorization contract established in production
--   during the Stage 2 hardening cycle (2026-08-07/08) into versioned repository SQL.
--
-- Provenance:
--   The exact production execution history remains available in
--   supabase_migrations.schema_migrations, including version, name and statements[].
--   This migration records the final reproducible contract rather than replaying every
--   intermediate hardening step.
--
-- Required production lineage range:
--   20260807232152 tighten_rooms_beds_hospitality_write_scope
--   through
--   20260808015731 split_operational_event_read_contract
--
-- Invariants enforced by this contract:
--   1. no SECURITY DEFINER function is executable by anon/PUBLIC;
--   2. canonical reservation scope follows bed -> room -> location;
--   3. destructive booking/finance FK chains preserve history;
--   4. payment ledger changes synchronize reservation payment projection;
--   5. imported canonical-event reservations have durable participant lineage;
--   6. AI sessions/executions have explicit ownership for new records;
--   7. operational event financial totals are not globally readable.

-- -----------------------------------------------------------------------------
-- 1. Globally remove anonymous execution from SECURITY DEFINER functions.
--    Explicit authenticated/service_role grants remain function-specific.
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon', f.nspname, f.proname, f.args);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Canonical reservation scope and collision guard.
-- -----------------------------------------------------------------------------
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
    raise exception using errcode='22007', message='Reservation check-out must be after check-in';
  end if;

  if new.bed_id is not null then
    select b.room_id into v_room_id from public.beds b where b.id=new.bed_id;
    if v_room_id is null then
      raise exception using errcode='23503', message='Reservation bed is missing or is not assigned to a room';
    end if;
    new.room_id := v_room_id;
  else
    v_room_id := new.room_id;
  end if;

  if v_room_id is not null then
    select r.location_id into v_location_id from public.rooms r where r.id=v_room_id;
    if v_location_id is not null then new.location_id := v_location_id; end if;
  else
    v_location_id := new.location_id;
  end if;

  if coalesce(new.status,'') in ('cancelled','canceled','void','voided','checked_out','checked-out','no_show') then
    return new;
  end if;

  if v_location_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking:location:'||v_location_id::text,0));
  end if;
  if v_room_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking:room:'||v_room_id::text,0));
  end if;
  if new.bed_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('booking:bed:'||new.bed_id::text,0));
  end if;

  if not public.is_booking_inventory_available(new.bed_id,v_room_id,v_location_id,new.check_in,new.check_out,new.id) then
    raise exception using errcode='23P01', message='Reservation conflicts with an active reservation or room block';
  end if;
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Preserve historical booking / finance records.
-- -----------------------------------------------------------------------------
alter table public.beds drop constraint if exists beds_room_id_fkey;
alter table public.beds add constraint beds_room_id_fkey foreign key(room_id) references public.rooms(id) on delete restrict;

alter table public.reservations drop constraint if exists reservations_bed_id_fkey;
alter table public.reservations add constraint reservations_bed_id_fkey foreign key(bed_id) references public.beds(id) on delete set null;

alter table public.housekeeping_tasks drop constraint if exists housekeeping_tasks_room_id_fkey;
alter table public.housekeeping_tasks add constraint housekeeping_tasks_room_id_fkey foreign key(room_id) references public.rooms(id) on delete set null;

alter table public.hospitality_requests drop constraint if exists hospitality_requests_room_id_fkey;
alter table public.hospitality_requests add constraint hospitality_requests_room_id_fkey foreign key(room_id) references public.rooms(id) on delete set null;

alter table public.payments drop constraint if exists payments_reservation_id_fkey;
alter table public.payments add constraint payments_reservation_id_fkey foreign key(reservation_id) references public.reservations(id) on delete set null;

alter table public.invoices drop constraint if exists invoices_reservation_id_fkey;
alter table public.invoices add constraint invoices_reservation_id_fkey foreign key(reservation_id) references public.reservations(id) on delete set null;

alter table public.reservation_logistics drop constraint if exists reservation_logistics_reservation_id_fkey;
alter table public.reservation_logistics add constraint reservation_logistics_reservation_id_fkey foreign key(reservation_id) references public.reservations(id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 4. Payment ledger -> reservation payment projection.
-- -----------------------------------------------------------------------------
create or replace function public.trg_sync_reservation_payment_projection()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op='DELETE' then
    if old.reservation_id is not null then perform public.sync_reservation_payment_status(old.reservation_id); end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.reservation_id is distinct from new.reservation_id and old.reservation_id is not null then
    perform public.sync_reservation_payment_status(old.reservation_id);
  end if;
  if new.reservation_id is not null then perform public.sync_reservation_payment_status(new.reservation_id); end if;
  return new;
end;
$function$;

revoke all on function public.trg_sync_reservation_payment_projection() from public,anon,authenticated;
grant execute on function public.trg_sync_reservation_payment_projection() to service_role;
drop trigger if exists payments_sync_reservation_payment_projection on public.payments;
create trigger payments_sync_reservation_payment_projection
after insert or update or delete on public.payments
for each row execute function public.trg_sync_reservation_payment_projection();

-- -----------------------------------------------------------------------------
-- 5. Durable event-import lineage.
-- -----------------------------------------------------------------------------
create unique index if not exists operational_event_participants_event_source_reference_uidx
on public.operational_event_participants(event_id,source_reference)
where nullif(trim(source_reference),'') is not null;

alter table public.reservations add column if not exists source_participant_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.reservations'::regclass
      and conname='reservations_source_participant_id_fkey'
  ) then
    alter table public.reservations
      add constraint reservations_source_participant_id_fkey
      foreign key(source_participant_id)
      references public.operational_event_participants(id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists reservations_source_participant_id_uidx
on public.reservations(source_participant_id)
where source_participant_id is not null;

create index if not exists reservations_source_source_participant_idx
on public.reservations(source,source_participant_id)
where source_participant_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.reservations'::regclass
      and conname='reservations_event_import_requires_lineage'
  ) then
    alter table public.reservations
      add constraint reservations_event_import_requires_lineage
      check (coalesce(source,'direct') <> 'canonical_event_xls' or source_participant_id is not null)
      not valid;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. AI ownership baseline for all new records.
-- -----------------------------------------------------------------------------
alter table public.ai_sessions add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.ai_agent_executions add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
create index if not exists ai_sessions_created_by_idx on public.ai_sessions(created_by);
create index if not exists ai_agent_executions_created_by_idx on public.ai_agent_executions(created_by);

-- -----------------------------------------------------------------------------
-- 7. Split operational event read contract: shared operations vs finance.
-- -----------------------------------------------------------------------------
drop policy if exists operational_events_read on public.operational_events;
drop policy if exists operational_events_financial_read on public.operational_events;
create policy operational_events_financial_read
on public.operational_events
for select
to authenticated
using (public.can_app_action('finance.adjust') or public.can_app_action('procurement.operate'));

create or replace function public.get_operational_events_operational()
returns table(
  id uuid,
  event_code text,
  name text,
  start_date date,
  end_date date,
  location_name text,
  status text,
  participant_count integer,
  person_days numeric,
  source_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('hospitality.operate') then raise exception 'Hospitality operation permission required'; end if;
  return query
  select e.id,e.event_code,e.name,e.start_date,e.end_date,e.location_name,e.status,
         e.participant_count,e.person_days,e.source_status,e.created_at,e.updated_at
  from public.operational_events e
  order by e.start_date desc,e.name;
end;
$$;
revoke all on function public.get_operational_events_operational() from public,anon;
grant execute on function public.get_operational_events_operational() to authenticated,service_role;

-- -----------------------------------------------------------------------------
-- 8. Drift sentinels. The migration fails if the final Stage 2 contract regresses.
-- -----------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('public',p.oid,'EXECUTE'));
  if v_count <> 0 then raise exception 'Stage 2 drift: % SECURITY DEFINER functions remain executable by anon/PUBLIC',v_count; end if;

  select count(*) into v_count
  from pg_policy p
  join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and p.polroles @> array[(select oid from pg_roles where rolname='authenticated')]::oid[]
    and p.polcmd in ('a','w','d','*')
    and (pg_get_expr(p.polqual,p.polrelid)='true' or pg_get_expr(p.polwithcheck,p.polrelid)='true');
  if v_count <> 0 then raise exception 'Stage 2 drift: % authenticated write policies remain literally open',v_count; end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='ai_sessions' and column_name='created_by') then
    raise exception 'Stage 2 drift: ai_sessions.created_by missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='reservations' and column_name='source_participant_id') then
    raise exception 'Stage 2 drift: reservations.source_participant_id missing';
  end if;
end $$;

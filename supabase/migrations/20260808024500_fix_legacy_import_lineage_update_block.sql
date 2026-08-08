-- Stage 5 regression fix.
-- A NOT VALID CHECK still applies to UPDATEs of legacy rows, which froze all
-- canonical_event_xls reservations that predate source_participant_id.
-- Enforce lineage on new imported reservations only; legacy rows remain explicit
-- reconciliation debt until a human-approved link is applied.

alter table public.reservations
  drop constraint if exists reservations_event_import_requires_lineage;

create or replace function public.require_new_event_import_lineage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source='canonical_event_xls' and new.source_participant_id is null then
    raise exception using
      errcode='23514',
      message='New canonical_event_xls reservations require source_participant_id lineage';
  end if;
  return new;
end;
$$;

revoke all on function public.require_new_event_import_lineage() from public,anon,authenticated;
grant execute on function public.require_new_event_import_lineage() to service_role;

drop trigger if exists reservations_require_new_event_import_lineage on public.reservations;
create trigger reservations_require_new_event_import_lineage
before insert on public.reservations
for each row execute function public.require_new_event_import_lineage();

comment on function public.require_new_event_import_lineage() is
'Requires durable participant lineage for new canonical_event_xls inserts without freezing pre-lineage legacy reservations during ordinary updates.';

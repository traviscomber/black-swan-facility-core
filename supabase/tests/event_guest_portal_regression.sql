-- Black Swan event guest portal regression gate.
-- Run after migrations on a development/preview database.

begin;

do $test$
begin
  if not has_function_privilege('anon','public.resolve_event_guest_portal(text,text)','EXECUTE') then
    raise exception 'EVENT PORTAL REGRESSION: anon cannot resolve a curated portal';
  end if;
  if not has_function_privilege('anon','public.register_event_portal_guest(text,text,text,text,text,text,text,text,jsonb,boolean,boolean)','EXECUTE') then
    raise exception 'EVENT PORTAL REGRESSION: anon cannot register through the controlled RPC';
  end if;
  if has_table_privilege('anon','public.event_guest_portals','SELECT') then
    raise exception 'EVENT PORTAL REGRESSION: anon has direct portal table SELECT';
  end if;
  if has_table_privilege('anon','public.event_portal_invites','SELECT') then
    raise exception 'EVENT PORTAL REGRESSION: anon has direct invite table SELECT';
  end if;
  if has_table_privilege('anon','public.event_portal_registrations','SELECT') then
    raise exception 'EVENT PORTAL REGRESSION: anon has direct registration table SELECT';
  end if;
end;
$test$;

do $test$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='register_event_portal_guest' limit 1;
  if v_def is null then raise exception 'EVENT PORTAL REGRESSION: registration RPC missing'; end if;
  if v_def not ilike '%event_member_roles%' then raise exception 'EVENT PORTAL REGRESSION: registration no longer resolves a canonical Member host'; end if;
  if v_def not ilike '%guest_invitations%' then raise exception 'EVENT PORTAL REGRESSION: registration no longer creates the Member-linked guest invitation'; end if;
  if v_def not ilike '%consent_data_processing%' then raise exception 'EVENT PORTAL REGRESSION: data-processing consent gate missing'; end if;
end;
$test$;

do $test$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='resolve_event_guest_portal' limit 1;
  if v_def is null then raise exception 'EVENT PORTAL REGRESSION: resolver RPC missing'; end if;
  if v_def ilike '%select * from public.members%' or v_def ilike '%select * from public.guests%' then
    raise exception 'EVENT PORTAL REGRESSION: public resolver exposes internal People records';
  end if;
end;
$test$;

rollback;

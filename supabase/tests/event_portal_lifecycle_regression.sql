-- Event portal lifecycle regression gate.
-- Run after event portal migrations on a development/preview database.

begin;

do $test$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='register_event_portal_guest' limit 1;
  if v_def is null then raise exception 'EVENT PORTAL REGRESSION: registration RPC missing'; end if;
  if v_def not ilike '%waitlist%' then raise exception 'EVENT PORTAL REGRESSION: registration no longer supports waitlist'; end if;
  if v_def not ilike '%event_portal_reserved_seats%' then raise exception 'EVENT PORTAL REGRESSION: registration is not seat-based'; end if;
  if v_def ilike '%stripe%' or v_def ilike '%transbank%' or v_def ilike '%khipu%' then
    raise exception 'EVENT PORTAL REGRESSION: payment processor activated inside registration RPC';
  end if;
end;
$test$;

do $test$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='check_in_event_portal_guest' limit 1;
  if v_def is null then raise exception 'EVENT PORTAL REGRESSION: check-in RPC missing'; end if;
  if v_def not ilike '%can_guest_enter%' then raise exception 'EVENT PORTAL REGRESSION: check-in bypasses Member-on-ground rule'; end if;
  if has_function_privilege('anon','public.check_in_event_portal_guest(text)','EXECUTE') then
    raise exception 'EVENT PORTAL REGRESSION: anon can execute event check-in';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege('anon','public.get_event_portal_management(uuid)','EXECUTE') then
    raise exception 'EVENT PORTAL REGRESSION: anon can access event management data';
  end if;
  if has_function_privilege('anon','public.revoke_event_portal_invite(uuid,text)','EXECUTE') then
    raise exception 'EVENT PORTAL REGRESSION: anon can revoke event invites';
  end if;
  if has_function_privilege('anon','public.set_event_portal_registration_status(uuid,text,text)','EXECUTE') then
    raise exception 'EVENT PORTAL REGRESSION: anon can mutate registration status';
  end if;
end;
$test$;

do $test$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='close_event_portal_and_start_education' limit 1;
  if v_def is null then raise exception 'EVENT PORTAL REGRESSION: closeout RPC missing'; end if;
  if v_def not ilike '%education_collections%' or v_def not ilike '%processing%' then
    raise exception 'EVENT PORTAL REGRESSION: event closeout no longer starts Education processing';
  end if;
end;
$test$;

rollback;

-- Regression gate for event Guest Discovery consent, scope and token handling.
do $gate$
declare
  v_guest_intent_def text;
  v_match_def text;
  v_guest_workspace_def text;
begin
  if to_regclass('public.discovery_guest_sessions') is null then
    raise exception 'Guest discovery sessions missing';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='discovery_guest_sessions'
      and column_name in ('token','session_token','raw_token')
  ) then raise exception 'Raw guest discovery tokens must not be stored'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='discovery_guest_sessions' and column_name='token_sha256'
  ) then raise exception 'Guest discovery hash column missing'; end if;

  select pg_get_functiondef('public.create_guest_event_discovery_intent(text,text,text,text,text)'::regprocedure)
  into v_guest_intent_def;
  if v_guest_intent_def not ilike '%network_only%' or v_guest_intent_def not ilike '%incognito%' then
    raise exception 'Guest discovery privacy allowlist missing';
  end if;
  if v_guest_intent_def ilike '%privacy not in (''network_only'',''incognito'',''private'')%' then
    raise exception 'Guest private/global scope must not be accepted';
  end if;

  select pg_get_functiondef('public.run_discovery_matching(uuid)'::regprocedure) into v_match_def;
  if v_match_def not ilike '%owner_guest_id is distinct from%' then
    raise exception 'Guest identity separation missing from matching';
  end if;
  if v_match_def not ilike '%lexical_v2_guest%' then
    raise exception 'Guest-aware matching version missing';
  end if;

  select pg_get_functiondef('public.get_guest_discovery_workspace(text)'::regprocedure) into v_guest_workspace_def;
  if v_guest_workspace_def not ilike '%Private intent — mutual interest required%' then
    raise exception 'Guest counterpart intent redaction missing';
  end if;
  if v_guest_workspace_def not ilike '%Potential Black Swan connection%' then
    raise exception 'Guest counterpart identity redaction missing';
  end if;

  if not has_function_privilege('anon','public.start_guest_event_discovery_session(text,text,uuid,text)','EXECUTE') then
    raise exception 'Public event guest must be able to opt into Discovery';
  end if;
  if not has_function_privilege('anon','public.create_guest_event_discovery_intent(text,text,text,text,text)','EXECUTE') then
    raise exception 'Public opted-in guest must be able to create event intent';
  end if;
end;
$gate$;

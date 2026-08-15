-- Regression gate for event lifecycle refinements.

do $regression$
declare
  v_def text;
begin
  select pg_get_functiondef('public.get_events_workspace()'::regprocedure) into v_def;
  if position('e.name' in v_def)=0 then raise exception 'get_events_workspace must use canonical operational_events.name'; end if;
  if position('event_portal_registrations' in v_def)=0 then raise exception 'get_events_workspace must include registration metrics'; end if;

  select pg_get_functiondef('public.handle_event_portal_closeout()'::regprocedure) into v_def;
  if position('consent_marketing=true' in replace(v_def,' ',''))=0 then raise exception 'Post-event follow-up must require marketing consent'; end if;
  if position('event_education_followup_tasks' in v_def)=0 then raise exception 'Event closeout must seed Education follow-up work'; end if;

  if has_function_privilege('anon','public.queue_event_notification(uuid,text,text,text,jsonb,uuid,uuid,uuid,timestamptz)','EXECUTE') then
    raise exception 'Anonymous users must not queue event notifications';
  end if;

  if has_table_privilege('anon','public.event_notification_outbox','SELECT')
     or has_table_privilege('anon','public.event_notification_outbox','INSERT')
     or has_table_privilege('anon','public.event_notification_outbox','UPDATE') then
    raise exception 'Anonymous users must not access notification outbox';
  end if;

  select string_agg(pg_get_functiondef(p.oid), E'\n') into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('register_event_portal_guest','get_event_funnel_metrics','handle_event_portal_closeout');
  if lower(coalesce(v_def,'')) like '%stripe%' or lower(coalesce(v_def,'')) like '%khipu%' or lower(coalesce(v_def,'')) like '%transbank%' then
    raise exception 'Payment processors must remain inactive in event lifecycle functions';
  end if;
end;
$regression$;

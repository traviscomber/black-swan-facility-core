-- Regression gate for Black Swan Discovery privacy and mutual-consent invariants.
do $gate$
declare
  v_match_def text;
  v_workspace_def text;
  v_response_def text;
begin
  if to_regclass('public.discovery_networks') is null then raise exception 'Discovery networks missing'; end if;
  if to_regclass('public.discovery_intents') is null then raise exception 'Discovery intents missing'; end if;
  if to_regclass('public.discovery_opportunities') is null then raise exception 'Discovery opportunities missing'; end if;

  if has_function_privilege('anon','public.create_discovery_intent(text,text,text,uuid[],text,timestamptz)','EXECUTE') then
    raise exception 'Anon must not create discovery intents';
  end if;
  if has_function_privilege('anon','public.run_discovery_matching(uuid)','EXECUTE') then
    raise exception 'Anon must not run discovery matching';
  end if;
  if has_function_privilege('anon','public.respond_discovery_opportunity(uuid,text)','EXECUTE') then
    raise exception 'Anon must not respond to discovery opportunities';
  end if;
  if has_function_privilege('anon','public.get_discovery_workspace()','EXECUTE') then
    raise exception 'Anon must not read discovery workspace';
  end if;

  select pg_get_functiondef('public.run_discovery_matching(uuid)'::regprocedure) into v_match_def;
  if v_match_def not ilike '%privacy<>''private''%' and v_match_def not ilike '%privacy <> ''private''%' then
    raise exception 'Private intents must be excluded from matching';
  end if;
  if v_match_def not ilike '%owner_member_id=v_member_id%' then
    raise exception 'Member-triggered matching must be scoped to the member';
  end if;

  select pg_get_functiondef('public.get_discovery_workspace()'::regprocedure) into v_workspace_def;
  if v_workspace_def not ilike '%Private intent — mutual interest required%' then
    raise exception 'Incognito intent redaction missing';
  end if;
  if v_workspace_def not ilike '%opp.status<>''mutual''%' and v_workspace_def not ilike '%opp.status <> ''mutual''%' then
    raise exception 'Incognito identity must remain hidden before mutual acceptance';
  end if;

  select pg_get_functiondef('public.respond_discovery_opportunity(uuid,text)'::regprocedure) into v_response_def;
  if v_response_def not ilike '%v_a_status=''accepted'' and v_b_status=''accepted''%' and v_response_def not ilike '%v_a_status = ''accepted'' and v_b_status = ''accepted''%' then
    raise exception 'Mutual acceptance invariant missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='discovery_opportunities'
      and policyname='discovery_opportunities_read'
      and qual ilike '%current_discovery_member_id%'
  ) then raise exception 'Discovery opportunity RLS is not participant scoped'; end if;
end;
$gate$;

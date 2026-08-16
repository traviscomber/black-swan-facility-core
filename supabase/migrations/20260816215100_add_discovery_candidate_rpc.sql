create or replace function public.get_discovery_candidate_pairs(p_network_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_member_id uuid := public.current_discovery_member_id();
  v_network_type text;
  v_event_id uuid;
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  select network_type,event_id into v_network_type,v_event_id
  from public.discovery_networks where id=p_network_id and status='active';
  if v_network_type is null then raise exception 'DISCOVERY_NETWORK_NOT_FOUND'; end if;

  if public.current_app_role() not in ('admin','approver') and v_network_type='event' and not exists (
    select 1 from public.event_member_roles emr
    where emr.event_id=v_event_id and emr.member_id=v_member_id
  ) then raise exception 'DISCOVERY_NETWORK_FORBIDDEN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'intent_a_id',a.id,
      'intent_b_id',b.id,
      'intent_a_type',a.intent_type,
      'intent_b_type',b.intent_type,
      'intent_a_summary',a.summary,
      'intent_b_summary',b.summary,
      'intent_a_details',a.details,
      'intent_b_details',b.details,
      'lexical_score',round(extensions.similarity(lower(a.summary),lower(b.summary))::numeric,4),
      'complementary',((a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek'))
    ) order by extensions.similarity(lower(a.summary),lower(b.summary)) desc)
    from public.discovery_intent_networks ain
    join public.discovery_intents a on a.id=ain.intent_id
    join public.discovery_intent_networks bin on bin.network_id=ain.network_id and bin.intent_id<>ain.intent_id
    join public.discovery_intents b on b.id=bin.intent_id
    where ain.network_id=p_network_id
      and a.id::text < b.id::text
      and (a.owner_member_id is distinct from b.owner_member_id or a.owner_guest_id is distinct from b.owner_guest_id)
      and a.status='active' and b.status='active'
      and a.privacy<>'private' and b.privacy<>'private'
      and (a.valid_until is null or a.valid_until>now())
      and (b.valid_until is null or b.valid_until>now())
      and (extensions.similarity(lower(a.summary),lower(b.summary)) >= 0.08
        or ((a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek')))
      and (public.current_app_role() in ('admin','approver') or a.owner_member_id=v_member_id or b.owner_member_id=v_member_id)
    limit 40
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.get_discovery_candidate_pairs(uuid) from public;
grant execute on function public.get_discovery_candidate_pairs(uuid) to authenticated;

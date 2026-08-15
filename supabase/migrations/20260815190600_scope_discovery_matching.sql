-- Members may refresh only matches that involve their own intents.
-- Admin/Approver may refresh the complete private network.

create or replace function public.run_discovery_matching(p_network_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_created integer := 0;
  v_network_type text;
  v_event_id uuid;
  v_member_id uuid;
  v_is_admin boolean;
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  v_member_id := public.current_discovery_member_id();
  v_is_admin := public.current_app_role() in ('admin','approver');

  select network_type,event_id into v_network_type,v_event_id
  from public.discovery_networks where id=p_network_id and status='active';
  if v_network_type is null then raise exception 'DISCOVERY_NETWORK_NOT_FOUND'; end if;

  if not v_is_admin then
    if v_member_id is null then raise exception 'DISCOVERY_MEMBER_REQUIRED'; end if;
    if v_network_type='event' and not exists (
      select 1 from public.event_member_roles emr
      where emr.event_id=v_event_id and emr.member_id=v_member_id
    ) then raise exception 'DISCOVERY_NETWORK_FORBIDDEN'; end if;
  end if;

  insert into public.discovery_opportunities(network_id,intent_a_id,intent_b_id,confidence,reason,match_method,expires_at)
  select p_network_id,
         least(a.id,b.id),greatest(a.id,b.id),
         least(0.99, greatest(0.25,
           similarity(lower(a.summary),lower(b.summary))
           + case
               when (a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek') then 0.25
               when a.intent_type='interest' and b.intent_type='interest' then 0.10
               else 0.00
             end
         ))::numeric(5,4),
         case
           when (a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek')
             then 'Complementary current needs and offers align inside this private network.'
           else 'Current interests show meaningful overlap inside this private network.'
         end,
         'lexical_v1',
         now()+interval '30 days'
  from public.discovery_intent_networks ain
  join public.discovery_intents a on a.id=ain.intent_id
  join public.discovery_intent_networks bin on bin.network_id=ain.network_id and bin.intent_id<>ain.intent_id
  join public.discovery_intents b on b.id=bin.intent_id
  where ain.network_id=p_network_id
    and a.id::text < b.id::text
    and a.owner_member_id<>b.owner_member_id
    and (v_is_admin or a.owner_member_id=v_member_id or b.owner_member_id=v_member_id)
    and a.status='active' and b.status='active'
    and a.privacy<>'private' and b.privacy<>'private'
    and (a.valid_until is null or a.valid_until>now())
    and (b.valid_until is null or b.valid_until>now())
    and (
      similarity(lower(a.summary),lower(b.summary)) >= 0.25
      or (((a.intent_type='seek' and b.intent_type='offer') or (a.intent_type='offer' and b.intent_type='seek'))
          and similarity(lower(a.summary),lower(b.summary)) >= 0.10)
    )
  on conflict(network_id,intent_a_id,intent_b_id) do update set
    confidence=excluded.confidence,
    reason=excluded.reason,
    updated_at=now(),
    expires_at=excluded.expires_at
  where public.discovery_opportunities.status='pending';
  get diagnostics v_created = row_count;

  return jsonb_build_object('network_id',p_network_id,'candidates_processed',v_created,'match_method','lexical_v1','scope',case when v_is_admin then 'network' else 'member' end);
end;
$function$;

revoke all on function public.run_discovery_matching(uuid) from public;
grant execute on function public.run_discovery_matching(uuid) to authenticated;

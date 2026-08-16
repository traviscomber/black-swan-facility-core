-- Make member Discovery workspace understand guest counterparts without weakening
-- the existing incognito/mutual-consent boundary.

create or replace function public.get_discovery_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_member_id uuid;
  v_is_admin boolean;
  v_result jsonb;
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  v_member_id := public.current_discovery_member_id();
  v_is_admin := public.current_app_role() in ('admin','approver');

  select jsonb_build_object(
    'member_id',v_member_id,
    'networks',coalesce((select jsonb_agg(to_jsonb(n) order by n.network_type,n.title) from (
      select dn.id,dn.network_type,dn.event_id,dn.title,dn.prompt,dn.status
      from public.discovery_networks dn
      where dn.status='active'
        and (
          dn.network_type='club'
          or v_is_admin
          or exists(select 1 from public.event_member_roles emr where emr.event_id=dn.event_id and emr.member_id=v_member_id)
        )
    ) n),'[]'::jsonb),
    'my_intents',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from (
      select di.id,di.intent_type,di.summary,di.details,di.privacy,di.status,di.source,di.valid_from,di.valid_until,di.created_at,
        coalesce((select jsonb_agg(jsonb_build_object('id',dn.id,'title',dn.title,'type',dn.network_type))
          from public.discovery_intent_networks din join public.discovery_networks dn on dn.id=din.network_id where din.intent_id=di.id),'[]'::jsonb) as networks
      from public.discovery_intents di where di.owner_member_id=v_member_id
    ) i),'[]'::jsonb),
    'opportunities',coalesce((select jsonb_agg(to_jsonb(o) order by o.confidence desc,o.created_at desc) from (
      select opp.id,opp.network_id,dn.title as network_title,opp.confidence,opp.reason,opp.status,opp.party_a_status,opp.party_b_status,opp.created_at,opp.introduced_at,
        case when a.owner_member_id=v_member_id then b.owner_member_id else a.owner_member_id end as counterpart_member_id,
        case when a.owner_member_id=v_member_id then b.owner_guest_id else a.owner_guest_id end as counterpart_guest_id,
        case
          when opp.status<>'mutual' then 'Potential Black Swan connection'
          when a.owner_member_id=v_member_id then coalesce(mb.full_name,gb.name,'Black Swan participant')
          else coalesce(ma.full_name,ga.name,'Black Swan participant')
        end as counterpart_name,
        case when a.owner_member_id=v_member_id then b.intent_type else a.intent_type end as counterpart_intent_type,
        case
          when (case when a.owner_member_id=v_member_id then b.privacy else a.privacy end)='incognito' and opp.status<>'mutual'
            then 'Private intent — mutual interest required'
          else case when a.owner_member_id=v_member_id then b.summary else a.summary end
        end as counterpart_intent,
        case when a.owner_member_id=v_member_id then opp.party_a_status else opp.party_b_status end as my_status,
        case when a.owner_member_id=v_member_id then opp.party_b_status else opp.party_a_status end as counterpart_status
      from public.discovery_opportunities opp
      join public.discovery_intents a on a.id=opp.intent_a_id
      join public.discovery_intents b on b.id=opp.intent_b_id
      left join public.members ma on ma.id=a.owner_member_id
      left join public.members mb on mb.id=b.owner_member_id
      left join public.guests ga on ga.id=a.owner_guest_id
      left join public.guests gb on gb.id=b.owner_guest_id
      join public.discovery_networks dn on dn.id=opp.network_id
      where opp.status<>'expired'
        and (v_is_admin or a.owner_member_id=v_member_id or b.owner_member_id=v_member_id)
    ) o),'[]'::jsonb),
    'summary',jsonb_build_object(
      'active_intents',(select count(*) from public.discovery_intents where owner_member_id=v_member_id and status='active'),
      'pending_opportunities',(select count(*) from public.discovery_opportunities opp join public.discovery_intents a on a.id=opp.intent_a_id join public.discovery_intents b on b.id=opp.intent_b_id where opp.status='pending' and (a.owner_member_id=v_member_id or b.owner_member_id=v_member_id)),
      'mutual_introductions',(select count(*) from public.discovery_opportunities opp join public.discovery_intents a on a.id=opp.intent_a_id join public.discovery_intents b on b.id=opp.intent_b_id where opp.status='mutual' and (a.owner_member_id=v_member_id or b.owner_member_id=v_member_id))
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_discovery_workspace() from public;
grant execute on function public.get_discovery_workspace() to authenticated;

comment on function public.get_discovery_workspace() is 'Member/admin Discovery read model supporting member and opted-in event guest counterparts; identities remain hidden before mutual consent.';

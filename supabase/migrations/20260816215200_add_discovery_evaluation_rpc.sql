create or replace function public.record_discovery_evaluation(
  p_network_id uuid,
  p_intent_a_id uuid,
  p_intent_b_id uuid,
  p_confidence numeric,
  p_reason text,
  p_match_method text,
  p_evaluation_model text,
  p_evaluation_version text
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_a uuid := least(p_intent_a_id,p_intent_b_id);
  v_b uuid := greatest(p_intent_a_id,p_intent_b_id);
  v_id uuid;
begin
  if not public.can_use_discovery() then raise exception 'DISCOVERY_FORBIDDEN'; end if;
  if p_confidence < 0.55 or p_confidence > 1 then raise exception 'DISCOVERY_EVALUATION_CONFIDENCE_INVALID'; end if;
  if length(trim(coalesce(p_reason,''))) < 10 then raise exception 'DISCOVERY_EVALUATION_REASON_REQUIRED'; end if;
  if not exists (
    select 1 from public.discovery_intent_networks x
    join public.discovery_intent_networks y on y.network_id=x.network_id
    where x.network_id=p_network_id and x.intent_id=v_a and y.intent_id=v_b
  ) then raise exception 'DISCOVERY_CANDIDATE_SCOPE_INVALID'; end if;

  insert into public.discovery_opportunities(
    network_id,intent_a_id,intent_b_id,confidence,reason,match_method,expires_at,
    evaluation_model,evaluated_at,evaluation_version
  ) values (
    p_network_id,v_a,v_b,least(0.99,greatest(0.55,p_confidence)),left(trim(p_reason),600),
    coalesce(nullif(trim(p_match_method),''),'semantic_ai_v1'),now()+interval '30 days',
    left(coalesce(p_evaluation_model,'unknown'),120),now(),left(coalesce(p_evaluation_version,'v1'),40)
  )
  on conflict(network_id,intent_a_id,intent_b_id) do update set
    confidence=excluded.confidence,
    reason=excluded.reason,
    match_method=excluded.match_method,
    evaluation_model=excluded.evaluation_model,
    evaluated_at=excluded.evaluated_at,
    evaluation_version=excluded.evaluation_version,
    expires_at=excluded.expires_at,
    updated_at=now()
  where public.discovery_opportunities.status='pending'
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.record_discovery_evaluation(uuid,uuid,uuid,numeric,text,text,text,text) from public;
grant execute on function public.record_discovery_evaluation(uuid,uuid,uuid,numeric,text,text,text,text) to authenticated;

-- Enrich the operational workspaces with responsibility and engagement history.

create or replace function public.get_orchard_kitchen_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_corp uuid;
  v_result jsonb;
begin
  select id into v_corp from public.legal_entities where code='BS_CORPORACION' and is_active;
  if v_corp is null or not public.can_access_legal_entity(v_corp,'operate') then raise exception 'ORCHARD_KITCHEN_FORBIDDEN'; end if;

  select jsonb_build_object(
    'costs', coalesce((select jsonb_agg(to_jsonb(x) order by x.incurred_on desc nulls last) from (
      select c.id,c.cost_domain,c.amount_clp,c.incurred_on,c.description,c.source_type,c.status,
        c.procurement_request_id,c.accounting_document_id,c.event_id,c.supplier_id,s.name as supplier_name
      from public.corporacion_operating_cost_allocations c
      left join public.suppliers s on s.id=c.supplier_id
      where c.legal_entity_id=v_corp
    ) x),'[]'::jsonb),
    'responsibilities', coalesce((select jsonb_agg(to_jsonb(x) order by x.employee_name,x.responsibility_type) from (
      select r.id,r.employee_id,e.name as employee_name,e.role as employee_role,r.responsibility_type,r.scope,
        r.can_request_purchases,r.can_manage_costs,r.effective_from,r.effective_to,r.source_reference,r.notes
      from public.corporacion_operating_responsibilities r
      join public.employees e on e.id=r.employee_id
      where r.legal_entity_id=v_corp and r.scope='orchard_kitchen'
        and (r.effective_to is null or r.effective_to>=current_date)
    ) x),'[]'::jsonb),
    'summary', jsonb_build_object(
      'orchard_clp', coalesce((select sum(c.amount_clp) from public.corporacion_operating_cost_allocations c where c.legal_entity_id=v_corp and c.cost_domain='orchard' and c.status='approved'),0),
      'kitchen_clp', coalesce((select sum(c.amount_clp) from public.corporacion_operating_cost_allocations c where c.legal_entity_id=v_corp and c.cost_domain='kitchen' and c.status='approved'),0),
      'shared_clp', coalesce((select sum(c.amount_clp) from public.corporacion_operating_cost_allocations c where c.legal_entity_id=v_corp and c.cost_domain='shared' and c.status='approved'),0),
      'pending_review', (select count(*) from public.corporacion_operating_cost_allocations c where c.legal_entity_id=v_corp and c.status in ('proposed','reviewed')),
      'active_responsibilities', (select count(*) from public.corporacion_operating_responsibilities r where r.legal_entity_id=v_corp and r.scope='orchard_kitchen' and (r.effective_to is null or r.effective_to>=current_date)),
      'purchasers', (select count(*) from public.corporacion_operating_responsibilities r where r.legal_entity_id=v_corp and r.scope='orchard_kitchen' and r.can_request_purchases and (r.effective_to is null or r.effective_to>=current_date))
    )
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.get_event_provider_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_corp uuid;
  v_result jsonb;
begin
  select id into v_corp from public.legal_entities where code='BS_CORPORACION' and is_active;
  if v_corp is null or not public.can_access_legal_entity(v_corp,'view') then raise exception 'EVENT_PROVIDERS_FORBIDDEN'; end if;

  select jsonb_build_object(
    'providers', coalesce((select jsonb_agg(to_jsonb(x) order by x.supplier_name,x.service_category) from (
      select p.id,p.supplier_id,s.name as supplier_name,p.service_category,p.service_description,p.coverage_area,p.capacity_notes,
        p.compliance_status,p.preferred,p.is_active,p.verified_at,
        (select count(*) from public.event_service_provider_engagements e where e.provider_profile_id=p.id) as event_count,
        (select max(e.created_at) from public.event_service_provider_engagements e where e.provider_profile_id=p.id) as last_engagement_at
      from public.event_service_provider_profiles p
      join public.suppliers s on s.id=p.supplier_id
      where p.legal_entity_id=v_corp
    ) x),'[]'::jsonb),
    'engagements', coalesce((select jsonb_agg(to_jsonb(x) order by x.event_date desc nulls last,x.created_at desc) from (
      select eg.id,eg.event_id,ev.name as event_name,ev.start_date as event_date,eg.provider_profile_id,s.name as provider_name,
        p.service_category,eg.scope_of_work,eg.estimated_amount_clp,eg.actual_amount_clp,eg.status,
        eg.procurement_request_id,eg.budget_item_id,eg.created_at
      from public.event_service_provider_engagements eg
      join public.operational_events ev on ev.id=eg.event_id
      join public.event_service_provider_profiles p on p.id=eg.provider_profile_id
      join public.suppliers s on s.id=p.supplier_id
      where p.legal_entity_id=v_corp
    ) x),'[]'::jsonb),
    'summary', jsonb_build_object(
      'active', (select count(*) from public.event_service_provider_profiles p where p.legal_entity_id=v_corp and p.is_active),
      'approved', (select count(*) from public.event_service_provider_profiles p where p.legal_entity_id=v_corp and p.compliance_status='approved'),
      'unverified', (select count(*) from public.event_service_provider_profiles p where p.legal_entity_id=v_corp and p.compliance_status='unverified'),
      'preferred', (select count(*) from public.event_service_provider_profiles p where p.legal_entity_id=v_corp and p.preferred),
      'engagements', (select count(*) from public.event_service_provider_engagements eg join public.event_service_provider_profiles p on p.id=eg.provider_profile_id where p.legal_entity_id=v_corp),
      'open_engagements', (select count(*) from public.event_service_provider_engagements eg join public.event_service_provider_profiles p on p.id=eg.provider_profile_id where p.legal_entity_id=v_corp and eg.status not in ('delivered','cancelled'))
    )
  ) into v_result;
  return v_result;
end;
$function$;

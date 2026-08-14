-- Black Swan OS: canonical workspace/read-model boundaries for Ed's operating model.
-- These functions expose curated, privacy-safe data to Cloudflare Workers.
-- They do not fabricate canonical source data, intercompany commercial terms, or accounting values.

create or replace function public.can_view_corporacion_workspace()
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select exists (
    select 1 from public.legal_entities le
    where le.code = 'BS_CORPORACION'
      and public.can_access_legal_entity(le.id, 'view')
  ) or exists (
    select 1
    from public.member_auth_links mal
    join public.members m on m.id = mal.member_id
    join public.legal_entities le on le.id = m.legal_entity_id
    where mal.user_id = auth.uid()
      and mal.status = 'active'
      and mal.ended_at is null
      and m.status = 'active'
      and le.code = 'BS_CORPORACION'
  );
$function$;

create or replace function public.get_people_graph_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then
    raise exception 'PEOPLE_GRAPH_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'members', coalesce(jsonb_agg(to_jsonb(x) order by x.full_name), '[]'::jsonb),
    'summary', jsonb_build_object(
      'active_members', count(*) filter (where x.status = 'active'),
      'members_on_ground', count(*) filter (where x.on_ground),
      'open_guest_invitations', coalesce(sum(x.open_guest_invitations),0)
    )
  ) into v_result
  from (
    select
      m.id,
      m.member_number,
      m.full_name,
      m.status,
      m.joined_at,
      public.is_member_on_ground(m.id, now()) as on_ground,
      (select count(*) from public.guest_invitations gi
       where gi.inviting_member_id = m.id and gi.status in ('invited','confirmed','checked_in')) as open_guest_invitations,
      (select count(*) from public.event_member_roles emr where emr.member_id = m.id) as event_relationships,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'invitation_id', gi.id,
          'guest_id', gi.guest_id,
          'guest_name', g.name,
          'status', gi.status,
          'valid_from', gi.valid_from,
          'valid_until', gi.valid_until,
          'event_id', gi.event_id,
          'can_enter_now', public.can_guest_enter(gi.id, now())
        ) order by gi.valid_from desc)
        from public.guest_invitations gi
        join public.guests g on g.id = gi.guest_id
        where gi.inviting_member_id = m.id
      ), '[]'::jsonb) as guests
    from public.members m
    join public.legal_entities le on le.id = m.legal_entity_id
    where le.code = 'BS_CORPORACION'
  ) x;

  return coalesce(v_result, jsonb_build_object('members','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.get_events_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'EVENTS_WORKSPACE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'events', coalesce(jsonb_agg(to_jsonb(x) order by x.event_date desc nulls last), '[]'::jsonb),
    'summary', jsonb_build_object(
      'events', count(*),
      'without_member_link', count(*) filter (where x.member_count = 0),
      'with_education_collection', count(*) filter (where x.education_collection_id is not null)
    )
  ) into v_result
  from (
    select
      e.id,
      e.title,
      coalesce(e.start_date::date, e.created_at::date) as event_date,
      e.status,
      (select count(*) from public.event_member_roles emr where emr.event_id = e.id) as member_count,
      coalesce((select jsonb_agg(jsonb_build_object('member_id',m.id,'member_name',m.full_name,'role',emr.role,'is_primary',emr.is_primary))
        from public.event_member_roles emr join public.members m on m.id=emr.member_id where emr.event_id=e.id),'[]'::jsonb) as members,
      (select ec.id from public.education_collections ec where ec.event_id=e.id limit 1) as education_collection_id,
      (select count(*) from public.event_service_provider_engagements esp where esp.event_id=e.id and esp.status <> 'cancelled') as provider_engagements
    from public.operational_events e
  ) x;

  return coalesce(v_result, jsonb_build_object('events','[]'::jsonb,'summary','{}'::jsonb));
exception when undefined_column then
  -- Older operational_events schemas may not expose start_date/title/status consistently.
  return jsonb_build_object('events','[]'::jsonb,'summary',jsonb_build_object('schema_requires_mapping',true));
end;
$function$;

create or replace function public.get_education_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'EDUCATION_WORKSPACE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'collections', coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb),
    'summary', jsonb_build_object(
      'collections', count(*),
      'materials', coalesce(sum(x.material_count),0),
      'approved_public_materials', coalesce(sum(x.public_approved_count),0),
      'published_materials', coalesce(sum(x.published_count),0)
    )
  ) into v_result
  from (
    select ec.id, ec.event_id, ec.title, ec.summary, ec.status, ec.created_at,
      (select count(*) from public.education_materials em where em.collection_id=ec.id) as material_count,
      (select count(*) from public.education_materials em where em.collection_id=ec.id and em.status in ('approved','published') and em.privacy_level='public') as public_approved_count,
      (select count(*) from public.education_materials em where em.collection_id=ec.id and em.status='published') as published_count,
      coalesce((select jsonb_agg(jsonb_build_object('id',em.id,'type',em.material_type,'title',em.title,'status',em.status,'privacy_level',em.privacy_level,'approved_at',em.approved_at,'published_at',em.published_at) order by em.created_at desc)
        from public.education_materials em where em.collection_id=ec.id),'[]'::jsonb) as materials
    from public.education_collections ec
  ) x;
  return coalesce(v_result, jsonb_build_object('collections','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

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
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  if v_corp is null or not public.can_access_legal_entity(v_corp,'operate') then raise exception 'ORCHARD_KITCHEN_FORBIDDEN'; end if;

  select jsonb_build_object(
    'costs', coalesce(jsonb_agg(to_jsonb(x) order by x.incurred_on desc nulls last), '[]'::jsonb),
    'summary', jsonb_build_object(
      'orchard_clp', coalesce(sum(x.amount_clp) filter (where x.cost_domain='orchard' and x.status='approved'),0),
      'kitchen_clp', coalesce(sum(x.amount_clp) filter (where x.cost_domain='kitchen' and x.status='approved'),0),
      'shared_clp', coalesce(sum(x.amount_clp) filter (where x.cost_domain='shared' and x.status='approved'),0),
      'pending_review', count(*) filter (where x.status in ('proposed','reviewed'))
    )
  ) into v_result
  from (
    select c.id,c.cost_domain,c.amount_clp,c.incurred_on,c.description,c.source_type,c.status,
      c.procurement_request_id,c.accounting_document_id,c.event_id,c.supplier_id,
      s.name as supplier_name
    from public.corporacion_operating_cost_allocations c
    left join public.suppliers s on s.id=c.supplier_id
    where c.legal_entity_id=v_corp
  ) x;
  return coalesce(v_result, jsonb_build_object('costs','[]'::jsonb,'summary','{}'::jsonb));
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
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  if v_corp is null or not public.can_access_legal_entity(v_corp,'view') then raise exception 'EVENT_PROVIDERS_FORBIDDEN'; end if;

  select jsonb_build_object(
    'providers', coalesce(jsonb_agg(to_jsonb(x) order by x.supplier_name), '[]'::jsonb),
    'summary', jsonb_build_object(
      'active', count(*) filter (where x.is_active),
      'approved', count(*) filter (where x.compliance_status='approved'),
      'unverified', count(*) filter (where x.compliance_status='unverified'),
      'preferred', count(*) filter (where x.preferred)
    )
  ) into v_result
  from (
    select p.id,p.supplier_id,s.name as supplier_name,p.service_category,p.service_description,p.coverage_area,p.capacity_notes,
      p.compliance_status,p.preferred,p.is_active,p.verified_at,
      (select count(*) from public.event_service_provider_engagements e where e.provider_profile_id=p.id) as event_count,
      (select max(e.created_at) from public.event_service_provider_engagements e where e.provider_profile_id=p.id) as last_engagement_at
    from public.event_service_provider_profiles p
    join public.suppliers s on s.id=p.supplier_id
    where p.legal_entity_id=v_corp
  ) x;
  return coalesce(v_result, jsonb_build_object('providers','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.get_foundation_front_door_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.can_view_corporacion_workspace() then raise exception 'FOUNDATION_FRONT_DOOR_FORBIDDEN'; end if;
  select jsonb_build_object(
    'publications', coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb),
    'summary', jsonb_build_object(
      'draft', count(*) filter (where x.status='draft'),
      'review', count(*) filter (where x.status='review'),
      'approved', count(*) filter (where x.status='approved'),
      'published', count(*) filter (where x.status='published')
    )
  ) into v_result
  from (
    select fp.id,fp.education_material_id,em.title as source_title,em.material_type,fp.channel,fp.status,
      fp.public_title,fp.public_summary,fp.campaign_reference,fp.published_url,fp.published_at,fp.created_at
    from public.foundation_publications fp
    join public.education_materials em on em.id=fp.education_material_id
  ) x;
  return coalesce(v_result, jsonb_build_object('publications','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.get_canonical_import_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if public.current_app_role() <> 'admin' then raise exception 'CANONICAL_IMPORT_FORBIDDEN'; end if;
  select jsonb_build_object(
    'batches', coalesce(jsonb_agg(to_jsonb(x) order by x.uploaded_at desc), '[]'::jsonb),
    'summary', jsonb_build_object(
      'batches', count(*),
      'waiting_for_source', case when count(*)=0 then true else false end,
      'unresolved_rows', coalesce(sum(x.unresolved_rows),0),
      'ambiguous_rows', coalesce(sum(x.ambiguous_rows),0)
    )
  ) into v_result
  from (
    select b.id,b.import_type,b.source_name,b.status,b.row_count,b.uploaded_at,b.reviewed_at,b.approved_at,
      case when b.import_type='employee_master' then (select count(*) from public.employee_master_import_rows r where r.batch_id=b.id and r.resolution_status='unresolved')
           else (select count(*) from public.inventory_master_import_rows r where r.batch_id=b.id and r.resolution_status='unresolved') end as unresolved_rows,
      case when b.import_type='employee_master' then (select count(*) from public.employee_master_import_rows r where r.batch_id=b.id and r.resolution_status='ambiguous')
           else (select count(*) from public.inventory_master_import_rows r where r.batch_id=b.id and r.resolution_status='ambiguous') end as ambiguous_rows
    from public.canonical_import_batches b
  ) x;
  return coalesce(v_result, jsonb_build_object('batches','[]'::jsonb,'summary',jsonb_build_object('waiting_for_source',true)));
end;
$function$;

create or replace function public.get_intercompany_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if public.current_app_role() <> 'admin' and not exists (
    select 1 from public.intercompany_rules r
    where public.can_access_legal_entity(r.source_legal_entity_id,'finance')
      and public.can_access_legal_entity(r.destination_legal_entity_id,'finance')
  ) then raise exception 'INTERCOMPANY_WORKSPACE_FORBIDDEN'; end if;

  select jsonb_build_object(
    'rules', coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb),
    'summary', jsonb_build_object(
      'rules', count(*),
      'draft_rules', count(*) filter (where x.status='draft'),
      'active_rules', count(*) filter (where x.status='active'),
      'missing_commercial_terms', count(*) filter (where x.missing_commercial_terms)
    )
  ) into v_result
  from (
    select r.id,r.rule_name,r.rule_type,r.frequency,r.calculation_method,r.fixed_amount,r.percentage_rate,r.currency,
      r.tax_treatment,r.invoice_required,r.effective_from,r.effective_to,r.status,r.agreement_reference,r.notes,r.created_at,
      src.display_name as source_entity,dst.display_name as destination_entity,
      ((r.calculation_method='manual' and r.fixed_amount is null and r.percentage_rate is null)
       or r.tax_treatment is null or r.agreement_reference is null) as missing_commercial_terms
    from public.intercompany_rules r
    join public.legal_entities src on src.id=r.source_legal_entity_id
    join public.legal_entities dst on dst.id=r.destination_legal_entity_id
    where public.current_app_role()='admin' or (
      public.can_access_legal_entity(r.source_legal_entity_id,'finance')
      and public.can_access_legal_entity(r.destination_legal_entity_id,'finance'))
  ) x;
  return coalesce(v_result, jsonb_build_object('rules','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.get_black_swan_audit_center()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_corp uuid;
begin
  if public.current_app_role() <> 'admin' then raise exception 'AUDIT_CENTER_FORBIDDEN'; end if;
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  return jsonb_build_object(
    'generated_at', now(),
    'checks', jsonb_build_array(
      jsonb_build_object('key','employees_without_entity','severity','high','count',(select count(*) from public.employees e where e.is_active and not exists (select 1 from public.employee_employments ee where ee.employee_id=e.id and ee.is_active))),
      jsonb_build_object('key','inventory_without_entity','severity','high','count',(select count(*) from public.inventory_stock_items i where not exists (select 1 from public.inventory_legal_entity_assignments a where a.stock_item_id=i.id and a.effective_to is null))),
      jsonb_build_object('key','assets_without_owner','severity','high','count',(select count(*) from public.assets a where not exists (select 1 from public.asset_ownership_assignments o where o.asset_id=a.id and o.effective_to is null))),
      jsonb_build_object('key','unresolved_employee_import_rows','severity','high','count',(select count(*) from public.employee_master_import_rows where resolution_status in ('unresolved','ambiguous'))),
      jsonb_build_object('key','unresolved_inventory_import_rows','severity','high','count',(select count(*) from public.inventory_master_import_rows where resolution_status in ('unresolved','ambiguous'))),
      jsonb_build_object('key','guest_invitations_without_member_presence_now','severity','medium','count',(select count(*) from public.guest_invitations gi where gi.status in ('confirmed','checked_in') and not gi.approved_override and not public.is_member_on_ground(gi.inviting_member_id,now()))),
      jsonb_build_object('key','events_without_member_link','severity','high','count',(select count(*) from public.operational_events e where not exists (select 1 from public.event_member_roles r where r.event_id=e.id))),
      jsonb_build_object('key','events_without_education_collection','severity','medium','count',(select count(*) from public.operational_events e where not exists (select 1 from public.education_collections c where c.event_id=e.id))),
      jsonb_build_object('key','public_education_waiting_publication','severity','low','count',(select count(*) from public.education_materials em where em.status='approved' and em.privacy_level='public' and not exists (select 1 from public.foundation_publications fp where fp.education_material_id=em.id and fp.status in ('approved','published')))),
      jsonb_build_object('key','event_providers_unverified','severity','medium','count',(select count(*) from public.event_service_provider_profiles where is_active and compliance_status in ('unverified','pending'))),
      jsonb_build_object('key','intercompany_rules_missing_terms','severity','high','count',(select count(*) from public.intercompany_rules r where r.status in ('draft','active') and (r.tax_treatment is null or r.agreement_reference is null or (r.calculation_method='manual' and r.fixed_amount is null and r.percentage_rate is null)))),
      jsonb_build_object('key','accounting_intakes_waiting_review','severity','medium','count',(select count(*) from public.accounting_document_intake where status in ('classified','review'))),
      jsonb_build_object('key','reconciliation_proposals_waiting_review','severity','medium','count',(select count(*) from public.accounting_reconciliation_matches where status='proposed'))
    )
  );
end;
$function$;

create or replace function public.get_black_swan_os_navigation()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_member boolean := false;
  v_corp uuid;
  v_infra uuid;
  v_items jsonb := '[]'::jsonb;
begin
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  select id into v_infra from public.legal_entities where code='BS_INFRA';
  select exists(select 1 from public.member_auth_links where user_id=auth.uid() and status='active' and ended_at is null) into v_member;

  if v_role='admin' or public.can_access_legal_entity(v_corp,'view') or v_member then
    v_items := v_items || jsonb_build_array(
      jsonb_build_object('key','people','label','People Graph','href','/os/people'),
      jsonb_build_object('key','events','label','Events','href','/os/events'),
      jsonb_build_object('key','education','label','Education','href','/os/education'),
      jsonb_build_object('key','front_door','label','Sales & Marketing','href','/os/front-door')
    );
  end if;

  if v_role='admin' or public.can_access_legal_entity(v_corp,'operate') then
    v_items := v_items || jsonb_build_array(
      jsonb_build_object('key','orchard_kitchen','label','Orchard & Kitchen','href','/os/orchard-kitchen'),
      jsonb_build_object('key','event_providers','label','Event Providers','href','/os/event-providers')
    );
  end if;

  if v_role='admin' then
    v_items := v_items || jsonb_build_array(
      jsonb_build_object('key','canonical_imports','label','Canonical Imports','href','/os/imports'),
      jsonb_build_object('key','intercompany','label','Intercompany','href','/os/intercompany'),
      jsonb_build_object('key','audit','label','Audit Center','href','/os/audit')
    );
  end if;

  if v_member or v_role='admin' or public.can_access_legal_entity(v_corp,'finance') or public.can_access_legal_entity(v_infra,'finance') then
    v_items := v_items || jsonb_build_array(
      jsonb_build_object('key','financials','label','Financial Reports','href','/accounting/reports'),
      jsonb_build_object('key','hr','label','HR Transparency','href','/hr/transparency')
    );
  end if;

  return jsonb_build_object('role',v_role,'is_member',v_member,'items',v_items);
end;
$function$;

revoke all on function public.can_view_corporacion_workspace() from public;
revoke all on function public.get_people_graph_workspace() from public;
revoke all on function public.get_events_workspace() from public;
revoke all on function public.get_education_workspace() from public;
revoke all on function public.get_orchard_kitchen_workspace() from public;
revoke all on function public.get_event_provider_workspace() from public;
revoke all on function public.get_foundation_front_door_workspace() from public;
revoke all on function public.get_canonical_import_workspace() from public;
revoke all on function public.get_intercompany_workspace() from public;
revoke all on function public.get_black_swan_audit_center() from public;
revoke all on function public.get_black_swan_os_navigation() from public;

grant execute on function public.can_view_corporacion_workspace() to authenticated;
grant execute on function public.get_people_graph_workspace() to authenticated;
grant execute on function public.get_events_workspace() to authenticated;
grant execute on function public.get_education_workspace() to authenticated;
grant execute on function public.get_orchard_kitchen_workspace() to authenticated;
grant execute on function public.get_event_provider_workspace() to authenticated;
grant execute on function public.get_foundation_front_door_workspace() to authenticated;
grant execute on function public.get_canonical_import_workspace() to authenticated;
grant execute on function public.get_intercompany_workspace() to authenticated;
grant execute on function public.get_black_swan_audit_center() to authenticated;
grant execute on function public.get_black_swan_os_navigation() to authenticated;

comment on function public.get_black_swan_audit_center() is 'Admin-only audit readiness dashboard covering entity allocation, people/events/education/provider/intercompany/accounting exceptions.';
comment on function public.get_black_swan_os_navigation() is 'Canonical role-aware Black Swan OS navigation; frontend must not infer access from JWT metadata.';

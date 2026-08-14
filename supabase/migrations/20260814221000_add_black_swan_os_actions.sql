-- Black Swan OS: controlled workspace mutations for Ed's operating model.
-- All writes are RPC-gated and preserve legal-entity/member/audit boundaries.

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
      e.event_code,
      e.name,
      e.start_date as event_date,
      e.end_date,
      e.location_name,
      e.status,
      e.participant_count,
      (select count(*) from public.event_member_roles emr where emr.event_id = e.id) as member_count,
      coalesce((select jsonb_agg(jsonb_build_object('member_id',m.id,'member_name',m.full_name,'role',emr.role,'is_primary',emr.is_primary))
        from public.event_member_roles emr join public.members m on m.id=emr.member_id where emr.event_id=e.id),'[]'::jsonb) as members,
      (select ec.id from public.education_collections ec where ec.event_id=e.id limit 1) as education_collection_id,
      (select count(*) from public.event_service_provider_engagements esp where esp.event_id=e.id and esp.status <> 'cancelled') as provider_engagements
    from public.operational_events e
  ) x;

  return coalesce(v_result, jsonb_build_object('events','[]'::jsonb,'summary','{}'::jsonb));
end;
$function$;

create or replace function public.can_operate_corporacion()
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select exists (
    select 1 from public.legal_entities le
    where le.code='BS_CORPORACION'
      and public.can_access_legal_entity(le.id,'operate')
  );
$function$;

create or replace function public.is_linked_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select exists (
    select 1 from public.member_auth_links mal
    where mal.member_id=p_member_id
      and mal.user_id=auth.uid()
      and mal.status='active'
      and mal.ended_at is null
  );
$function$;

create or replace function public.set_member_ground_presence(
  p_member_id uuid,
  p_action text,
  p_location_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_presence_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_linked_member(p_member_id) and not public.can_operate_corporacion() then
    raise exception 'MEMBER_PRESENCE_FORBIDDEN';
  end if;

  if p_action='check_in' then
    if public.is_member_on_ground(p_member_id,now()) then raise exception 'MEMBER_ALREADY_ON_GROUND'; end if;
    insert into public.member_presence(member_id,location_id,checked_in_at,status,verified_by,verification_method,notes)
    values(p_member_id,p_location_id,now(),'on_ground',auth.uid(),case when public.is_linked_member(p_member_id) then 'self' else 'staff' end,p_notes)
    returning id into v_presence_id;
    return jsonb_build_object('member_id',p_member_id,'presence_id',v_presence_id,'status','on_ground');
  elsif p_action='check_out' then
    update public.member_presence
    set checked_out_at=now(), status='checked_out', notes=coalesce(p_notes,notes)
    where member_id=p_member_id and status='on_ground' and checked_out_at is null
    returning id into v_presence_id;
    if v_presence_id is null then raise exception 'MEMBER_NOT_ON_GROUND'; end if;
    return jsonb_build_object('member_id',p_member_id,'presence_id',v_presence_id,'status','checked_out');
  end if;
  raise exception 'INVALID_PRESENCE_ACTION';
end;
$function$;

create or replace function public.create_member_guest_invitation(
  p_member_id uuid,
  p_guest_name text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_event_id uuid default null,
  p_reservation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_guest_id uuid;
  v_invitation_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_linked_member(p_member_id) and not public.can_operate_corporacion() then raise exception 'GUEST_INVITATION_FORBIDDEN'; end if;
  if nullif(btrim(p_guest_name),'') is null then raise exception 'GUEST_NAME_REQUIRED'; end if;
  if p_valid_until < p_valid_from then raise exception 'INVALID_INVITATION_DATES'; end if;

  insert into public.guests(name,notes)
  values(btrim(p_guest_name),'Created from Member-linked guest invitation')
  returning id into v_guest_id;

  insert into public.guest_invitations(guest_id,inviting_member_id,event_id,reservation_id,valid_from,valid_until,status)
  values(v_guest_id,p_member_id,p_event_id,p_reservation_id,p_valid_from,p_valid_until,'invited')
  returning id into v_invitation_id;

  return jsonb_build_object('guest_id',v_guest_id,'invitation_id',v_invitation_id,'can_enter_now',public.can_guest_enter(v_invitation_id,now()));
end;
$function$;

create or replace function public.create_member_operational_event(
  p_member_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_location_name text default null,
  p_member_role text default 'host'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_event_id uuid;
  v_collection_id uuid;
  v_event_code text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_linked_member(p_member_id) and not public.can_operate_corporacion() then raise exception 'EVENT_CREATE_FORBIDDEN'; end if;
  if p_end_date < p_start_date then raise exception 'INVALID_EVENT_DATES'; end if;
  if p_member_role not in ('host','sponsor','organizer','participant','speaker') then raise exception 'INVALID_MEMBER_ROLE'; end if;
  if nullif(btrim(p_name),'') is null then raise exception 'EVENT_NAME_REQUIRED'; end if;

  v_event_code := 'EVT-' || to_char(p_start_date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.operational_events(event_code,name,start_date,end_date,location_name,status,source_status,notes)
  values(v_event_code,btrim(p_name),p_start_date,p_end_date,p_location_name,'planning','canonical_source','Created through Member-driven Black Swan OS workflow')
  returning id into v_event_id;

  insert into public.event_member_roles(event_id,member_id,role,is_primary)
  values(v_event_id,p_member_id,p_member_role,true);

  insert into public.education_collections(event_id,title,status)
  values(v_event_id,btrim(p_name) || ' — Education','collecting')
  returning id into v_collection_id;

  return jsonb_build_object('event_id',v_event_id,'event_code',v_event_code,'education_collection_id',v_collection_id);
end;
$function$;

create or replace function public.add_event_education_material(
  p_collection_id uuid,
  p_material_type text,
  p_title text,
  p_privacy_level text default 'internal',
  p_source_url text default null,
  p_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_id uuid;
begin
  if not public.can_operate_corporacion() then raise exception 'EDUCATION_WRITE_FORBIDDEN'; end if;
  if p_material_type not in ('recording','video','photo','presentation','transcript','article','research','summary','learning_material','other') then raise exception 'INVALID_MATERIAL_TYPE'; end if;
  if p_privacy_level not in ('private','members','internal','public') then raise exception 'INVALID_PRIVACY_LEVEL'; end if;
  insert into public.education_materials(collection_id,material_type,title,source_url,storage_path,status,privacy_level)
  values(p_collection_id,p_material_type,btrim(p_title),p_source_url,p_storage_path,'draft',p_privacy_level)
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.record_orchard_kitchen_cost(
  p_cost_domain text,
  p_amount_clp numeric,
  p_incurred_on date,
  p_description text,
  p_supplier_id uuid default null,
  p_procurement_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_corp uuid; v_department uuid; v_id uuid;
begin
  if not public.can_operate_corporacion() then raise exception 'ORCHARD_KITCHEN_WRITE_FORBIDDEN'; end if;
  if p_cost_domain not in ('orchard','kitchen','shared') then raise exception 'INVALID_COST_DOMAIN'; end if;
  if p_amount_clp is null or p_amount_clp < 0 then raise exception 'INVALID_AMOUNT'; end if;
  select le.id,ed.id into v_corp,v_department from public.legal_entities le join public.entity_departments ed on ed.legal_entity_id=le.id and ed.code='ORCHARD_KITCHEN' where le.code='BS_CORPORACION';
  if v_corp is null or v_department is null then raise exception 'ORCHARD_KITCHEN_DOMAIN_NOT_CONFIGURED'; end if;
  insert into public.corporacion_operating_cost_allocations(legal_entity_id,department_id,cost_domain,procurement_request_id,supplier_id,amount_clp,incurred_on,description,source_type,status,created_by)
  values(v_corp,v_department,p_cost_domain,p_procurement_request_id,p_supplier_id,p_amount_clp,p_incurred_on,p_description,case when p_procurement_request_id is null then 'manual' else 'procurement' end,'proposed',auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.register_event_service_provider(
  p_supplier_id uuid,
  p_service_category text,
  p_service_description text default null,
  p_coverage_area text default null,
  p_capacity_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_corp uuid; v_id uuid;
begin
  if not public.can_operate_corporacion() then raise exception 'EVENT_PROVIDER_WRITE_FORBIDDEN'; end if;
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  if not exists(select 1 from public.suppliers where id=p_supplier_id and is_active) then raise exception 'ACTIVE_SUPPLIER_REQUIRED'; end if;
  insert into public.event_service_provider_profiles(supplier_id,legal_entity_id,service_category,service_description,coverage_area,capacity_notes,compliance_status,is_active)
  values(p_supplier_id,v_corp,btrim(p_service_category),p_service_description,p_coverage_area,p_capacity_notes,'unverified',true)
  on conflict(supplier_id,legal_entity_id,service_category) do update
  set service_description=excluded.service_description,coverage_area=excluded.coverage_area,capacity_notes=excluded.capacity_notes,is_active=true,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.create_foundation_publication_draft(
  p_education_material_id uuid,
  p_channel text,
  p_public_title text,
  p_public_summary text default null,
  p_campaign_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_id uuid;
begin
  if not public.can_operate_corporacion() then raise exception 'PUBLICATION_WRITE_FORBIDDEN'; end if;
  if p_channel not in ('website','newsletter','social','program','event_promotion','partner','other') then raise exception 'INVALID_PUBLICATION_CHANNEL'; end if;
  if not exists(select 1 from public.education_materials where id=p_education_material_id) then raise exception 'EDUCATION_MATERIAL_NOT_FOUND'; end if;
  insert into public.foundation_publications(education_material_id,channel,status,public_title,public_summary,campaign_reference)
  values(p_education_material_id,p_channel,'draft',p_public_title,p_public_summary,p_campaign_reference)
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.review_canonical_import_batch(
  p_batch_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_batch public.canonical_import_batches%rowtype; v_unresolved bigint;
begin
  if public.current_app_role()<>'admin' then raise exception 'CANONICAL_IMPORT_REVIEW_FORBIDDEN'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_IMPORT_DECISION'; end if;
  select * into v_batch from public.canonical_import_batches where id=p_batch_id for update;
  if not found then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if p_decision='approved' then
    if v_batch.import_type='employee_master' then select count(*) into v_unresolved from public.employee_master_import_rows where batch_id=p_batch_id and resolution_status in ('unresolved','ambiguous');
    else select count(*) into v_unresolved from public.inventory_master_import_rows where batch_id=p_batch_id and resolution_status in ('unresolved','ambiguous'); end if;
    if v_unresolved>0 then raise exception 'IMPORT_HAS_UNRESOLVED_ROWS'; end if;
  end if;
  update public.canonical_import_batches
  set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),approved_by=case when p_decision='approved' then auth.uid() else null end,approved_at=case when p_decision='approved' then now() else null end,notes=coalesce(p_notes,notes)
  where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'status',p_decision,'unresolved_rows',coalesce(v_unresolved,0));
end;
$function$;

create or replace function public.save_intercompany_draft_rule(
  p_rule_name text,
  p_source_legal_entity_id uuid,
  p_destination_legal_entity_id uuid,
  p_rule_type text,
  p_frequency text,
  p_calculation_method text,
  p_effective_from date,
  p_fixed_amount numeric default null,
  p_percentage_rate numeric default null,
  p_tax_treatment text default null,
  p_agreement_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_id uuid;
begin
  if public.current_app_role()<>'admin' and not (
    public.can_access_legal_entity(p_source_legal_entity_id,'finance') and public.can_access_legal_entity(p_destination_legal_entity_id,'finance')
  ) then raise exception 'INTERCOMPANY_RULE_WRITE_FORBIDDEN'; end if;
  if p_source_legal_entity_id=p_destination_legal_entity_id then raise exception 'INTERCOMPANY_ENTITIES_MUST_DIFFER'; end if;
  insert into public.intercompany_rules(rule_name,source_legal_entity_id,destination_legal_entity_id,rule_type,frequency,calculation_method,fixed_amount,percentage_rate,tax_treatment,effective_from,status,agreement_reference,notes,created_by)
  values(btrim(p_rule_name),p_source_legal_entity_id,p_destination_legal_entity_id,p_rule_type,p_frequency,p_calculation_method,p_fixed_amount,p_percentage_rate,p_tax_treatment,p_effective_from,'draft',p_agreement_reference,p_notes,auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.can_operate_corporacion() from public;
revoke all on function public.is_linked_member(uuid) from public;
revoke all on function public.set_member_ground_presence(uuid,text,uuid,text) from public;
revoke all on function public.create_member_guest_invitation(uuid,text,timestamptz,timestamptz,uuid,uuid) from public;
revoke all on function public.create_member_operational_event(uuid,text,date,date,text,text) from public;
revoke all on function public.add_event_education_material(uuid,text,text,text,text,text) from public;
revoke all on function public.record_orchard_kitchen_cost(text,numeric,date,text,uuid,uuid) from public;
revoke all on function public.register_event_service_provider(uuid,text,text,text,text) from public;
revoke all on function public.create_foundation_publication_draft(uuid,text,text,text,text) from public;
revoke all on function public.review_canonical_import_batch(uuid,text,text) from public;
revoke all on function public.save_intercompany_draft_rule(text,uuid,uuid,text,text,text,date,numeric,numeric,text,text,text) from public;

grant execute on function public.can_operate_corporacion() to authenticated;
grant execute on function public.is_linked_member(uuid) to authenticated;
grant execute on function public.set_member_ground_presence(uuid,text,uuid,text) to authenticated;
grant execute on function public.create_member_guest_invitation(uuid,text,timestamptz,timestamptz,uuid,uuid) to authenticated;
grant execute on function public.create_member_operational_event(uuid,text,date,date,text,text) to authenticated;
grant execute on function public.add_event_education_material(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.record_orchard_kitchen_cost(text,numeric,date,text,uuid,uuid) to authenticated;
grant execute on function public.register_event_service_provider(uuid,text,text,text,text) to authenticated;
grant execute on function public.create_foundation_publication_draft(uuid,text,text,text,text) to authenticated;
grant execute on function public.review_canonical_import_batch(uuid,text,text) to authenticated;
grant execute on function public.save_intercompany_draft_rule(text,uuid,uuid,text,text,text,date,numeric,numeric,text,text,text) to authenticated;

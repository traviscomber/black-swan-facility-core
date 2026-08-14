-- Black Swan OS: canonical UI references, review-first source staging, and controlled workflow completion.
-- No source allocation is inferred. Employee/inventory rows remain unresolved until explicitly mapped.

create or replace function public.get_black_swan_os_references(p_workspace text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_corp uuid;
  v_result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';

  if p_workspace in ('people','events') then
    if not public.can_view_corporacion_workspace() then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object('members', coalesce((
      select jsonb_agg(jsonb_build_object('id',m.id,'label',m.full_name,'status',m.status) order by m.full_name)
      from public.members m
      where m.legal_entity_id=v_corp and m.status='active'
        and (public.can_operate_corporacion() or public.is_linked_member(m.id))
    ),'[]'::jsonb));
  end if;

  if p_workspace in ('orchard-kitchen','event-providers') then
    if not public.can_operate_corporacion() then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object('suppliers', coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'label',s.name) order by s.name)
      from public.suppliers s where s.is_active
    ),'[]'::jsonb));
  end if;

  if p_workspace='event-providers' then
    v_result := v_result || jsonb_build_object(
      'events', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'date',e.start_date) order by e.start_date desc) from public.operational_events e),'[]'::jsonb),
      'provider_profiles', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'label',s.name || ' — ' || p.service_category,'status',p.compliance_status) order by s.name,p.service_category)
        from public.event_service_provider_profiles p join public.suppliers s on s.id=p.supplier_id where p.legal_entity_id=v_corp and p.is_active),'[]'::jsonb)
    );
  end if;

  if p_workspace='education' then
    if not public.can_operate_corporacion() then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object('collections', coalesce((
      select jsonb_agg(jsonb_build_object('id',ec.id,'label',ec.title,'status',ec.status) order by ec.created_at desc)
      from public.education_collections ec
    ),'[]'::jsonb));
  end if;

  if p_workspace='front-door' then
    if not public.can_operate_corporacion() then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object(
      'education_materials', coalesce((select jsonb_agg(jsonb_build_object('id',em.id,'label',em.title,'status',em.status,'privacy_level',em.privacy_level) order by em.created_at desc) from public.education_materials em),'[]'::jsonb),
      'publications', coalesce((select jsonb_agg(jsonb_build_object('id',fp.id,'label',coalesce(fp.public_title,em.title),'status',fp.status,'channel',fp.channel) order by fp.created_at desc)
        from public.foundation_publications fp join public.education_materials em on em.id=fp.education_material_id),'[]'::jsonb)
    );
  end if;

  if p_workspace='orchard-kitchen' then
    v_result := v_result || jsonb_build_object('employees', coalesce((
      select jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'role',e.role) order by e.name)
      from public.employees e
      where e.is_active and exists(select 1 from public.employee_employments ee where ee.employee_id=e.id and ee.legal_entity_id=v_corp and ee.is_active)
    ),'[]'::jsonb));
  end if;

  if p_workspace='imports' then
    if public.current_app_role()<>'admin' then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object(
      'legal_entities', coalesce((select jsonb_agg(jsonb_build_object('id',le.id,'label',le.display_name,'code',le.code) order by le.display_name) from public.legal_entities le where le.active),'[]'::jsonb),
      'departments', coalesce((select jsonb_agg(jsonb_build_object('id',ed.id,'label',ed.name,'legal_entity_id',ed.legal_entity_id) order by ed.name) from public.entity_departments ed where ed.is_active),'[]'::jsonb),
      'employees', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'role',e.role) order by e.name) from public.employees e where e.is_active),'[]'::jsonb),
      'stock_items', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',coalesce(i.item_code || ' — ','') || i.name,'item_code',i.item_code) order by i.name) from public.inventory_stock_items i where i.is_active),'[]'::jsonb)
    );
  end if;

  if p_workspace='intercompany' then
    if public.current_app_role()<>'admin' then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object('legal_entities', coalesce((
      select jsonb_agg(jsonb_build_object('id',le.id,'label',le.display_name,'code',le.code) order by le.display_name)
      from public.legal_entities le where le.active
    ),'[]'::jsonb));
  end if;

  return v_result;
end;
$function$;

create or replace function public.stage_canonical_import(
  p_import_type text,
  p_source_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_batch_id uuid;
  v_count integer;
  v_row jsonb;
  v_ordinal bigint;
begin
  if public.current_app_role()<>'admin' then raise exception 'CANONICAL_IMPORT_STAGE_FORBIDDEN'; end if;
  if p_import_type not in ('employee_master','inventory_master') then raise exception 'INVALID_IMPORT_TYPE'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'IMPORT_ROWS_MUST_BE_ARRAY'; end if;
  v_count := jsonb_array_length(p_rows);
  if v_count=0 then raise exception 'IMPORT_ROWS_REQUIRED'; end if;

  insert into public.canonical_import_batches(import_type,source_name,status,row_count,uploaded_by,notes)
  values(p_import_type,coalesce(nullif(btrim(p_source_name),''),'uploaded_source'),'review',v_count,auth.uid(),'Source staged verbatim; no legal-entity allocation inferred.')
  returning id into v_batch_id;

  for v_row, v_ordinal in
    select value, ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    if p_import_type='employee_master' then
      insert into public.employee_master_import_rows(
        batch_id,row_number,source_key,raw_payload,source_company_label,source_department_label,resolution_status
      ) values (
        v_batch_id,v_ordinal::integer,
        coalesce(v_row->>'employee_id',v_row->>'id',v_row->>'email',v_row->>'name'),
        v_row,
        coalesce(v_row->>'company',v_row->>'legal_entity',v_row->>'entity',v_row->>'company_name'),
        coalesce(v_row->>'department',v_row->>'department_name',v_row->>'area'),
        'unresolved'
      );
    else
      insert into public.inventory_master_import_rows(
        batch_id,row_number,source_key,raw_payload,source_company_label,source_department_label,resolution_status
      ) values (
        v_batch_id,v_ordinal::integer,
        coalesce(v_row->>'item_code',v_row->>'sku',v_row->>'code',v_row->>'id',v_row->>'name'),
        v_row,
        coalesce(v_row->>'company',v_row->>'legal_entity',v_row->>'entity',v_row->>'company_name'),
        coalesce(v_row->>'department',v_row->>'department_name',v_row->>'area'),
        'unresolved'
      );
    end if;
  end loop;

  return jsonb_build_object('batch_id',v_batch_id,'import_type',p_import_type,'rows_staged',v_count,'status','review');
end;
$function$;

create or replace function public.resolve_canonical_import_row(
  p_import_type text,
  p_row_id uuid,
  p_legal_entity_id uuid,
  p_department_id uuid,
  p_matched_record_id uuid,
  p_resolution_status text default 'resolved',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_department_entity uuid;
begin
  if public.current_app_role()<>'admin' then raise exception 'CANONICAL_IMPORT_RESOLVE_FORBIDDEN'; end if;
  if p_resolution_status not in ('resolved','ambiguous','rejected') then raise exception 'INVALID_RESOLUTION_STATUS'; end if;

  if p_resolution_status='resolved' then
    if p_legal_entity_id is null or p_matched_record_id is null then raise exception 'RESOLVED_ROW_REQUIRES_ENTITY_AND_RECORD'; end if;
    if p_department_id is not null then
      select legal_entity_id into v_department_entity from public.entity_departments where id=p_department_id and is_active;
      if v_department_entity is distinct from p_legal_entity_id then raise exception 'DEPARTMENT_ENTITY_MISMATCH'; end if;
    end if;
  end if;

  if p_import_type='employee_master' then
    if not exists(select 1 from public.employee_master_import_rows where id=p_row_id) then raise exception 'IMPORT_ROW_NOT_FOUND'; end if;
    if p_resolution_status='resolved' and not exists(select 1 from public.employees where id=p_matched_record_id) then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
    update public.employee_master_import_rows set
      matched_employee_id=case when p_resolution_status='resolved' then p_matched_record_id else null end,
      legal_entity_id=case when p_resolution_status='resolved' then p_legal_entity_id else null end,
      department_id=case when p_resolution_status='resolved' then p_department_id else null end,
      resolution_status=p_resolution_status,resolution_method='manual',review_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now()
    where id=p_row_id;
  elsif p_import_type='inventory_master' then
    if not exists(select 1 from public.inventory_master_import_rows where id=p_row_id) then raise exception 'IMPORT_ROW_NOT_FOUND'; end if;
    if p_resolution_status='resolved' and not exists(select 1 from public.inventory_stock_items where id=p_matched_record_id) then raise exception 'STOCK_ITEM_NOT_FOUND'; end if;
    update public.inventory_master_import_rows set
      matched_stock_item_id=case when p_resolution_status='resolved' then p_matched_record_id else null end,
      legal_entity_id=case when p_resolution_status='resolved' then p_legal_entity_id else null end,
      department_id=case when p_resolution_status='resolved' then p_department_id else null end,
      resolution_status=p_resolution_status,resolution_method='manual',review_notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now()
    where id=p_row_id;
  else
    raise exception 'INVALID_IMPORT_TYPE';
  end if;

  return jsonb_build_object('row_id',p_row_id,'resolution_status',p_resolution_status);
end;
$function$;

create or replace function public.apply_canonical_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_batch public.canonical_import_batches%rowtype;
  v_unresolved bigint;
  v_applied integer := 0;
  r record;
begin
  if public.current_app_role()<>'admin' then raise exception 'CANONICAL_IMPORT_APPLY_FORBIDDEN'; end if;
  select * into v_batch from public.canonical_import_batches where id=p_batch_id for update;
  if not found then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if v_batch.status<>'approved' then raise exception 'IMPORT_BATCH_NOT_APPROVED'; end if;

  if v_batch.import_type='employee_master' then
    select count(*) into v_unresolved from public.employee_master_import_rows where batch_id=p_batch_id and resolution_status in ('unresolved','ambiguous');
    if v_unresolved>0 then raise exception 'IMPORT_HAS_UNRESOLVED_ROWS'; end if;
    for r in select * from public.employee_master_import_rows where batch_id=p_batch_id and resolution_status='resolved' loop
      if exists(select 1 from public.employee_employments ee where ee.employee_id=r.matched_employee_id and ee.is_primary and ee.is_active and ee.legal_entity_id<>r.legal_entity_id) then
        raise exception 'EMPLOYEE_EXISTING_ASSIGNMENT_REQUIRES_REVIEW:%',r.matched_employee_id;
      end if;
      if not exists(select 1 from public.employee_employments ee where ee.employee_id=r.matched_employee_id and ee.is_primary and ee.is_active) then
        insert into public.employee_employments(employee_id,legal_entity_id,department_id,is_primary,is_active)
        values(r.matched_employee_id,r.legal_entity_id,r.department_id,true,true);
        v_applied := v_applied + 1;
      end if;
    end loop;
  else
    select count(*) into v_unresolved from public.inventory_master_import_rows where batch_id=p_batch_id and resolution_status in ('unresolved','ambiguous');
    if v_unresolved>0 then raise exception 'IMPORT_HAS_UNRESOLVED_ROWS'; end if;
    for r in select * from public.inventory_master_import_rows where batch_id=p_batch_id and resolution_status='resolved' loop
      if exists(select 1 from public.inventory_legal_entity_assignments a where a.stock_item_id=r.matched_stock_item_id and a.is_primary and a.effective_to is null and a.legal_entity_id<>r.legal_entity_id) then
        raise exception 'INVENTORY_EXISTING_ASSIGNMENT_REQUIRES_REVIEW:%',r.matched_stock_item_id;
      end if;
      if not exists(select 1 from public.inventory_legal_entity_assignments a where a.stock_item_id=r.matched_stock_item_id and a.is_primary and a.effective_to is null) then
        insert into public.inventory_legal_entity_assignments(stock_item_id,legal_entity_id,department_id,is_primary,effective_from)
        values(r.matched_stock_item_id,r.legal_entity_id,r.department_id,true,current_date);
        v_applied := v_applied + 1;
      end if;
    end loop;
  end if;

  update public.canonical_import_batches set status='applied',notes=concat_ws(E'\n',notes,'Applied through reviewed canonical import workflow.') where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'status','applied','assignments_created',v_applied);
end;
$function$;

create or replace function public.get_canonical_import_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_result jsonb;
begin
  if public.current_app_role()<>'admin' then raise exception 'CANONICAL_IMPORT_FORBIDDEN'; end if;
  select jsonb_build_object(
    'batches', coalesce((select jsonb_agg(to_jsonb(bx) order by bx.uploaded_at desc) from (
      select b.id,b.import_type,b.source_name,b.status,b.row_count,b.uploaded_at,b.reviewed_at,b.approved_at,
        case when b.import_type='employee_master' then (select count(*) from public.employee_master_import_rows r where r.batch_id=b.id and r.resolution_status='unresolved')
             else (select count(*) from public.inventory_master_import_rows r where r.batch_id=b.id and r.resolution_status='unresolved') end as unresolved_rows,
        case when b.import_type='employee_master' then (select count(*) from public.employee_master_import_rows r where r.batch_id=b.id and r.resolution_status='ambiguous')
             else (select count(*) from public.inventory_master_import_rows r where r.batch_id=b.id and r.resolution_status='ambiguous') end as ambiguous_rows
      from public.canonical_import_batches b
    ) bx),'[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(rx) order by rx.batch_uploaded_at desc,rx.row_number) from (
        select 'employee_master'::text as import_type,r.id,r.batch_id,r.row_number,r.source_key,r.raw_payload,r.source_company_label,r.source_department_label,r.resolution_status,r.review_notes,b.uploaded_at as batch_uploaded_at
        from public.employee_master_import_rows r join public.canonical_import_batches b on b.id=r.batch_id where r.resolution_status in ('unresolved','ambiguous')
        union all
        select 'inventory_master',r.id,r.batch_id,r.row_number,r.source_key,r.raw_payload,r.source_company_label,r.source_department_label,r.resolution_status,r.review_notes,b.uploaded_at
        from public.inventory_master_import_rows r join public.canonical_import_batches b on b.id=r.batch_id where r.resolution_status in ('unresolved','ambiguous')
      ) rx
    ),'[]'::jsonb),
    'summary', jsonb_build_object(
      'batches',(select count(*) from public.canonical_import_batches),
      'waiting_for_source',(select count(*)=0 from public.canonical_import_batches),
      'unresolved_rows',(select (select count(*) from public.employee_master_import_rows where resolution_status='unresolved') + (select count(*) from public.inventory_master_import_rows where resolution_status='unresolved')),
      'ambiguous_rows',(select (select count(*) from public.employee_master_import_rows where resolution_status='ambiguous') + (select count(*) from public.inventory_master_import_rows where resolution_status='ambiguous'))
    )
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.engage_event_service_provider(
  p_event_id uuid,
  p_provider_profile_id uuid,
  p_scope_of_work text,
  p_estimated_amount_clp numeric default null,
  p_procurement_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_id uuid; v_corp uuid;
begin
  if not public.can_operate_corporacion() then raise exception 'EVENT_PROVIDER_ENGAGEMENT_FORBIDDEN'; end if;
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  if not exists(select 1 from public.operational_events where id=p_event_id) then raise exception 'EVENT_NOT_FOUND'; end if;
  if not exists(select 1 from public.event_service_provider_profiles where id=p_provider_profile_id and legal_entity_id=v_corp and is_active) then raise exception 'PROVIDER_PROFILE_NOT_FOUND'; end if;
  if p_estimated_amount_clp is not null and p_estimated_amount_clp<0 then raise exception 'INVALID_ESTIMATED_AMOUNT'; end if;
  insert into public.event_service_provider_engagements(event_id,provider_profile_id,procurement_request_id,scope_of_work,estimated_amount_clp,status,responsible_user_id)
  values(p_event_id,p_provider_profile_id,p_procurement_request_id,p_scope_of_work,p_estimated_amount_clp,'planned',auth.uid()) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.review_education_material(
  p_material_id uuid,
  p_decision text,
  p_privacy_level text,
  p_editorial_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if not public.can_operate_corporacion() then raise exception 'EDUCATION_REVIEW_FORBIDDEN'; end if;
  if p_decision not in ('review','approved','archived') then raise exception 'INVALID_EDUCATION_DECISION'; end if;
  if p_privacy_level not in ('private','members','internal','public') then raise exception 'INVALID_PRIVACY_LEVEL'; end if;
  update public.education_materials set
    status=p_decision,privacy_level=p_privacy_level,editorial_notes=p_editorial_notes,
    approved_by=case when p_decision='approved' then auth.uid() else null end,
    approved_at=case when p_decision='approved' then now() else null end,
    updated_at=now()
  where id=p_material_id;
  if not found then raise exception 'EDUCATION_MATERIAL_NOT_FOUND'; end if;
  return jsonb_build_object('material_id',p_material_id,'status',p_decision,'privacy_level',p_privacy_level);
end;
$function$;

create or replace function public.review_foundation_publication(
  p_publication_id uuid,
  p_decision text,
  p_published_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if not public.can_operate_corporacion() then raise exception 'PUBLICATION_REVIEW_FORBIDDEN'; end if;
  if p_decision not in ('review','approved','published','withdrawn') then raise exception 'INVALID_PUBLICATION_DECISION'; end if;
  if p_decision='published' and nullif(btrim(p_published_url),'') is null then raise exception 'PUBLISHED_URL_REQUIRED'; end if;
  update public.foundation_publications set
    status=p_decision,
    published_url=case when p_decision='published' then p_published_url else published_url end,
    approved_by=case when p_decision in ('approved','published') then auth.uid() else approved_by end,
    approved_at=case when p_decision in ('approved','published') then coalesce(approved_at,now()) else approved_at end,
    published_at=case when p_decision='published' then now() else published_at end,
    updated_at=now()
  where id=p_publication_id;
  if not found then raise exception 'PUBLICATION_NOT_FOUND'; end if;
  return jsonb_build_object('publication_id',p_publication_id,'status',p_decision);
end;
$function$;

create or replace function public.assign_orchard_kitchen_responsibility(
  p_employee_id uuid,
  p_responsibility_type text,
  p_can_request_purchases boolean,
  p_can_manage_costs boolean,
  p_effective_from date,
  p_source_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare v_corp uuid; v_department uuid; v_id uuid;
begin
  if not public.can_operate_corporacion() then raise exception 'ORCHARD_KITCHEN_RESPONSIBILITY_FORBIDDEN'; end if;
  if p_responsibility_type not in ('lead','operator','purchaser','reviewer') then raise exception 'INVALID_RESPONSIBILITY_TYPE'; end if;
  select le.id,ed.id into v_corp,v_department from public.legal_entities le join public.entity_departments ed on ed.legal_entity_id=le.id and ed.code='ORCHARD_KITCHEN' where le.code='BS_CORPORACION';
  if not exists(select 1 from public.employee_employments ee where ee.employee_id=p_employee_id and ee.legal_entity_id=v_corp and ee.is_active) then raise exception 'CORPORACION_EMPLOYMENT_REQUIRED'; end if;
  insert into public.corporacion_operating_responsibilities(legal_entity_id,department_id,employee_id,responsibility_type,scope,can_request_purchases,can_manage_costs,effective_from,source_reference,notes)
  values(v_corp,v_department,p_employee_id,p_responsibility_type,'orchard_kitchen',p_can_request_purchases,p_can_manage_costs,p_effective_from,p_source_reference,p_notes)
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.get_black_swan_os_references(text) from public;
revoke all on function public.stage_canonical_import(text,text,jsonb) from public;
revoke all on function public.resolve_canonical_import_row(text,uuid,uuid,uuid,uuid,text,text) from public;
revoke all on function public.apply_canonical_import_batch(uuid) from public;
revoke all on function public.engage_event_service_provider(uuid,uuid,text,numeric,uuid) from public;
revoke all on function public.review_education_material(uuid,text,text,text) from public;
revoke all on function public.review_foundation_publication(uuid,text,text) from public;
revoke all on function public.assign_orchard_kitchen_responsibility(uuid,text,boolean,boolean,date,text,text) from public;

grant execute on function public.get_black_swan_os_references(text) to authenticated;
grant execute on function public.stage_canonical_import(text,text,jsonb) to authenticated;
grant execute on function public.resolve_canonical_import_row(text,uuid,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.apply_canonical_import_batch(uuid) to authenticated;
grant execute on function public.engage_event_service_provider(uuid,uuid,text,numeric,uuid) to authenticated;
grant execute on function public.review_education_material(uuid,text,text,text) to authenticated;
grant execute on function public.review_foundation_publication(uuid,text,text) to authenticated;
grant execute on function public.assign_orchard_kitchen_responsibility(uuid,text,boolean,boolean,date,text,text) to authenticated;

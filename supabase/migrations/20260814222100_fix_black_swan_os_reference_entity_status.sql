-- Correct legal-entity status field in the canonical reference catalog.
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
  select id into v_corp from public.legal_entities where code='BS_CORPORACION' and is_active;

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
    v_result := v_result || jsonb_build_object('suppliers', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.name) order by s.name) from public.suppliers s where s.is_active),'[]'::jsonb));
  end if;

  if p_workspace='event-providers' then
    v_result := v_result || jsonb_build_object(
      'events', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'date',e.start_date) order by e.start_date desc) from public.operational_events e),'[]'::jsonb),
      'provider_profiles', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'label',s.name || ' — ' || p.service_category,'status',p.compliance_status) order by s.name,p.service_category) from public.event_service_provider_profiles p join public.suppliers s on s.id=p.supplier_id where p.legal_entity_id=v_corp and p.is_active),'[]'::jsonb)
    );
  end if;

  if p_workspace='education' then
    if not public.can_operate_corporacion() then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object(
      'collections', coalesce((select jsonb_agg(jsonb_build_object('id',ec.id,'label',ec.title,'status',ec.status) order by ec.created_at desc) from public.education_collections ec),'[]'::jsonb),
      'materials', coalesce((select jsonb_agg(jsonb_build_object('id',em.id,'label',em.title,'status',em.status,'privacy_level',em.privacy_level) order by em.created_at desc) from public.education_materials em),'[]'::jsonb)
    );
  end if;

  if p_workspace='front-door' then
    if not public.can_operate_corporacion() then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object(
      'education_materials', coalesce((select jsonb_agg(jsonb_build_object('id',em.id,'label',em.title,'status',em.status,'privacy_level',em.privacy_level) order by em.created_at desc) from public.education_materials em),'[]'::jsonb),
      'publications', coalesce((select jsonb_agg(jsonb_build_object('id',fp.id,'label',coalesce(fp.public_title,em.title),'status',fp.status,'channel',fp.channel) order by fp.created_at desc) from public.foundation_publications fp join public.education_materials em on em.id=fp.education_material_id),'[]'::jsonb)
    );
  end if;

  if p_workspace='orchard-kitchen' then
    v_result := v_result || jsonb_build_object('employees', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'role',e.role) order by e.name) from public.employees e where e.is_active and exists(select 1 from public.employee_employments ee where ee.employee_id=e.id and ee.legal_entity_id=v_corp and ee.is_active)),'[]'::jsonb));
  end if;

  if p_workspace='imports' then
    if public.current_app_role()<>'admin' then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object(
      'legal_entities', coalesce((select jsonb_agg(jsonb_build_object('id',le.id,'label',le.display_name,'code',le.code) order by le.display_name) from public.legal_entities le where le.is_active),'[]'::jsonb),
      'departments', coalesce((select jsonb_agg(jsonb_build_object('id',ed.id,'label',ed.name,'legal_entity_id',ed.legal_entity_id) order by ed.name) from public.entity_departments ed where ed.is_active),'[]'::jsonb),
      'employees', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'label',e.name,'role',e.role) order by e.name) from public.employees e where e.is_active),'[]'::jsonb),
      'stock_items', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',coalesce(i.item_code || ' — ','') || i.name,'item_code',i.item_code) order by i.name) from public.inventory_stock_items i where i.is_active),'[]'::jsonb)
    );
  end if;

  if p_workspace='intercompany' then
    if public.current_app_role()<>'admin' then raise exception 'WORKSPACE_REFERENCES_FORBIDDEN'; end if;
    v_result := v_result || jsonb_build_object('legal_entities', coalesce((select jsonb_agg(jsonb_build_object('id',le.id,'label',le.display_name,'code',le.code) order by le.display_name) from public.legal_entities le where le.is_active),'[]'::jsonb));
  end if;

  return v_result;
end;
$function$;

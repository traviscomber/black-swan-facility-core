-- Restore Raimundo's ability to confirm historical finance center mappings.
-- Production was blocked because this RPC incorrectly required finance admin.

create or replace function public.map_finance_historical_center(
  p_center_id uuid,
  p_division_id uuid,
  p_category_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_center public.finance_historical_cost_centers%rowtype;
  v_category public.budget_categories%rowtype;
  v_rule public.finance_historical_rules%rowtype;
  v_promoted uuid;
  v_docs integer:=0;
  v_rules integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_review_ambiguous() then
    raise exception 'Finance center review permission required';
  end if;

  select * into v_center
  from public.finance_historical_cost_centers
  where id=p_center_id
  for update;
  if not found then raise exception 'Historical center not found'; end if;

  select * into v_category
  from public.budget_categories
  where id=p_category_id;
  if not found or v_category.division_id<>p_division_id or coalesce(v_category.is_active,false)=false then
    raise exception 'Category does not belong to selected division';
  end if;
  if v_category.source_key is null then raise exception 'Only canonical workbook categories can be mapped'; end if;
  if coalesce(v_category.category_role,'cost')<>'cost' then raise exception 'Historical supplier costs cannot map to Income'; end if;

  update public.finance_historical_cost_centers
  set division_id=p_division_id,
      category_id=p_category_id,
      mapping_status='mapped',
      mapping_note=coalesce(nullif(trim(p_note),''),'Clasificación confirmada por Raimundo desde revisión financiera'),
      operational_label=coalesce(operational_label, nullif(trim(regexp_replace(historical_label, '^\s*\([^)]*\)\s*', '')), '')),
      updated_at=now()
  where id=p_center_id;

  update public.finance_documents
  set division_id=p_division_id,
      category_id=p_category_id,
      operational_label=coalesce(operational_label, v_center.operational_label, nullif(trim(regexp_replace(v_center.historical_label, '^\s*\([^)]*\)\s*', '')), '')),
      approval_status=case when approval_status='pending_mapping' then 'ready' else approval_status end,
      updated_at=now(),
      source_payload=source_payload||jsonb_build_object(
        'canonical_category_pending',false,
        'historical_center_mapping_id',p_center_id,
        'ambiguous_mapping_reviewed',true,
        'ambiguous_mapping_reviewed_at',now(),
        'ambiguous_mapping_reviewed_by',auth.uid()
      )
  where source_payload->>'historical_cost_center'=v_center.historical_label
    and source_payload->>'source_workbook_hash'=v_center.source_workbook_hash
    and approval_status in ('pending_mapping','ready');
  get diagnostics v_docs=row_count;

  for v_rule in select * from public.finance_historical_rules where historical_cost_center_id=p_center_id loop
    insert into public.finance_classification_rules(
      supplier_name_pattern,supplier_rut,division_id,category_id,minimum_history,minimum_dominance,
      accepted_min,accepted_max,historical_median,historical_count,historical_dominance,historical_currency,
      is_active,source_note,source_supplier_key,source_workbook_hash,source_historical_center_id
    ) values(
      v_rule.supplier_name,null,p_division_id,p_category_id,3,0.8,
      v_rule.accepted_min_clp,v_rule.accepted_max_clp,v_rule.median_clp,v_rule.historical_count,v_rule.dominance,'CLP',
      true,concat('Valentina/Raimundo workbook ',v_center.source_workbook_hash,' · ',v_center.historical_label,' · ',coalesce(v_rule.treatment,'')),
      v_rule.supplier_key,v_center.source_workbook_hash,p_center_id
    )
    on conflict (source_workbook_hash,source_supplier_key,division_id,category_id)
      where source_workbook_hash is not null and source_supplier_key is not null
    do update set
      supplier_name_pattern=excluded.supplier_name_pattern,
      accepted_min=excluded.accepted_min,
      accepted_max=excluded.accepted_max,
      historical_median=excluded.historical_median,
      historical_count=excluded.historical_count,
      historical_dominance=excluded.historical_dominance,
      historical_currency=excluded.historical_currency,
      is_active=true,
      source_note=excluded.source_note,
      source_historical_center_id=excluded.source_historical_center_id,
      updated_at=now()
    returning id into v_promoted;

    update public.finance_historical_rules
    set promoted_rule_id=v_promoted, updated_at=now()
    where id=v_rule.id;
    v_rules:=v_rules+1;
  end loop;

  return jsonb_build_object(
    'success',true,
    'documents_updated',v_docs,
    'rules_promoted',v_rules,
    'center',v_center.historical_label,
    'operational_label',coalesce(v_center.operational_label, nullif(trim(regexp_replace(v_center.historical_label, '^\s*\([^)]*\)\s*', '')), '')),
    'review_owner','Raimundo'
  );
end;
$$;

revoke all on function public.map_finance_historical_center(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.map_finance_historical_center(uuid,uuid,uuid,text) to authenticated, service_role;

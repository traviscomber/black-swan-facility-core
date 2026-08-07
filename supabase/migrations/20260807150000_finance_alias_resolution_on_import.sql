create or replace function public.import_raimundo_finance_workbook(
  p_workbook_hash text,
  p_centers jsonb,
  p_rules jsonb,
  p_documents jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_center jsonb;
  v_rule jsonb;
  v_doc jsonb;
  v_center_id uuid;
  v_resolved_center_id uuid;
  v_division_id uuid;
  v_category_id uuid;
  v_centers integer := 0;
  v_rules integer := 0;
  v_documents integer := 0;
  v_status text;
  v_label text;
  v_approval_status text;
begin
  if not public.can_finance_admin() then
    raise exception 'Finance administration permission required';
  end if;
  if coalesce(p_workbook_hash,'') = '' then
    raise exception 'Missing workbook hash';
  end if;
  if jsonb_typeof(p_centers) <> 'array' or jsonb_typeof(p_rules) <> 'array' or jsonb_typeof(p_documents) <> 'array' then
    raise exception 'Centers, rules and documents must be arrays';
  end if;

  for v_center in select value from jsonb_array_elements(p_centers) loop
    insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency)
    values(p_workbook_hash,v_center->>'label',coalesce((v_center->>'header_frequency')::integer,0))
    on conflict (source_workbook_hash,historical_label)
    do update set header_frequency=excluded.header_frequency,updated_at=now()
    returning id into v_center_id;
    v_centers := v_centers + 1;
  end loop;

  for v_rule in select value from jsonb_array_elements(p_rules) loop
    insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency)
    values(p_workbook_hash,v_rule->>'historical_cost_center',0)
    on conflict (source_workbook_hash,historical_label)
    do update set updated_at=now()
    returning id into v_center_id;

    insert into public.finance_historical_rules(
      source_workbook_hash,supplier_key,supplier_name,historical_cost_center,historical_count,match_count,
      dominance,median_clp,accepted_min_clp,accepted_max_clp,confidence_label,treatment,historical_alternatives,
      historical_cost_center_id
    ) values(
      p_workbook_hash,v_rule->>'supplier_key',v_rule->>'supplier_name',v_rule->>'historical_cost_center',
      coalesce((v_rule->>'historical_count')::integer,0),coalesce((v_rule->>'match_count')::integer,0),
      nullif(v_rule->>'dominance','')::numeric,nullif(v_rule->>'median_clp','')::numeric,
      nullif(v_rule->>'accepted_min_clp','')::numeric,nullif(v_rule->>'accepted_max_clp','')::numeric,
      nullif(v_rule->>'confidence_label',''),nullif(v_rule->>'treatment',''),nullif(v_rule->>'historical_alternatives',''),
      v_center_id
    )
    on conflict (source_workbook_hash,supplier_key)
    do update set supplier_name=excluded.supplier_name,historical_cost_center=excluded.historical_cost_center,
      historical_count=excluded.historical_count,match_count=excluded.match_count,dominance=excluded.dominance,
      median_clp=excluded.median_clp,accepted_min_clp=excluded.accepted_min_clp,accepted_max_clp=excluded.accepted_max_clp,
      confidence_label=excluded.confidence_label,treatment=excluded.treatment,
      historical_alternatives=excluded.historical_alternatives,historical_cost_center_id=excluded.historical_cost_center_id,
      updated_at=now();
    v_rules := v_rules + 1;
  end loop;

  for v_doc in select value from jsonb_array_elements(p_documents) loop
    v_label := coalesce(v_doc->>'historical_cost_center','');
    v_center_id := null;
    v_resolved_center_id := null;
    v_division_id := null;
    v_category_id := null;

    if v_label <> '' then
      insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency)
      values(p_workbook_hash,v_label,0)
      on conflict (source_workbook_hash,historical_label)
      do update set updated_at=now()
      returning id into v_center_id;

      v_resolved_center_id := public.resolve_finance_historical_center_id(p_workbook_hash, v_label);

      select division_id, category_id
      into v_division_id, v_category_id
      from public.finance_historical_cost_centers
      where id = v_resolved_center_id;
    end if;

    if v_division_id is null then
      if v_label ~ '^\(ADM\)' then select id into v_division_id from public.budget_divisions where source_key='admin-general' limit 1;
      elsif v_label ~ '^\((HOSP FARM|HOSPITALITY FARM)\)' then select id into v_division_id from public.budget_divisions where source_key='hospitality-farm' limit 1;
      elsif v_label ~ '^\((HOSP TOROBAYO|HOSPITALITY TOROBAYO)\)' then select id into v_division_id from public.budget_divisions where source_key='hospitality-torobayo' limit 1;
      elsif v_label ~ '^\(LANDSCAPING\)' then select id into v_division_id from public.budget_divisions where source_key='landscaping' limit 1;
      elsif v_label ~ '^\(CATTLE ?\)' then select id into v_division_id from public.budget_divisions where source_key='farming-cattle' limit 1;
      elsif v_label ~ '^\(VINEYARD\)' then select id into v_division_id from public.budget_divisions where source_key='farming-vineyard' limit 1;
      elsif v_label ~ '^\(HORSES\)' then select id into v_division_id from public.budget_divisions where source_key='farming-horses' limit 1;
      elsif v_label ~ '^\(ORCHARD\)' then select id into v_division_id from public.budget_divisions where source_key='farming-orchard' limit 1;
      end if;
    end if;

    v_status := case v_doc->>'classification_status' when 'ready' then 'ready' when 'exception' then 'exception' else 'manual_review' end;
    v_approval_status := case when v_category_id is not null then 'ready' else 'pending_mapping' end;

    insert into public.finance_documents(
      document_type,external_source,external_id,supplier_name,supplier_rut,document_number,document_date,description,
      total_amount,currency,division_id,category_id,classification_status,approval_status,valuation_status,
      classification_reason,historical_count,historical_dominance,accepted_min,accepted_max,amount_in_range,duplicate_key,
      source_payload
    ) values(
      'invoice','raimundo_workbook',v_doc->>'external_id',v_doc->>'supplier_name',nullif(v_doc->>'supplier_rut',''),
      v_doc->>'document_number',(v_doc->>'document_date')::date,nullif(v_doc->>'description',''),
      coalesce((v_doc->>'total_amount')::numeric,0),'CLP',v_division_id,v_category_id,v_status,v_approval_status,'pending',
      nullif(v_doc->>'classification_reason',''),coalesce((v_doc->>'historical_count')::integer,0),
      nullif(v_doc->>'historical_dominance','')::numeric,nullif(v_doc->>'accepted_min','')::numeric,
      nullif(v_doc->>'accepted_max','')::numeric,
      case when nullif(v_doc->>'accepted_min','') is null or nullif(v_doc->>'accepted_max','') is null then null
           else (v_doc->>'total_amount')::numeric between (v_doc->>'accepted_min')::numeric and (v_doc->>'accepted_max')::numeric end,
      md5(v_doc->>'external_id'),
      jsonb_build_object(
        'historical_cost_center',v_label,
        'confidence_label',v_doc->>'confidence_label',
        'decision_source',v_doc->>'decision_source',
        'source_row',nullif(v_doc->>'source_row','')::integer,
        'source_workbook_hash',p_workbook_hash,
        'canonical_category_pending',(v_category_id is null),
        'historical_center_mapping_id',v_resolved_center_id,
        'alias_resolved',(v_resolved_center_id is not null and v_center_id is not null and v_resolved_center_id <> v_center_id)
      )
    ) on conflict do nothing;

    if found then v_documents := v_documents + 1; end if;
  end loop;

  return jsonb_build_object('success',true,'centers',v_centers,'rules',v_rules,'documents_inserted',v_documents,'workbook_hash',p_workbook_hash);
end;
$$;

-- Import the raw operational finance report without weakening the existing approval workflow.
-- The workbook is evidence: pending rows can enter Raimundo's queue, while paid rows are only marked as observed.

create or replace function public.import_raimundo_operational_report(
  p_workbook_hash text,
  p_centers jsonb,
  p_documents jsonb,
  p_paid_observations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_center jsonb;
  v_doc jsonb;
  v_paid jsonb;
  v_center_id uuid;
  v_known_center public.finance_historical_cost_centers%rowtype;
  v_division_id uuid;
  v_category_id uuid;
  v_document_id uuid;
  v_supplier_rut text;
  v_supplier_name text;
  v_document_number text;
  v_document_date date;
  v_total numeric;
  v_pending_inserted integer := 0;
  v_pending_updated integer := 0;
  v_paid_observed integer := 0;
  v_unmatched_paid integer := 0;
  v_centers integer := 0;
  v_approval_status text;
  v_external_id text;
  v_duplicate_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_admin() then raise exception 'Finance administration permission required'; end if;
  if coalesce(trim(p_workbook_hash),'')='' then raise exception 'Missing workbook hash'; end if;
  if jsonb_typeof(p_centers)<>'array' or jsonb_typeof(p_documents)<>'array' or jsonb_typeof(p_paid_observations)<>'array' then
    raise exception 'Centers, documents and paid observations must be arrays';
  end if;

  for v_center in select value from jsonb_array_elements(p_centers) loop
    v_known_center := null;

    select c.*
      into v_known_center
    from public.finance_historical_cost_centers c
    where public.normalize_finance_historical_label(c.historical_label)
          = public.normalize_finance_historical_label(v_center->>'label')
      and c.mapping_status='mapped'
      and c.category_id is not null
    order by c.updated_at desc, c.header_frequency desc
    limit 1;

    insert into public.finance_historical_cost_centers(
      source_workbook_hash,historical_label,header_frequency,
      division_id,category_id,cost_center_id,mapping_status,mapping_note,operational_label
    ) values (
      p_workbook_hash,
      v_center->>'label',
      coalesce((v_center->>'header_frequency')::integer,0),
      v_known_center.division_id,
      v_known_center.category_id,
      v_known_center.cost_center_id,
      case when v_known_center.id is not null then 'mapped' else 'unmapped' end,
      case when v_known_center.id is not null then 'Mapeo heredado de centro histórico previamente confirmado' else null end,
      regexp_replace(v_center->>'label','^\([^)]+\)\s*','','i')
    )
    on conflict (source_workbook_hash,historical_label)
    do update set
      header_frequency=excluded.header_frequency,
      division_id=coalesce(public.finance_historical_cost_centers.division_id,excluded.division_id),
      category_id=coalesce(public.finance_historical_cost_centers.category_id,excluded.category_id),
      cost_center_id=coalesce(public.finance_historical_cost_centers.cost_center_id,excluded.cost_center_id),
      mapping_status=case
        when public.finance_historical_cost_centers.mapping_status='mapped' then 'mapped'
        when excluded.category_id is not null then 'mapped'
        else public.finance_historical_cost_centers.mapping_status
      end,
      mapping_note=coalesce(public.finance_historical_cost_centers.mapping_note,excluded.mapping_note),
      operational_label=coalesce(public.finance_historical_cost_centers.operational_label,excluded.operational_label),
      updated_at=now();

    v_centers := v_centers + 1;
  end loop;

  for v_doc in select value from jsonb_array_elements(p_documents) loop
    v_supplier_rut := nullif(trim(coalesce(v_doc->>'supplier_rut','')),'');
    v_supplier_name := trim(coalesce(v_doc->>'supplier_name','Proveedor sin nombre'));
    v_document_number := trim(coalesce(v_doc->>'document_number',''));
    v_document_date := (v_doc->>'document_date')::date;
    v_total := coalesce((v_doc->>'total_amount')::numeric,0);
    v_division_id := null;
    v_category_id := null;

    select c.division_id,c.category_id
      into v_division_id,v_category_id
    from public.finance_historical_cost_centers c
    where c.source_workbook_hash=p_workbook_hash
      and c.historical_label=v_doc->>'historical_cost_center'
    limit 1;

    v_approval_status := case when v_category_id is not null then 'ready' else 'pending_mapping' end;
    v_external_id := coalesce(nullif(v_doc->>'external_id',''),
      concat('raimundo-report:',coalesce(v_supplier_rut,v_supplier_name),':',v_document_number,':',v_document_date,':',v_total));
    v_duplicate_key := md5(concat_ws('|',
      regexp_replace(upper(coalesce(v_supplier_rut,v_supplier_name)),'[^A-Z0-9]','','g'),
      regexp_replace(upper(v_document_number),'[^A-Z0-9]','','g'),
      v_document_date::text,
      round(v_total,2)::text
    ));

    select d.id
      into v_document_id
    from public.finance_documents d
    where (
      v_supplier_rut is not null
      and regexp_replace(upper(coalesce(d.supplier_rut,'')),'[^A-Z0-9]','','g')
          = regexp_replace(upper(v_supplier_rut),'[^A-Z0-9]','','g')
      or
      v_supplier_rut is null
      and regexp_replace(upper(coalesce(d.supplier_name,'')),'[^A-Z0-9]','','g')
          = regexp_replace(upper(v_supplier_name),'[^A-Z0-9]','','g')
    )
      and regexp_replace(upper(coalesce(d.document_number,'')),'[^A-Z0-9]','','g')
          = regexp_replace(upper(v_document_number),'[^A-Z0-9]','','g')
      and d.document_date=v_document_date
      and abs(coalesce(d.total_amount,0)-v_total)<0.01
    order by (d.external_source='raimundo_workbook') desc,d.created_at
    limit 1;

    if v_document_id is not null then
      update public.finance_documents
      set reconciliation_status='unpaid',
          reconciliation_checked_by=auth.uid(),
          reconciliation_checked_at=now(),
          reconciliation_notes=concat('Pendiente observado en ',coalesce(v_doc->>'source_sheet','informe operacional'),
            ' fila ',coalesce(v_doc->>'source_row','?')),
          source_payload=coalesce(source_payload,'{}'::jsonb)||jsonb_build_object(
            'latest_operational_report_hash',p_workbook_hash,
            'latest_operational_report_status','pending',
            'latest_operational_report_center',v_doc->>'historical_cost_center',
            'latest_operational_report_sheet',v_doc->>'source_sheet',
            'latest_operational_report_row',nullif(v_doc->>'source_row','')::integer,
            'latest_operational_report_type',v_doc->>'reported_type',
            'latest_operational_report_seen_at',now()
          ),
          updated_at=now()
      where id=v_document_id;
      v_pending_updated := v_pending_updated + 1;
    else
      insert into public.finance_documents(
        document_type,external_source,external_id,supplier_name,supplier_rut,document_number,
        document_date,due_date,description,total_amount,currency,division_id,category_id,
        classification_status,approval_status,valuation_status,reconciliation_status,
        reconciliation_checked_by,reconciliation_checked_at,reconciliation_notes,
        classification_reason,duplicate_key,source_payload
      ) values (
        'invoice','raimundo_workbook',v_external_id,v_supplier_name,v_supplier_rut,v_document_number,
        v_document_date,nullif(v_doc->>'due_date','')::date,nullif(v_doc->>'description',''),v_total,'CLP',
        v_division_id,v_category_id,'manual_review',v_approval_status,'pending','unpaid',
        auth.uid(),now(),
        concat('Pendiente observado en ',coalesce(v_doc->>'source_sheet','informe operacional'),
          ' fila ',coalesce(v_doc->>'source_row','?')),
        'Documento incorporado desde conciliación operacional; Raimundo conserva la decisión de imputación y aprobación.',
        v_duplicate_key,
        jsonb_build_object(
          'historical_cost_center',v_doc->>'historical_cost_center',
          'source_workbook_hash',p_workbook_hash,
          'source_sheet',v_doc->>'source_sheet',
          'source_row',nullif(v_doc->>'source_row','')::integer,
          'reported_type',v_doc->>'reported_type',
          'decision_source','operational_reconciliation_report',
          'canonical_category_pending',(v_category_id is null),
          'latest_operational_report_status','pending',
          'latest_operational_report_seen_at',now()
        )
      )
      on conflict do nothing
      returning id into v_document_id;

      if v_document_id is not null then
        v_pending_inserted := v_pending_inserted + 1;
      end if;
    end if;
  end loop;

  for v_paid in select value from jsonb_array_elements(p_paid_observations) loop
    v_supplier_rut := nullif(trim(coalesce(v_paid->>'supplier_rut','')),'');
    v_supplier_name := trim(coalesce(v_paid->>'supplier_name',''));
    v_document_number := trim(coalesce(v_paid->>'document_number',''));
    v_document_date := (v_paid->>'document_date')::date;
    v_total := coalesce((v_paid->>'total_amount')::numeric,0);
    v_document_id := null;

    select d.id
      into v_document_id
    from public.finance_documents d
    where (
      v_supplier_rut is not null
      and regexp_replace(upper(coalesce(d.supplier_rut,'')),'[^A-Z0-9]','','g')
          = regexp_replace(upper(v_supplier_rut),'[^A-Z0-9]','','g')
      or
      v_supplier_rut is null
      and regexp_replace(upper(coalesce(d.supplier_name,'')),'[^A-Z0-9]','','g')
          = regexp_replace(upper(v_supplier_name),'[^A-Z0-9]','','g')
    )
      and regexp_replace(upper(coalesce(d.document_number,'')),'[^A-Z0-9]','','g')
          = regexp_replace(upper(v_document_number),'[^A-Z0-9]','','g')
      and d.document_date=v_document_date
      and abs(coalesce(d.total_amount,0)-v_total)<0.01
    order by (d.external_source='raimundo_workbook') desc,d.created_at
    limit 1;

    if v_document_id is null then
      v_unmatched_paid := v_unmatched_paid + 1;
      continue;
    end if;

    update public.finance_documents
    set reconciliation_status='paid_observed',
        reconciliation_checked_by=auth.uid(),
        reconciliation_checked_at=now(),
        reconciliation_notes=concat(
          'Pago observado en ',v_paid->>'source_sheet',' fila ',v_paid->>'source_row',
          case when nullif(v_paid->>'observed_payment_date','') is not null
            then concat(' · fecha ',v_paid->>'observed_payment_date') else '' end,
          '. Requiere conciliación bancaria antes de marcar reconciliado.'
        ),
        source_payload=coalesce(source_payload,'{}'::jsonb)||jsonb_build_object(
          'latest_operational_report_hash',p_workbook_hash,
          'latest_operational_report_status','paid_observed',
          'latest_operational_report_center',v_paid->>'historical_cost_center',
          'latest_operational_report_sheet',v_paid->>'source_sheet',
          'latest_operational_report_row',nullif(v_paid->>'source_row','')::integer,
          'latest_operational_report_type',v_paid->>'reported_type',
          'observed_payment_date',nullif(v_paid->>'observed_payment_date',''),
          'latest_operational_report_seen_at',now()
        ),
        updated_at=now()
    where id=v_document_id;

    v_paid_observed := v_paid_observed + 1;
  end loop;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_workbook',gen_random_uuid(),'UPDATE','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    '{}'::jsonb,
    jsonb_build_object(
      'operation','import_raimundo_operational_report',
      'workbook_hash',p_workbook_hash,
      'centers',v_centers,
      'pending_inserted',v_pending_inserted,
      'pending_updated',v_pending_updated,
      'paid_observed',v_paid_observed,
      'unmatched_paid',v_unmatched_paid
    ),
    array['operational_reconciliation_report'],now()
  );

  return jsonb_build_object(
    'success',true,
    'workbook_hash',p_workbook_hash,
    'centers',v_centers,
    'pending_inserted',v_pending_inserted,
    'pending_updated',v_pending_updated,
    'paid_observed',v_paid_observed,
    'unmatched_paid',v_unmatched_paid
  );
end;
$function$;

revoke all on function public.import_raimundo_operational_report(text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.import_raimundo_operational_report(text,jsonb,jsonb,jsonb) to authenticated;

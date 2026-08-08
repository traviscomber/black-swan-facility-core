-- Complete the PDF-only SII intake cycle without fabricating fiscal data.
-- A PDF is first stored privately in finance_sii_uploads. An authorized Finance user
-- then supplies the minimum fiscal metadata; the existing canonical classification
-- rules are applied and a finance_document is created idempotently.

create or replace function public.finalize_sii_pdf_upload(
  p_upload_id uuid,
  p_actor_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_upload public.finance_sii_uploads%rowtype;
  v_existing_document public.finance_documents%rowtype;
  v_document_id uuid;
  v_supplier_id uuid;
  v_supplier_name text;
  v_supplier_rut text;
  v_rut_key text;
  v_document_number text;
  v_document_date date;
  v_due_date date;
  v_document_type text;
  v_net numeric;
  v_tax numeric;
  v_total numeric;
  v_currency text;
  v_duplicate_key text;
  v_history_count integer := 0;
  v_top_count integer := 0;
  v_dominance numeric := null;
  v_division_id uuid;
  v_category_id uuid;
  v_cost_center_id uuid;
  v_classification_status text := 'manual_review';
  v_approval_status text := 'pending_mapping';
  v_reason text := 'Sin historial aprobado suficiente para clasificación automática.';
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_actor_id is null or not exists (select 1 from auth.users where id = p_actor_id) then raise exception 'Valid actor is required'; end if;

  select * into v_upload
  from public.finance_sii_uploads
  where id = p_upload_id
  for update;

  if not found then raise exception 'SII upload not found'; end if;
  if v_upload.upload_kind <> 'pdf' then raise exception 'Only PDF uploads can be finalized with manual metadata'; end if;

  if v_upload.finance_document_id is not null then
    return jsonb_build_object('upload_id',v_upload.id,'document_id',v_upload.finance_document_id,'status','duplicate','duplicate',true);
  end if;

  v_supplier_name := nullif(trim(p_metadata->>'supplier_name'),'');
  v_supplier_rut := nullif(trim(p_metadata->>'supplier_rut'),'');
  v_document_number := nullif(trim(p_metadata->>'document_number'),'');
  v_document_type := coalesce(nullif(trim(p_metadata->>'document_type'),''),'invoice');
  v_currency := upper(coalesce(nullif(trim(p_metadata->>'currency'),''),'CLP'));

  begin v_document_date := (p_metadata->>'document_date')::date; exception when others then v_document_date := null; end;
  begin v_due_date := nullif(p_metadata->>'due_date','')::date; exception when others then v_due_date := null; end;
  begin v_net := nullif(p_metadata->>'net_amount','')::numeric; exception when others then v_net := null; end;
  begin v_tax := nullif(p_metadata->>'tax_amount','')::numeric; exception when others then v_tax := null; end;
  begin v_total := nullif(p_metadata->>'total_amount','')::numeric; exception when others then v_total := null; end;

  if v_supplier_name is null or v_supplier_rut is null or v_document_number is null or v_document_date is null or v_total is null or v_total < 0 then
    raise exception 'Proveedor, RUT, folio, fecha y total son obligatorios';
  end if;
  if v_document_type not in ('invoice','credit_note','debit_note','other') then raise exception 'Unsupported document type'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a 3-letter ISO code'; end if;
  if v_net is not null and v_net < 0 then raise exception 'Net amount cannot be negative'; end if;
  if v_tax is not null and v_tax < 0 then raise exception 'Tax amount cannot be negative'; end if;

  v_rut_key := regexp_replace(upper(v_supplier_rut),'[^0-9K]','','g');
  if length(v_rut_key) < 2 then raise exception 'Supplier RUT is invalid'; end if;
  v_duplicate_key := concat('sii:',v_rut_key,':',v_document_type,':',upper(v_document_number));

  select * into v_existing_document
  from public.finance_documents
  where duplicate_key = v_duplicate_key
  limit 1;

  if found then
    update public.finance_sii_uploads
    set status='duplicate', finance_document_id=v_existing_document.id,
        parsed_payload=coalesce(parsed_payload,'{}'::jsonb) || p_metadata || jsonb_build_object('extraction_method','manual_pdf_metadata'),
        error_message=null, updated_at=now()
    where id=v_upload.id;

    return jsonb_build_object('upload_id',v_upload.id,'document_id',v_existing_document.id,'status','duplicate','duplicate',true);
  end if;

  select s.id into v_supplier_id
  from public.suppliers s
  where s.rut is not null
    and regexp_replace(upper(s.rut),'[^0-9K]','','g')=v_rut_key
  order by s.is_active desc,s.updated_at desc
  limit 1;

  select count(*)::integer into v_history_count
  from public.finance_documents d
  where d.approval_status='approved'
    and d.division_id is not null
    and d.category_id is not null
    and d.supplier_rut is not null
    and regexp_replace(upper(d.supplier_rut),'[^0-9K]','','g')=v_rut_key;

  if v_history_count > 0 then
    select d.division_id,d.category_id,d.cost_center_id,count(*)::integer
      into v_division_id,v_category_id,v_cost_center_id,v_top_count
    from public.finance_documents d
    where d.approval_status='approved'
      and d.division_id is not null
      and d.category_id is not null
      and d.supplier_rut is not null
      and regexp_replace(upper(d.supplier_rut),'[^0-9K]','','g')=v_rut_key
    group by d.division_id,d.category_id,d.cost_center_id
    order by count(*) desc,max(d.approved_at) desc nulls last
    limit 1;
    v_dominance := v_top_count::numeric/v_history_count::numeric;
  end if;

  if v_history_count >= 3 and coalesce(v_dominance,0) >= 0.80 and v_division_id is not null and v_category_id is not null then
    v_classification_status := 'ready';
    v_approval_status := 'ready';
    v_reason := format('Clasificación sugerida por historial aprobado del proveedor: %s/%s documentos (%s%%).',v_top_count,v_history_count,round(v_dominance*100));
  end if;

  insert into public.finance_documents(
    document_type,external_source,external_id,supplier_id,supplier_name,supplier_rut,document_number,document_date,due_date,description,
    net_amount,tax_amount,total_amount,currency,division_id,category_id,cost_center_id,classification_status,confidence,classification_reason,
    historical_count,historical_dominance,duplicate_key,source_payload,approval_status
  ) values (
    v_document_type,'sii_manual_pdf',v_duplicate_key,v_supplier_id,v_supplier_name,v_supplier_rut,v_document_number,v_document_date,v_due_date,
    'Documento tributario SII subido manualmente desde PDF',v_net,v_tax,v_total,v_currency,
    case when v_approval_status='ready' then v_division_id else null end,
    case when v_approval_status='ready' then v_category_id else null end,
    case when v_approval_status='ready' then v_cost_center_id else null end,
    v_classification_status,v_dominance,v_reason,v_history_count,v_dominance,v_duplicate_key,
    coalesce(v_upload.parsed_payload,'{}'::jsonb) || p_metadata || jsonb_build_object(
      'extraction_method','manual_pdf_metadata',
      'sii_upload_id',v_upload.id,
      'storage_bucket',v_upload.storage_bucket,
      'storage_path',v_upload.storage_path,
      'original_filename',v_upload.original_filename
    ),
    v_approval_status
  ) returning id into v_document_id;

  update public.finance_sii_uploads
  set status=case when v_approval_status='ready' then 'classified' else 'linked' end,
      finance_document_id=v_document_id,
      parsed_payload=coalesce(parsed_payload,'{}'::jsonb) || p_metadata || jsonb_build_object('extraction_method','manual_pdf_metadata'),
      error_message=null,
      updated_at=now()
  where id=v_upload.id;

  insert into public.critical_action_audit_log(entity_type,entity_id,action,category,actor_id,new_data,changed_fields)
  values('finance_document',v_document_id,'sii_pdf_metadata_completed','finance',p_actor_id,
    jsonb_build_object('upload_id',v_upload.id,'document_type',v_document_type,'supplier_rut',v_supplier_rut,'approval_status',v_approval_status,'classification_status',v_classification_status),
    array['source','metadata','classification','approval_status']::text[]);

  return jsonb_build_object('upload_id',v_upload.id,'document_id',v_document_id,'status',v_approval_status,'classification_status',v_classification_status,'duplicate',false);
end;
$$;

revoke all on function public.finalize_sii_pdf_upload(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_sii_pdf_upload(uuid,uuid,jsonb) to service_role;

comment on function public.finalize_sii_pdf_upload(uuid,uuid,jsonb) is
  'Service-only finalization for PDF-only SII intake. Requires explicit fiscal metadata, applies deterministic duplicate prevention and historical classification, then creates the canonical finance_document.';

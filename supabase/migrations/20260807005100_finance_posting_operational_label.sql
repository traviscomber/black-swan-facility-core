create or replace function public.approve_finance_document(p_document_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_doc public.finance_documents%rowtype; v_category public.budget_categories%rowtype; v_posting_id uuid; v_signed_eur numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;
  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approval_status <> 'ready' then raise exception 'Document is not ready for approval'; end if;
  if v_doc.division_id is null or v_doc.category_id is null then raise exception 'Canonical P&L center and category are required'; end if;
  select * into v_category from public.budget_categories where id=v_doc.category_id;
  if not found or v_category.division_id<>v_doc.division_id then raise exception 'Budget category does not belong to selected P&L center'; end if;
  if v_category.source_key is null then raise exception 'Legacy category cannot receive canonical finance postings'; end if;
  if coalesce(v_category.category_role,'cost')<>'cost' then raise exception 'Supplier documents cannot be posted to an income category'; end if;
  if upper(coalesce(v_doc.currency,''))<>'EUR' then
    update public.finance_documents set approval_status='pending_valuation',valuation_status='pending',approved_by=auth.uid(),approved_at=now(),decision_notes=p_notes,rejected_by=null,rejected_at=null,updated_at=now() where id=p_document_id;
    return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',null,'approval_status','pending_valuation');
  end if;
  v_signed_eur:=case when v_doc.document_type='credit_note' then -abs(v_doc.total_amount) else abs(v_doc.total_amount) end;
  insert into public.financial_postings(division_id,category_id,cost_center_id,operational_label,posting_type,transaction_date,source_module,source_table,source_id,source_label,source_amount,source_currency,amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by)
  values(v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,v_doc.operational_label,'cost',v_doc.document_date,'finance','finance_documents',v_doc.id,coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),v_doc.total_amount,'EUR',v_signed_eur,1,v_doc.document_date,'posted',auth.uid(),now(),jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'confidence',v_doc.confidence,'classification_reason',v_doc.classification_reason,'operational_label',v_doc.operational_label),auth.uid())
  on conflict do nothing returning id into v_posting_id;
  if v_posting_id is null then select id into v_posting_id from public.financial_postings where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1; end if;
  update public.finance_documents set approval_status='approved',valuation_status='not_required',amount_eur=v_signed_eur,fx_rate_to_eur=1,fx_date=v_doc.document_date,approved_by=auth.uid(),approved_at=now(),decision_notes=p_notes,financial_posting_id=v_posting_id,rejected_by=null,rejected_at=null,updated_at=now() where id=p_document_id;
  return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',v_posting_id,'approval_status','approved');
end;
$$;

create or replace function public.value_finance_document_eur(p_document_id uuid, p_amount_eur numeric, p_fx_rate_to_eur numeric, p_fx_date date, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_doc public.finance_documents%rowtype; v_category public.budget_categories%rowtype; v_posting_id uuid; v_signed_eur numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_admin() then raise exception 'Finance administration permission required'; end if;
  if p_amount_eur is null or p_amount_eur<=0 or p_fx_rate_to_eur is null or p_fx_rate_to_eur<=0 or p_fx_date is null then raise exception 'Valid EUR valuation, FX rate and FX date are required'; end if;
  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approval_status<>'pending_valuation' or v_doc.approved_at is null then raise exception 'Document is not approved and pending valuation'; end if;
  select * into v_category from public.budget_categories where id=v_doc.category_id;
  if not found or v_category.source_key is null or coalesce(v_category.category_role,'cost')<>'cost' then raise exception 'Canonical cost category required'; end if;
  v_signed_eur:=case when v_doc.document_type='credit_note' then -abs(p_amount_eur) else abs(p_amount_eur) end;
  insert into public.financial_postings(division_id,category_id,cost_center_id,operational_label,posting_type,transaction_date,source_module,source_table,source_id,source_label,source_amount,source_currency,amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by)
  values(v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,v_doc.operational_label,'cost',v_doc.document_date,'finance','finance_documents',v_doc.id,coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),v_doc.total_amount,upper(v_doc.currency),v_signed_eur,p_fx_rate_to_eur,p_fx_date,'posted',v_doc.approved_by,v_doc.approved_at,jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'valuation_notes',p_notes,'operational_label',v_doc.operational_label),auth.uid())
  on conflict do nothing returning id into v_posting_id;
  if v_posting_id is null then select id into v_posting_id from public.financial_postings where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1; end if;
  update public.finance_documents set approval_status='approved',valuation_status='valued',amount_eur=v_signed_eur,fx_rate_to_eur=p_fx_rate_to_eur,fx_date=p_fx_date,financial_posting_id=v_posting_id,decision_notes=coalesce(nullif(trim(p_notes),''),decision_notes),updated_at=now() where id=p_document_id;
  return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',v_posting_id,'approval_status','approved');
end;
$$;

drop view if exists public.finance_approval_queue;

alter table public.finance_documents
  add column if not exists approval_status text not null default 'pending_mapping',
  add column if not exists valuation_status text not null default 'not_required',
  add column if not exists amount_eur numeric,
  add column if not exists fx_rate_to_eur numeric,
  add column if not exists fx_date date;

alter table public.finance_documents drop constraint if exists finance_documents_approval_status_check;
alter table public.finance_documents add constraint finance_documents_approval_status_check check (approval_status in ('pending_mapping','ready','pending_valuation','approved','rejected'));
alter table public.finance_documents drop constraint if exists finance_documents_valuation_status_check;
alter table public.finance_documents add constraint finance_documents_valuation_status_check check (valuation_status in ('not_required','pending','valued'));

alter table public.finance_classification_rules
  add column if not exists source_supplier_key text,
  add column if not exists source_workbook_hash text,
  add column if not exists source_historical_center_id uuid references public.finance_historical_cost_centers(id);

create unique index if not exists finance_classification_rules_source_identity_uq
  on public.finance_classification_rules(source_workbook_hash, source_supplier_key, division_id, category_id)
  where source_workbook_hash is not null and source_supplier_key is not null;

update public.finance_documents d
set approval_status = case
      when d.rejected_at is not null or d.classification_status='rejected' then 'rejected'
      when d.approved_at is not null or d.classification_status='approved' then case when upper(d.currency)='EUR' and d.financial_posting_id is not null then 'approved' else 'pending_valuation' end
      when d.division_id is null or d.category_id is null then 'pending_mapping'
      else 'ready'
    end,
    valuation_status = case when upper(d.currency)='EUR' then 'not_required' when d.amount_eur is not null and d.fx_rate_to_eur is not null and d.fx_date is not null then 'valued' else 'pending' end,
    updated_at=now();

create or replace function public.can_finance_approve() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select case when public.current_app_role() in ('admin','service_role') then true when auth.uid() is null then false else exists (
    select 1 from public.employees e where e.is_active and lower(coalesce(e.email,''))=lower(coalesce(auth.jwt()->>'email','')) and e.role in ('Administrador del campo','CEO')
  ) end;
$$;

create or replace function public.can_finance_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select case when public.current_app_role() in ('admin','service_role') then true when auth.uid() is null then false else exists (
    select 1 from public.employees e where e.is_active and lower(coalesce(e.email,''))=lower(coalesce(auth.jwt()->>'email','')) and e.role in ('Administrador del campo','CEO')
  ) end;
$$;

create or replace function public.approve_finance_document(p_document_id uuid,p_notes text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
  insert into public.financial_postings(division_id,category_id,cost_center_id,posting_type,transaction_date,source_module,source_table,source_id,source_label,source_amount,source_currency,amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by)
  values(v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,'cost',v_doc.document_date,'finance','finance_documents',v_doc.id,coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),v_doc.total_amount,'EUR',v_signed_eur,1,v_doc.document_date,'posted',auth.uid(),now(),jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'confidence',v_doc.confidence,'classification_reason',v_doc.classification_reason),auth.uid())
  on conflict do nothing returning id into v_posting_id;
  if v_posting_id is null then select id into v_posting_id from public.financial_postings where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1; end if;
  update public.finance_documents set approval_status='approved',valuation_status='not_required',amount_eur=v_signed_eur,fx_rate_to_eur=1,fx_date=v_doc.document_date,approved_by=auth.uid(),approved_at=now(),decision_notes=p_notes,financial_posting_id=v_posting_id,rejected_by=null,rejected_at=null,updated_at=now() where id=p_document_id;
  return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',v_posting_id,'approval_status','approved');
end; $$;

create or replace function public.reject_finance_document(p_document_id uuid,p_notes text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;
  if coalesce(trim(p_notes),'')='' then raise exception 'Rejection notes are required'; end if;
  update public.finance_documents set approval_status='rejected',rejected_by=auth.uid(),rejected_at=now(),decision_notes=p_notes,updated_at=now() where id=p_document_id and approval_status in ('pending_mapping','ready','pending_valuation');
  if not found then raise exception 'Pending finance document not found'; end if;
  return jsonb_build_object('success',true,'document_id',p_document_id,'approval_status','rejected');
end; $$;

create or replace function public.value_finance_document_eur(p_document_id uuid,p_amount_eur numeric,p_fx_rate_to_eur numeric,p_fx_date date,p_notes text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
  insert into public.financial_postings(division_id,category_id,cost_center_id,posting_type,transaction_date,source_module,source_table,source_id,source_label,source_amount,source_currency,amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by)
  values(v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,'cost',v_doc.document_date,'finance','finance_documents',v_doc.id,coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),v_doc.total_amount,upper(v_doc.currency),v_signed_eur,p_fx_rate_to_eur,p_fx_date,'posted',v_doc.approved_by,v_doc.approved_at,jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'valuation_notes',p_notes),auth.uid())
  on conflict do nothing returning id into v_posting_id;
  if v_posting_id is null then select id into v_posting_id from public.financial_postings where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1; end if;
  update public.finance_documents set approval_status='approved',valuation_status='valued',amount_eur=v_signed_eur,fx_rate_to_eur=p_fx_rate_to_eur,fx_date=p_fx_date,financial_posting_id=v_posting_id,decision_notes=coalesce(nullif(trim(p_notes),''),decision_notes),updated_at=now() where id=p_document_id;
  return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',v_posting_id,'approval_status','approved');
end; $$;

create or replace function public.map_finance_historical_center(p_center_id uuid,p_division_id uuid,p_category_id uuid,p_note text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_center public.finance_historical_cost_centers%rowtype; v_category public.budget_categories%rowtype; v_rule public.finance_historical_rules%rowtype; v_promoted uuid; v_docs integer:=0; v_rules integer:=0;
begin
  if not public.can_finance_admin() then raise exception 'Finance administration permission required'; end if;
  select * into v_center from public.finance_historical_cost_centers where id=p_center_id for update;
  if not found then raise exception 'Historical center not found'; end if;
  select * into v_category from public.budget_categories where id=p_category_id;
  if not found or v_category.division_id<>p_division_id or coalesce(v_category.is_active,false)=false then raise exception 'Category does not belong to selected division'; end if;
  if v_category.source_key is null then raise exception 'Only canonical workbook categories can be mapped'; end if;
  if coalesce(v_category.category_role,'cost')<>'cost' then raise exception 'Historical supplier costs cannot map to Income'; end if;
  update public.finance_historical_cost_centers set division_id=p_division_id,category_id=p_category_id,mapping_status='mapped',mapping_note=p_note,updated_at=now() where id=p_center_id;
  update public.finance_documents set division_id=p_division_id,category_id=p_category_id,approval_status=case when approval_status='pending_mapping' then 'ready' else approval_status end,updated_at=now(),source_payload=source_payload||jsonb_build_object('canonical_category_pending',false,'historical_center_mapping_id',p_center_id)
  where source_payload->>'historical_cost_center'=v_center.historical_label and source_payload->>'source_workbook_hash'=v_center.source_workbook_hash and approval_status in ('pending_mapping','ready');
  get diagnostics v_docs=row_count;
  for v_rule in select * from public.finance_historical_rules where historical_cost_center_id=p_center_id loop
    insert into public.finance_classification_rules(supplier_name_pattern,supplier_rut,division_id,category_id,minimum_history,minimum_dominance,accepted_min,accepted_max,historical_median,historical_count,historical_dominance,historical_currency,is_active,source_note,source_supplier_key,source_workbook_hash,source_historical_center_id)
    values(v_rule.supplier_name,null,p_division_id,p_category_id,3,0.8,v_rule.accepted_min_clp,v_rule.accepted_max_clp,v_rule.median_clp,v_rule.historical_count,v_rule.dominance,'CLP',true,concat('Valentina/Raimundo workbook ',v_center.source_workbook_hash,' · ',v_center.historical_label,' · ',coalesce(v_rule.treatment,'')),v_rule.supplier_key,v_center.source_workbook_hash,p_center_id)
    on conflict (source_workbook_hash,source_supplier_key,division_id,category_id) where source_workbook_hash is not null and source_supplier_key is not null
    do update set supplier_name_pattern=excluded.supplier_name_pattern,accepted_min=excluded.accepted_min,accepted_max=excluded.accepted_max,historical_median=excluded.historical_median,historical_count=excluded.historical_count,historical_dominance=excluded.historical_dominance,historical_currency=excluded.historical_currency,is_active=true,source_note=excluded.source_note,source_historical_center_id=excluded.source_historical_center_id,updated_at=now()
    returning id into v_promoted;
    update public.finance_historical_rules set promoted_rule_id=v_promoted,updated_at=now() where id=v_rule.id;
    v_rules:=v_rules+1;
  end loop;
  return jsonb_build_object('success',true,'documents_updated',v_docs,'rules_promoted',v_rules,'center',v_center.historical_label);
end; $$;

create or replace function public.import_raimundo_finance_workbook(p_workbook_hash text,p_centers jsonb,p_rules jsonb,p_documents jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_center jsonb; v_rule jsonb; v_doc jsonb; v_center_id uuid; v_division_id uuid; v_centers integer:=0; v_rules integer:=0; v_documents integer:=0; v_status text; v_label text;
begin
  if not public.can_finance_admin() then raise exception 'Finance administration permission required'; end if;
  if coalesce(p_workbook_hash,'')='' then raise exception 'Missing workbook hash'; end if;
  if jsonb_typeof(p_centers)<>'array' or jsonb_typeof(p_rules)<>'array' or jsonb_typeof(p_documents)<>'array' then raise exception 'Centers, rules and documents must be arrays'; end if;
  for v_center in select value from jsonb_array_elements(p_centers) loop
    insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency) values(p_workbook_hash,v_center->>'label',coalesce((v_center->>'header_frequency')::integer,0)) on conflict (source_workbook_hash,historical_label) do update set header_frequency=excluded.header_frequency,updated_at=now() returning id into v_center_id; v_centers:=v_centers+1;
  end loop;
  for v_rule in select value from jsonb_array_elements(p_rules) loop
    insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency) values(p_workbook_hash,v_rule->>'historical_cost_center',0) on conflict (source_workbook_hash,historical_label) do update set updated_at=now() returning id into v_center_id;
    insert into public.finance_historical_rules(source_workbook_hash,supplier_key,supplier_name,historical_cost_center,historical_count,match_count,dominance,median_clp,accepted_min_clp,accepted_max_clp,confidence_label,treatment,historical_alternatives,historical_cost_center_id)
    values(p_workbook_hash,v_rule->>'supplier_key',v_rule->>'supplier_name',v_rule->>'historical_cost_center',coalesce((v_rule->>'historical_count')::integer,0),coalesce((v_rule->>'match_count')::integer,0),nullif(v_rule->>'dominance','')::numeric,nullif(v_rule->>'median_clp','')::numeric,nullif(v_rule->>'accepted_min_clp','')::numeric,nullif(v_rule->>'accepted_max_clp','')::numeric,nullif(v_rule->>'confidence_label',''),nullif(v_rule->>'treatment',''),nullif(v_rule->>'historical_alternatives',''),v_center_id)
    on conflict (source_workbook_hash,supplier_key) do update set supplier_name=excluded.supplier_name,historical_cost_center=excluded.historical_cost_center,historical_count=excluded.historical_count,match_count=excluded.match_count,dominance=excluded.dominance,median_clp=excluded.median_clp,accepted_min_clp=excluded.accepted_min_clp,accepted_max_clp=excluded.accepted_max_clp,confidence_label=excluded.confidence_label,treatment=excluded.treatment,historical_alternatives=excluded.historical_alternatives,historical_cost_center_id=excluded.historical_cost_center_id,updated_at=now(); v_rules:=v_rules+1;
  end loop;
  for v_doc in select value from jsonb_array_elements(p_documents) loop
    v_label:=coalesce(v_doc->>'historical_cost_center','');
    if v_label<>'' then insert into public.finance_historical_cost_centers(source_workbook_hash,historical_label,header_frequency) values(p_workbook_hash,v_label,0) on conflict (source_workbook_hash,historical_label) do update set updated_at=now(); end if;
    v_division_id:=null;
    if v_label ~ '^\(ADM\)' then select id into v_division_id from public.budget_divisions where source_key='admin-general' limit 1;
    elsif v_label ~ '^\((HOSP FARM|HOSPITALITY FARM)\)' then select id into v_division_id from public.budget_divisions where source_key='hospitality-farm' limit 1;
    elsif v_label ~ '^\((HOSP TOROBAYO|HOSPITALITY TOROBAYO)\)' then select id into v_division_id from public.budget_divisions where source_key='hospitality-torobayo' limit 1;
    elsif v_label ~ '^\(LANDSCAPING\)' then select id into v_division_id from public.budget_divisions where source_key='landscaping' limit 1;
    elsif v_label ~ '^\(CATTLE ?\)' then select id into v_division_id from public.budget_divisions where source_key='farming-cattle' limit 1;
    elsif v_label ~ '^\(VINEYARD\)' then select id into v_division_id from public.budget_divisions where source_key='farming-vineyard' limit 1;
    elsif v_label ~ '^\(HORSES\)' then select id into v_division_id from public.budget_divisions where source_key='farming-horses' limit 1;
    elsif v_label ~ '^\(ORCHARD\)' then select id into v_division_id from public.budget_divisions where source_key='farming-orchard' limit 1; end if;
    v_status:=case v_doc->>'classification_status' when 'ready' then 'ready' when 'exception' then 'exception' else 'manual_review' end;
    insert into public.finance_documents(document_type,external_source,external_id,supplier_name,supplier_rut,document_number,document_date,description,total_amount,currency,division_id,classification_status,approval_status,valuation_status,classification_reason,historical_count,historical_dominance,accepted_min,accepted_max,amount_in_range,duplicate_key,source_payload)
    values('invoice','raimundo_workbook',v_doc->>'external_id',v_doc->>'supplier_name',nullif(v_doc->>'supplier_rut',''),v_doc->>'document_number',(v_doc->>'document_date')::date,nullif(v_doc->>'description',''),coalesce((v_doc->>'total_amount')::numeric,0),'CLP',v_division_id,v_status,'pending_mapping','pending',nullif(v_doc->>'classification_reason',''),coalesce((v_doc->>'historical_count')::integer,0),nullif(v_doc->>'historical_dominance','')::numeric,nullif(v_doc->>'accepted_min','')::numeric,nullif(v_doc->>'accepted_max','')::numeric,case when nullif(v_doc->>'accepted_min','') is null or nullif(v_doc->>'accepted_max','') is null then null else (v_doc->>'total_amount')::numeric between (v_doc->>'accepted_min')::numeric and (v_doc->>'accepted_max')::numeric end,md5(v_doc->>'external_id'),jsonb_build_object('historical_cost_center',v_label,'confidence_label',v_doc->>'confidence_label','decision_source',v_doc->>'decision_source','source_row',nullif(v_doc->>'source_row','')::integer,'source_workbook_hash',p_workbook_hash,'canonical_category_pending',true)) on conflict do nothing;
    if found then v_documents:=v_documents+1; end if;
  end loop;
  return jsonb_build_object('success',true,'centers',v_centers,'rules',v_rules,'documents_inserted',v_documents,'workbook_hash',p_workbook_hash);
end; $$;

create view public.finance_approval_queue as
select d.id,d.document_type,d.external_source,d.external_id,d.supplier_name,d.supplier_rut,d.document_number,d.document_date,d.due_date,d.description,d.net_amount,d.tax_amount,d.total_amount,d.currency,d.classification_status,d.approval_status,d.valuation_status,d.amount_eur,d.fx_rate_to_eur,d.fx_date,d.confidence,d.classification_reason,d.historical_count,d.historical_dominance,d.historical_median,d.accepted_min,d.accepted_max,d.amount_in_range,d.decision_notes,d.approved_at,d.rejected_at,d.division_id,bd.name as division_name,bd.source_key as division_key,d.category_id,bc.name as category_name,bc.source_key as category_key,bc.category_role,d.cost_center_id,coalesce(cc.name,nullif(d.source_payload->>'historical_cost_center','')) as cost_center_name,cc.code as cost_center_code,d.source_payload->>'confidence_label' as confidence_label,case d.approval_status when 'pending_mapping' then 1 when 'ready' then 2 when 'pending_valuation' then 3 when 'approved' then 4 when 'rejected' then 5 else 9 end as queue_order
from public.finance_documents d left join public.budget_divisions bd on bd.id=d.division_id left join public.budget_categories bc on bc.id=d.category_id left join public.cost_centers cc on cc.id=d.cost_center_id;

grant select on public.finance_approval_queue to authenticated;
grant execute on function public.can_finance_approve() to authenticated;
grant execute on function public.can_finance_admin() to authenticated;
grant execute on function public.approve_finance_document(uuid,text) to authenticated;
grant execute on function public.reject_finance_document(uuid,text) to authenticated;
grant execute on function public.value_finance_document_eur(uuid,numeric,numeric,date,text) to authenticated;
grant execute on function public.map_finance_historical_center(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.import_raimundo_finance_workbook(text,jsonb,jsonb,jsonb) to authenticated;

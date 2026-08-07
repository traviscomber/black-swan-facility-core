alter table public.finance_historical_cost_centers add column if not exists operational_label text;
alter table public.finance_documents add column if not exists operational_label text;
alter table public.financial_postings add column if not exists operational_label text;

update public.finance_historical_cost_centers
set operational_label = nullif(trim(regexp_replace(historical_label, '^\s*\([^)]*\)\s*', '')), '')
where operational_label is null;

update public.finance_documents
set operational_label = nullif(trim(regexp_replace(coalesce(source_payload->>'historical_cost_center',''), '^\s*\([^)]*\)\s*', '')), '')
where operational_label is null;

create or replace view public.finance_approval_queue as
select
  d.id, d.document_type, d.external_source, d.external_id, d.supplier_name, d.supplier_rut,
  d.document_number, d.document_date, d.due_date, d.description, d.net_amount, d.tax_amount,
  d.total_amount, d.currency, d.classification_status, d.approval_status, d.valuation_status,
  d.amount_eur, d.fx_rate_to_eur, d.fx_date, d.confidence, d.classification_reason,
  d.historical_count, d.historical_dominance, d.historical_median, d.accepted_min, d.accepted_max,
  d.amount_in_range, d.decision_notes, d.approved_at, d.rejected_at, d.division_id,
  bd.name as division_name, bd.source_key as division_key, d.category_id, bc.name as category_name,
  bc.source_key as category_key, bc.category_role, d.cost_center_id,
  coalesce(cc.name, nullif(d.source_payload->>'historical_cost_center','')) as cost_center_name,
  cc.code as cost_center_code,
  d.source_payload->>'confidence_label' as confidence_label,
  case d.approval_status when 'pending_mapping' then 1 when 'ready' then 2 when 'pending_valuation' then 3 when 'approved' then 4 when 'rejected' then 5 else 9 end as queue_order,
  d.operational_label
from public.finance_documents d
left join public.budget_divisions bd on bd.id=d.division_id
left join public.budget_categories bc on bc.id=d.category_id
left join public.cost_centers cc on cc.id=d.cost_center_id;

create or replace view public.finance_center_mapping_queue as
select
  c.id, c.source_workbook_hash, c.historical_label, c.header_frequency, c.division_id,
  d.name as division_name, d.source_key as division_key, c.category_id, bc.name as category_name,
  bc.source_key as category_key, c.mapping_status, c.mapping_note,
  count(fd.id) filter (where fd.classification_status = any (array['ready'::text,'exception'::text,'manual_review'::text])) as open_document_count,
  count(hr.id) as historical_rule_count,
  c.operational_label
from public.finance_historical_cost_centers c
left join public.budget_divisions d on d.id=c.division_id
left join public.budget_categories bc on bc.id=c.category_id
left join public.finance_documents fd on fd.source_payload->>'historical_cost_center'=c.historical_label and fd.source_payload->>'source_workbook_hash'=c.source_workbook_hash
left join public.finance_historical_rules hr on hr.historical_cost_center_id=c.id
group by c.id,d.name,d.source_key,bc.name,bc.source_key;

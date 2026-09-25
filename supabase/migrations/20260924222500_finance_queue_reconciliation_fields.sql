create or replace view public.finance_approval_queue as
select
  d.id,d.document_type,d.external_source,d.external_id,d.supplier_name,d.supplier_rut,
  d.document_number,d.document_date,d.due_date,d.description,d.net_amount,d.tax_amount,
  d.total_amount,d.currency,d.classification_status,d.approval_status,d.valuation_status,
  d.amount_eur,d.fx_rate_to_eur,d.fx_date,d.confidence,d.classification_reason,d.historical_count,
  d.historical_dominance,d.historical_median,d.accepted_min,d.accepted_max,d.amount_in_range,
  d.decision_notes,d.approved_at,d.rejected_at,d.division_id,bd.name as division_name,
  bd.source_key as division_key,d.category_id,bc.name as category_name,bc.source_key as category_key,
  bc.category_role,d.cost_center_id,
  coalesce(cc.name,nullif(d.source_payload->>'historical_cost_center','')) as cost_center_name,
  cc.code as cost_center_code,d.source_payload->>'confidence_label' as confidence_label,
  case d.approval_status when 'pending_mapping' then 1 when 'ready' then 2 when 'pending_valuation' then 3 when 'approved' then 4 when 'rejected' then 5 else 9 end as queue_order,
  d.operational_label,
  d.payment_status,
  d.reconciliation_status,
  d.reconciliation_checked_at,
  d.reconciliation_notes
from public.finance_documents d
left join public.budget_divisions bd on bd.id=d.division_id
left join public.budget_categories bc on bc.id=d.category_id
left join public.cost_centers cc on cc.id=d.cost_center_id;
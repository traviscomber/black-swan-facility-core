create or replace function public.get_infrastructure_invoice_review_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_review_infrastructure_invoices() then
    raise exception 'Infrastructure invoice review permission required';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'supplierName', d.supplier_name,
      'documentNumber', d.document_number,
      'documentDate', d.document_date,
      'dueDate', d.due_date,
      'description', d.description,
      'classificationReason', d.classification_reason,
      'confidence', d.confidence,
      'totalAmount', d.total_amount,
      'currency', d.currency,
      'divisionName', bd.name,
      'divisionKey', bd.source_key,
      'categoryName', bc.name,
      'operationalLabel', d.operational_label,
      'reviewStatus', d.infrastructure_review_status,
      'reviewNotes', d.infrastructure_review_notes,
      'hasSourceFile', exists (
        select 1 from public.finance_sii_uploads u
        where u.finance_document_id = d.id
      )
    ) order by d.document_date desc, d.created_at desc)
    from public.finance_documents d
    join public.budget_categories bc on bc.id = d.category_id
    left join public.budget_divisions bd on bd.id = d.division_id
    where bc.source_key = 'buildings'
      and d.infrastructure_review_status = 'pending_tomas'
      and d.approval_status in ('pending_mapping','ready')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_infrastructure_invoice_review_queue() from public, anon;
grant execute on function public.get_infrastructure_invoice_review_queue() to authenticated, service_role;

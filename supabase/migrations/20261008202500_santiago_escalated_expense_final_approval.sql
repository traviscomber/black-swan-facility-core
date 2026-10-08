-- An explicit Santiago decision closes an escalated expense without returning it to Raimundo.
-- Assignment and approval are atomic. Payment authorization remains a separate action.
create or replace function public.santiago_resolve_and_approve_escalated_expense(
  p_document_id uuid, p_category_id uuid, p_note text default null
) returns jsonb language plpgsql security definer set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_category public.budget_categories%rowtype;
  v_posting_id uuid;
  v_signed_eur numeric;
  v_notes text;
begin
  if auth.uid() is null or not public.can_finance_payment_authorize() then
    raise exception 'Santiago approval permission required';
  end if;
  v_notes := nullif(trim(p_note),'');
  if v_notes is null then raise exception 'Approval reason is required'; end if;

  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.cost_center_escalation_status <> 'pending_santiago'
     or v_doc.approved_at is not null
     or v_doc.approval_status not in ('pending_mapping','ready')
     or v_doc.reconciliation_status in ('paid_observed','reconciled')
     or v_doc.payment_status <> 'not_ready' then
    raise exception 'Document is not eligible for escalated expense approval';
  end if;
  select * into v_category from public.budget_categories
    where id=p_category_id and is_active=true and source_key is not null
      and coalesce(category_role,'cost')='cost';
  if not found then raise exception 'Canonical cost category required'; end if;
  if v_category.source_key='buildings' then
    raise exception 'Infrastructure invoices belong to Tomas workflow';
  end if;

  -- Preserve the canonical posting rule: EUR is posted once; CLP is valued later.
  if upper(coalesce(v_doc.currency,''))='EUR' then
    v_signed_eur := case when v_doc.document_type='credit_note'
      then -abs(v_doc.total_amount) else abs(v_doc.total_amount) end;
    insert into public.financial_postings(
      division_id,category_id,cost_center_id,operational_label,posting_type,transaction_date,
      source_module,source_table,source_id,source_label,source_amount,source_currency,
      amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by
    ) values (
      v_category.division_id,v_category.id,null,null,'cost',v_doc.document_date,
      'finance','finance_documents',v_doc.id,
      coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),
      v_doc.total_amount,'EUR',v_signed_eur,1,v_doc.document_date,'posted',auth.uid(),now(),
      jsonb_build_object('document_type',v_doc.document_type,'approval_route','santiago_escalation',
        'note',v_notes),auth.uid()
    ) on conflict do nothing returning id into v_posting_id;
    if v_posting_id is null then
      select id into v_posting_id from public.financial_postings
      where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1;
    end if;
    if v_posting_id is null then raise exception 'EUR posting could not be verified'; end if;
  elsif upper(coalesce(v_doc.currency,'')) <> 'CLP' then
    raise exception 'Unsupported currency for escalated expense approval';
  end if;

  update public.finance_documents
  set division_id=v_category.division_id, category_id=v_category.id,
      cost_center_id=null, operational_label=null,
      approval_status=case when upper(v_doc.currency)='EUR' then 'approved' else 'pending_valuation' end,
      valuation_status=case when upper(v_doc.currency)='EUR' then 'not_required' else 'pending' end,
      amount_eur=case when upper(v_doc.currency)='EUR' then v_signed_eur else amount_eur end,
      fx_rate_to_eur=case when upper(v_doc.currency)='EUR' then 1 else fx_rate_to_eur end,
      fx_date=case when upper(v_doc.currency)='EUR' then v_doc.document_date else fx_date end,
      financial_posting_id=case when upper(v_doc.currency)='EUR' then v_posting_id else financial_posting_id end,
      approved_by=auth.uid(), approved_at=now(), decision_notes=v_notes,
      rejected_by=null,rejected_at=null,
      payment_status='pending_santiago',
      payment_decided_by=null,payment_decided_at=null,payment_decision_notes=null,
      cost_center_escalation_status='resolved',
      cost_center_resolved_by=auth.uid(),cost_center_resolved_at=now(),
      cost_center_resolution_note=v_notes,
      classification_status='manual_review',
      classification_reason='Imputación y gasto aprobados por Santiago tras escalamiento de Raimundo',
      source_payload=coalesce(source_payload,'{}'::jsonb)||jsonb_build_object(
        'canonical_budget_mapping',true,
        'canonical_budget_division_id',v_category.division_id,
        'canonical_budget_category_id',v_category.id,
        'cost_center_resolved_by_santiago',true,
        'expense_approved_by_santiago',true,
        'expense_approval_route','escalation',
        'expense_approval_at',now()),
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'UPDATE','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('approval_status',v_doc.approval_status,
      'payment_status',v_doc.payment_status,
      'cost_center_escalation_status',v_doc.cost_center_escalation_status),
    jsonb_build_object('operation','santiago_resolve_and_approve_escalated_expense',
      'category_id',v_category.id,'payment_status','pending_santiago',
      'cost_center_escalation_status','resolved','note',v_notes),
    array['division_id','category_id','approval_status','approved_by','approved_at',
      'payment_status','cost_center_escalation_status','cost_center_resolved_by'],now()
  );
  return jsonb_build_object('success',true,'document_id',p_document_id,
    'payment_status','pending_santiago','next_owner','Santiago');
end;
$function$;
revoke all on function public.santiago_resolve_and_approve_escalated_expense(uuid,uuid,text) from public, anon;
grant execute on function public.santiago_resolve_and_approve_escalated_expense(uuid,uuid,text) to authenticated;

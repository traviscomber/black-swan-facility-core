-- Automatically complete CLP -> EUR valuation as part of Raimundo approval.
-- Rate retrieval happens server-side; this function validates and persists the canonical result.

create or replace function public.approve_finance_document_auto_eur(
  p_document_id uuid,
  p_clp_per_eur numeric,
  p_fx_date date,
  p_fx_source text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_category public.budget_categories%rowtype;
  v_posting_id uuid;
  v_amount_eur numeric;
  v_rate_to_eur numeric;
  v_approved_by uuid;
  v_approved_at timestamptz;
  v_payment_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() and not public.can_finance_admin() then
    raise exception 'Finance approval permission required';
  end if;
  if p_clp_per_eur is null or p_clp_per_eur <= 0 then raise exception 'Valid CLP per EUR rate is required'; end if;
  if p_fx_date is null then raise exception 'FX date is required'; end if;
  if coalesce(trim(p_fx_source),'')='' then raise exception 'FX source is required'; end if;

  select * into v_doc
  from public.finance_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'Finance document not found'; end if;
  if upper(coalesce(v_doc.currency,'')) <> 'CLP' then raise exception 'Automatic valuation currently supports CLP documents'; end if;
  if v_doc.approval_status not in ('ready','pending_valuation') then
    raise exception 'Document is not ready for automatic EUR valuation';
  end if;
  if v_doc.approval_status='pending_valuation' and v_doc.approved_at is null then
    raise exception 'Pending valuation document has no Raimundo approval';
  end if;

  select * into v_category
  from public.budget_categories
  where id=v_doc.category_id;

  if not found
     or v_doc.division_id is null
     or v_category.division_id<>v_doc.division_id
     or v_category.source_key is null
     or coalesce(v_category.category_role,'cost')<>'cost'
  then
    raise exception 'Canonical Budget cost mapping is required';
  end if;

  v_rate_to_eur := 1 / p_clp_per_eur;
  v_amount_eur := round(abs(v_doc.total_amount) / p_clp_per_eur, 2);
  if v_doc.document_type='credit_note' then v_amount_eur := -v_amount_eur; end if;

  v_approved_by := coalesce(v_doc.approved_by,auth.uid());
  v_approved_at := coalesce(v_doc.approved_at,now());
  v_payment_status := case
    when v_doc.payment_status='not_ready' then 'pending_santiago'
    else v_doc.payment_status
  end;

  insert into public.financial_postings(
    division_id,category_id,cost_center_id,operational_label,posting_type,transaction_date,
    source_module,source_table,source_id,source_label,source_amount,source_currency,
    amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by
  ) values (
    v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,v_doc.operational_label,'cost',
    v_doc.document_date,'finance','finance_documents',v_doc.id,
    coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),
    v_doc.total_amount,'CLP',v_amount_eur,v_rate_to_eur,p_fx_date,'posted',
    v_approved_by,v_approved_at,
    jsonb_build_object(
      'document_type',v_doc.document_type,
      'external_source',v_doc.external_source,
      'valuation_method','automatic_clp_eur',
      'fx_source',trim(p_fx_source),
      'clp_per_eur',p_clp_per_eur,
      'fx_rate_to_eur',v_rate_to_eur,
      'fx_date',p_fx_date
    ),
    auth.uid()
  )
  on conflict do nothing
  returning id into v_posting_id;

  if v_posting_id is null then
    select id into v_posting_id
    from public.financial_postings
    where source_table='finance_documents'
      and source_id=v_doc.id
      and status<>'rejected'
    limit 1;
  end if;

  update public.finance_documents
  set approval_status='approved',
      valuation_status='valued',
      amount_eur=v_amount_eur,
      fx_rate_to_eur=v_rate_to_eur,
      fx_date=p_fx_date,
      approved_by=v_approved_by,
      approved_at=v_approved_at,
      decision_notes=coalesce(nullif(trim(p_notes),''),decision_notes),
      financial_posting_id=v_posting_id,
      rejected_by=null,
      rejected_at=null,
      payment_status=v_payment_status,
      source_payload=coalesce(source_payload,'{}'::jsonb)||jsonb_build_object(
        'automatic_eur_valuation',true,
        'fx_source',trim(p_fx_source),
        'clp_per_eur',p_clp_per_eur,
        'fx_rate_to_eur',v_rate_to_eur,
        'fx_date',p_fx_date,
        'amount_eur',v_amount_eur,
        'valued_at',now()
      ),
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'UPDATE','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object(
      'approval_status',v_doc.approval_status,
      'valuation_status',v_doc.valuation_status,
      'amount_eur',v_doc.amount_eur,
      'fx_rate_to_eur',v_doc.fx_rate_to_eur,
      'fx_date',v_doc.fx_date,
      'payment_status',v_doc.payment_status
    ),
    jsonb_build_object(
      'operation','approve_finance_document_auto_eur',
      'approval_status','approved',
      'valuation_status','valued',
      'amount_eur',v_amount_eur,
      'fx_rate_to_eur',v_rate_to_eur,
      'clp_per_eur',p_clp_per_eur,
      'fx_date',p_fx_date,
      'fx_source',trim(p_fx_source),
      'payment_status',v_payment_status
    ),
    array['approval_status','valuation_status','amount_eur','fx_rate_to_eur','fx_date','approved_by','approved_at','financial_posting_id','payment_status'],now()
  );

  return jsonb_build_object(
    'success',true,
    'document_id',p_document_id,
    'posting_id',v_posting_id,
    'approval_status','approved',
    'valuation_status','valued',
    'amount_eur',v_amount_eur,
    'clp_per_eur',p_clp_per_eur,
    'fx_rate_to_eur',v_rate_to_eur,
    'fx_date',p_fx_date,
    'fx_source',trim(p_fx_source),
    'payment_status',v_payment_status
  );
end;
$function$;

revoke all on function public.approve_finance_document_auto_eur(uuid,numeric,date,text,text) from public, anon;
grant execute on function public.approve_finance_document_auto_eur(uuid,numeric,date,text,text) to authenticated;

-- Keep finance payment audit rows compatible with critical_action_audit_log.action.
-- Semantic operations are stored in new_data.operation; action remains UPDATE.

create or replace function public.decide_finance_payment(
  p_document_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_payment_authorize() then raise exception 'Payment authorization permission required'; end if;
  if p_decision not in ('authorized','rejected') then raise exception 'Decision must be authorized or rejected'; end if;
  if p_decision='rejected' and coalesce(trim(p_notes),'')='' then raise exception 'Rejection reason is required'; end if;

  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approved_at is null or v_doc.approval_status not in ('pending_valuation','approved') then
    raise exception 'Raimundo approval is required before payment decision';
  end if;
  if v_doc.payment_status <> 'pending_santiago' then
    raise exception 'Payment is not awaiting Santiago decision';
  end if;

  v_status:=p_decision;
  update public.finance_documents
  set payment_status=v_status,
      payment_decided_by=auth.uid(),
      payment_decided_at=now(),
      payment_decision_notes=nullif(trim(p_notes),''),
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'UPDATE','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('payment_status',v_doc.payment_status),
    jsonb_build_object(
      'operation',case when p_decision='authorized' then 'authorize_payment' else 'reject_payment' end,
      'payment_status',v_status,
      'notes',nullif(trim(p_notes),'')
    ),
    array['payment_status','payment_decided_by','payment_decided_at','payment_decision_notes'],now()
  );

  return jsonb_build_object('success',true,'document_id',p_document_id,'payment_status',v_status);
end;
$function$;

create or replace function public.record_finance_payment(
  p_document_id uuid,
  p_payment_method text,
  p_payment_reference text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_payment_authorize() then raise exception 'Payment execution permission required'; end if;
  if coalesce(trim(p_payment_method),'')='' then raise exception 'Payment method is required'; end if;
  if coalesce(trim(p_payment_reference),'')='' then raise exception 'Payment reference is required'; end if;
  if p_paid_at is null then raise exception 'Payment date is required'; end if;

  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.payment_status <> 'authorized' then raise exception 'Payment must be authorized before it can be recorded'; end if;

  update public.finance_documents
  set payment_status='paid',
      paid_by=auth.uid(),
      paid_at=p_paid_at,
      payment_method=trim(p_payment_method),
      payment_reference=trim(p_payment_reference),
      payment_amount=total_amount,
      payment_currency=currency,
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'UPDATE','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('payment_status',v_doc.payment_status),
    jsonb_build_object(
      'operation','record_supplier_payment',
      'payment_status','paid',
      'payment_method',trim(p_payment_method),
      'payment_reference',trim(p_payment_reference),
      'paid_at',p_paid_at,
      'payment_amount',v_doc.total_amount,
      'payment_currency',v_doc.currency
    ),
    array['payment_status','paid_by','paid_at','payment_method','payment_reference','payment_amount','payment_currency'],now()
  );

  return jsonb_build_object('success',true,'document_id',p_document_id,'payment_status','paid');
end;
$function$;

revoke all on function public.decide_finance_payment(uuid,text,text) from public, anon;
revoke all on function public.record_finance_payment(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.decide_finance_payment(uuid,text,text) to authenticated;
grant execute on function public.record_finance_payment(uuid,text,text,timestamptz) to authenticated;

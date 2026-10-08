-- Tomas can return a misrouted Buildings invoice to Raimundo without payment approval.
create or replace function public.tomas_return_misrouted_finance_document(p_document_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_category_key text;
  v_reason text := nullif(trim(p_note),'');
begin
  if auth.uid() is null or not public.can_review_infrastructure_invoices() then
    raise exception 'Infrastructure review permission required';
  end if;
  if v_reason is null then raise exception 'Indica por qué corresponde a Raimundo'; end if;
  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  select source_key into v_category_key from public.budget_categories where id=v_doc.category_id;
  if v_category_key is distinct from 'buildings'
     or v_doc.infrastructure_review_status <> 'pending_tomas'
     or v_doc.approval_status not in ('pending_mapping','ready')
     or v_doc.payment_status <> 'not_ready'
     or v_doc.approved_at is not null
     or v_doc.reconciliation_status in ('paid_observed','reconciled')
     or v_doc.paid_at is not null then
    raise exception 'Only unpaid, pending infrastructure invoices can be returned';
  end if;
  update public.finance_documents
  set division_id=null,category_id=null,cost_center_id=null,operational_label=null,
      approval_status='pending_mapping',payment_status='not_ready',
      infrastructure_review_status='not_required',
      infrastructure_reviewed_by=auth.uid(),infrastructure_reviewed_at=now(),
      infrastructure_review_notes=v_reason,
      classification_status='manual_review',
      classification_reason='Tomás devolvió a Raimundo por imputación de infraestructura incorrecta',
      source_payload=coalesce(source_payload,'{}'::jsonb)||jsonb_build_object(
        'tomas_return_to_raimundo',jsonb_build_object(
          'previous_division_id',v_doc.division_id,
          'previous_category_id',v_doc.category_id,
          'reason',v_reason,'reviewer',auth.uid(),'at',now())),
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'UPDATE','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('division_id',v_doc.division_id,'category_id',v_doc.category_id,
      'approval_status',v_doc.approval_status,'infrastructure_review_status',v_doc.infrastructure_review_status),
    jsonb_build_object('operation','tomas_return_misrouted_to_raimundo',
      'approval_status','pending_mapping','payment_status','not_ready',
      'infrastructure_review_status','not_required','reason',v_reason),
    array['division_id','category_id','approval_status','payment_status',
      'infrastructure_review_status','infrastructure_review_notes'],now()
  );
  return jsonb_build_object('success',true,'document_id',p_document_id,
    'next_owner','Raimundo','payment_status','not_ready');
end;
$function$;
revoke all on function public.tomas_return_misrouted_finance_document(uuid,text) from public,anon;
grant execute on function public.tomas_return_misrouted_finance_document(uuid,text) to authenticated;

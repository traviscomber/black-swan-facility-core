-- Raimundo validates the canonical cost allocation before a payment can advance.
-- Rejection of the proposed allocation can be resolved by reassigning the individual
-- finance document without rewriting the historical source label or other documents.

create or replace function public.can_finance_review_ambiguous()
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select case
    when public.current_app_role() in ('admin','service_role') then true
    when auth.uid() is null then false
    else exists (
      select 1
      from public.employees e
      where e.is_active
        and lower(coalesce(e.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
        and lower(coalesce(e.role,'')) like 'administrador del campo%'
    )
  end;
$function$;

create or replace function public.reassign_finance_document_center(
  p_document_id uuid,
  p_division_id uuid,
  p_category_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_category public.budget_categories%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_review_ambiguous() then
    raise exception 'Finance center reassignment permission required';
  end if;
  if coalesce(trim(p_note),'')='' then
    raise exception 'Reassignment note is required';
  end if;

  select * into v_doc
  from public.finance_documents
  where id = p_document_id
  for update;

  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approval_status not in ('pending_mapping','ready') then
    raise exception 'Only documents awaiting Raimundo decision can be reassigned';
  end if;

  select * into v_category
  from public.budget_categories
  where id = p_category_id;

  if not found
     or v_category.division_id <> p_division_id
     or coalesce(v_category.is_active,false)=false
     or v_category.source_key is null
     or coalesce(v_category.category_role,'cost') <> 'cost'
  then
    raise exception 'Valid canonical cost category required';
  end if;

  v_old := jsonb_build_object(
    'division_id', v_doc.division_id,
    'category_id', v_doc.category_id,
    'cost_center_id', v_doc.cost_center_id,
    'approval_status', v_doc.approval_status,
    'classification_status', v_doc.classification_status
  );

  update public.finance_documents
  set division_id = p_division_id,
      category_id = p_category_id,
      approval_status = 'ready',
      classification_status = 'manual_review',
      classification_reason = 'Centro/categoria reasignado por Raimundo',
      confidence = null,
      decision_notes = p_note,
      approved_by = null,
      approved_at = null,
      rejected_by = null,
      rejected_at = null,
      source_payload = source_payload || jsonb_build_object(
        'manual_center_reassignment', true,
        'manual_center_reassignment_note', p_note,
        'manual_center_reassignment_by', auth.uid(),
        'manual_center_reassignment_at', now(),
        'previous_division_id', v_doc.division_id,
        'previous_category_id', v_doc.category_id
      ),
      updated_at = now()
  where id = p_document_id;

  select jsonb_build_object(
    'division_id', division_id,
    'category_id', category_id,
    'cost_center_id', cost_center_id,
    'approval_status', approval_status,
    'classification_status', classification_status
  )
  into v_new
  from public.finance_documents
  where id = p_document_id;

  insert into public.critical_action_audit_log(
    entity_type, entity_id, action, category,
    actor_id, actor_email, actor_role,
    old_data, new_data, changed_fields, occurred_at
  )
  values(
    'finance_document', p_document_id, 'reassign_cost_allocation', 'finance',
    auth.uid(), auth.jwt()->>'email', public.current_app_role(),
    v_old, v_new, array['division_id','category_id','approval_status','classification_status'], now()
  );

  return jsonb_build_object(
    'success', true,
    'document_id', p_document_id,
    'approval_status', 'ready',
    'classification_status', 'manual_review'
  );
end;
$function$;

revoke all on function public.reassign_finance_document_center(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.reassign_finance_document_center(uuid,uuid,uuid,text) to authenticated;

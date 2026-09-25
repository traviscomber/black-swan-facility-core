-- Allow Raimundo to map an invoice directly to the canonical Budget hierarchy.
-- The canonical source of truth is budget_divisions + budget_categories imported from the master workbook.

create or replace function public.assign_finance_document_budget_mapping(
  p_document_id uuid,
  p_division_id uuid,
  p_category_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_category public.budget_categories%rowtype;
  v_division public.budget_divisions%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;
  if coalesce(trim(p_note),'')='' then raise exception 'Budget mapping note is required'; end if;

  select * into v_doc
  from public.finance_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approval_status not in ('pending_mapping','ready') then
    raise exception 'Only documents awaiting Raimundo decision can be mapped';
  end if;

  select * into v_division
  from public.budget_divisions
  where id=p_division_id
    and is_active=true
    and coalesce(is_aggregate,false)=false
    and source_key is not null;

  if not found then raise exception 'Active canonical Budget division required'; end if;

  select * into v_category
  from public.budget_categories
  where id=p_category_id
    and division_id=p_division_id
    and is_active=true
    and source_key is not null
    and coalesce(category_role,'cost')='cost';

  if not found then raise exception 'Active canonical Budget cost category required'; end if;

  v_old:=jsonb_build_object(
    'division_id',v_doc.division_id,
    'category_id',v_doc.category_id,
    'cost_center_id',v_doc.cost_center_id,
    'operational_label',v_doc.operational_label,
    'approval_status',v_doc.approval_status,
    'classification_status',v_doc.classification_status
  );

  update public.finance_documents
  set division_id=p_division_id,
      category_id=p_category_id,
      cost_center_id=null,
      operational_label=null,
      approval_status='ready',
      classification_status='manual_review',
      classification_reason='Imputación al Budget canónico confirmada por Raimundo',
      confidence=null,
      decision_notes=trim(p_note),
      approved_by=null,
      approved_at=null,
      rejected_by=null,
      rejected_at=null,
      source_payload=source_payload||jsonb_build_object(
        'canonical_budget_mapping',true,
        'canonical_budget_division_id',p_division_id,
        'canonical_budget_division_key',v_division.source_key,
        'canonical_budget_division_name',v_division.name,
        'canonical_budget_category_id',p_category_id,
        'canonical_budget_category_key',v_category.source_key,
        'canonical_budget_category_name',v_category.name,
        'canonical_budget_mapping_note',trim(p_note),
        'canonical_budget_mapping_by',auth.uid(),
        'canonical_budget_mapping_at',now()
      ),
      updated_at=now()
  where id=p_document_id;

  select jsonb_build_object(
    'division_id',division_id,
    'category_id',category_id,
    'approval_status',approval_status,
    'classification_status',classification_status
  )
  into v_new
  from public.finance_documents
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'assign_canonical_budget_mapping','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    v_old,
    v_new||jsonb_build_object(
      'division_key',v_division.source_key,
      'division_name',v_division.name,
      'category_key',v_category.source_key,
      'category_name',v_category.name,
      'note',trim(p_note)
    ),
    array['division_id','category_id','cost_center_id','operational_label','approval_status','classification_status'],now()
  );

  return jsonb_build_object(
    'success',true,
    'document_id',p_document_id,
    'division_id',p_division_id,
    'division_key',v_division.source_key,
    'division_name',v_division.name,
    'category_id',p_category_id,
    'category_key',v_category.source_key,
    'category_name',v_category.name,
    'approval_status','ready'
  );
end;
$function$;

revoke all on function public.assign_finance_document_budget_mapping(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.assign_finance_document_budget_mapping(uuid,uuid,uuid,text) to authenticated;

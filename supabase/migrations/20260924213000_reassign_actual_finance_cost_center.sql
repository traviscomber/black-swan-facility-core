-- Reassign the actual canonical cost center choice for one finance document.
create or replace function public.reassign_finance_document_center(
  p_document_id uuid,
  p_target_center_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_center public.finance_historical_cost_centers%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_review_ambiguous() then raise exception 'Finance center reassignment permission required'; end if;
  if coalesce(trim(p_note),'')='' then raise exception 'Reassignment note is required'; end if;

  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approval_status not in ('pending_mapping','ready') then
    raise exception 'Only documents awaiting Raimundo decision can be reassigned';
  end if;

  select * into v_center
  from public.finance_historical_cost_centers
  where id=p_target_center_id
    and mapping_status='mapped'
    and division_id is not null
    and category_id is not null;

  if not found then raise exception 'Mapped target cost center is required'; end if;

  v_old:=jsonb_build_object(
    'division_id',v_doc.division_id,
    'category_id',v_doc.category_id,
    'cost_center_id',v_doc.cost_center_id,
    'operational_label',v_doc.operational_label,
    'historical_cost_center',v_doc.source_payload->>'historical_cost_center'
  );

  update public.finance_documents
  set division_id=v_center.division_id,
      category_id=v_center.category_id,
      cost_center_id=v_center.cost_center_id,
      operational_label=coalesce(v_center.operational_label,v_center.historical_label),
      approval_status='ready',
      classification_status='manual_review',
      classification_reason='Centro de costo reasignado por Raimundo',
      confidence=null,
      decision_notes=p_note,
      approved_by=null,
      approved_at=null,
      rejected_by=null,
      rejected_at=null,
      source_payload=source_payload||jsonb_build_object(
        'manual_center_reassignment',true,
        'manual_target_center_id',v_center.id,
        'manual_target_center_label',v_center.historical_label,
        'manual_center_reassignment_note',p_note,
        'manual_center_reassignment_by',auth.uid(),
        'manual_center_reassignment_at',now(),
        'previous_division_id',v_doc.division_id,
        'previous_category_id',v_doc.category_id,
        'previous_operational_label',v_doc.operational_label
      ),
      updated_at=now()
  where id=p_document_id;

  select jsonb_build_object(
    'division_id',division_id,
    'category_id',category_id,
    'cost_center_id',cost_center_id,
    'operational_label',operational_label,
    'approval_status',approval_status,
    'classification_status',classification_status
  ) into v_new
  from public.finance_documents where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'reassign_cost_center','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    v_old,
    v_new||jsonb_build_object('target_center_id',v_center.id,'target_center_label',v_center.historical_label),
    array['division_id','category_id','cost_center_id','operational_label','classification_status'],now()
  );

  return jsonb_build_object(
    'success',true,
    'document_id',p_document_id,
    'target_center_id',v_center.id,
    'target_center_label',v_center.historical_label,
    'approval_status','ready'
  );
end;
$function$;

revoke all on function public.reassign_finance_document_center(uuid,uuid,text) from public, anon;
grant execute on function public.reassign_finance_document_center(uuid,uuid,text) to authenticated;
revoke execute on function public.reassign_finance_document_center(uuid,uuid,uuid,text) from authenticated;

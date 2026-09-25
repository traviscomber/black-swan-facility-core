-- Raimundo may escalate an uncertain cost-center allocation to Santiago.
-- Santiago resolves only the allocation; Raimundo remains the expense approver.

alter table public.finance_documents
  add column if not exists cost_center_escalation_status text not null default 'none',
  add column if not exists cost_center_escalated_by uuid references auth.users(id) on delete restrict,
  add column if not exists cost_center_escalated_at timestamptz,
  add column if not exists cost_center_escalation_note text,
  add column if not exists cost_center_resolved_by uuid references auth.users(id) on delete restrict,
  add column if not exists cost_center_resolved_at timestamptz,
  add column if not exists cost_center_resolution_note text;

alter table public.finance_documents
  drop constraint if exists finance_documents_cost_center_escalation_status_check;

alter table public.finance_documents
  add constraint finance_documents_cost_center_escalation_status_check
  check (cost_center_escalation_status in ('none','pending_santiago','resolved'));

create or replace function public.escalate_finance_document_cost_center(
  p_document_id uuid,
  p_note text default null
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
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;

  select * into v_doc
  from public.finance_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approved_at is not null or v_doc.approval_status not in ('pending_mapping','ready') then
    raise exception 'Only a pre-approval finance document can be escalated';
  end if;

  update public.finance_documents
  set cost_center_escalation_status='pending_santiago',
      cost_center_escalated_by=auth.uid(),
      cost_center_escalated_at=now(),
      cost_center_escalation_note=coalesce(nullif(trim(p_note),''),'Raimundo solicita a Santiago definir la imputación del centro de costo'),
      cost_center_resolved_by=null,
      cost_center_resolved_at=null,
      cost_center_resolution_note=null,
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'escalate_cost_center_to_santiago','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object(
      'division_id',v_doc.division_id,
      'category_id',v_doc.category_id,
      'cost_center_escalation_status',v_doc.cost_center_escalation_status
    ),
    jsonb_build_object(
      'division_id',v_doc.division_id,
      'category_id',v_doc.category_id,
      'cost_center_escalation_status','pending_santiago',
      'note',coalesce(nullif(trim(p_note),''),'Raimundo solicita a Santiago definir la imputación del centro de costo')
    ),
    array['cost_center_escalation_status','cost_center_escalated_by','cost_center_escalated_at','cost_center_escalation_note'],now()
  );

  return jsonb_build_object('success',true,'document_id',p_document_id,'cost_center_escalation_status','pending_santiago');
end;
$function$;

create or replace function public.santiago_assign_finance_document_budget_mapping(
  p_document_id uuid,
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_payment_authorize() then raise exception 'Santiago finance permission required'; end if;

  select * into v_doc
  from public.finance_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.cost_center_escalation_status <> 'pending_santiago' then
    raise exception 'Document is not awaiting Santiago cost-center assignment';
  end if;
  if v_doc.approved_at is not null or v_doc.approval_status not in ('pending_mapping','ready') then
    raise exception 'Document is no longer eligible for pre-approval assignment';
  end if;

  select * into v_category
  from public.budget_categories
  where id=p_category_id
    and is_active
    and source_key is not null
    and coalesce(category_role,'cost')='cost';

  if not found then raise exception 'Valid canonical cost category required'; end if;

  update public.finance_documents
  set division_id=v_category.division_id,
      category_id=v_category.id,
      approval_status='ready',
      cost_center_escalation_status='resolved',
      cost_center_resolved_by=auth.uid(),
      cost_center_resolved_at=now(),
      cost_center_resolution_note=coalesce(nullif(trim(p_note),''),'Centro de costo asignado por Santiago'),
      classification_reason=concat_ws(' · ',nullif(classification_reason,''),'Centro de costo asignado por Santiago tras escalamiento de Raimundo'),
      source_payload=coalesce(source_payload,'{}'::jsonb) || jsonb_build_object(
        'cost_center_escalated_to_santiago',true,
        'cost_center_resolved_by_santiago',true,
        'cost_center_resolved_at',now()
      ),
      updated_at=now()
  where id=p_document_id;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields,occurred_at
  ) values (
    'finance_document',p_document_id,'assign_escalated_cost_center','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object(
      'division_id',v_doc.division_id,
      'category_id',v_doc.category_id,
      'approval_status',v_doc.approval_status,
      'cost_center_escalation_status',v_doc.cost_center_escalation_status
    ),
    jsonb_build_object(
      'division_id',v_category.division_id,
      'category_id',v_category.id,
      'approval_status','ready',
      'cost_center_escalation_status','resolved',
      'note',coalesce(nullif(trim(p_note),''),'Centro de costo asignado por Santiago')
    ),
    array['division_id','category_id','approval_status','cost_center_escalation_status','cost_center_resolved_by','cost_center_resolved_at','cost_center_resolution_note'],now()
  );

  return jsonb_build_object(
    'success',true,
    'document_id',p_document_id,
    'division_id',v_category.division_id,
    'category_id',v_category.id,
    'approval_status','ready',
    'cost_center_escalation_status','resolved',
    'next_owner','Raimundo'
  );
end;
$function$;

revoke all on function public.escalate_finance_document_cost_center(uuid,text) from public, anon;
revoke all on function public.santiago_assign_finance_document_budget_mapping(uuid,uuid,text) from public, anon;
grant execute on function public.escalate_finance_document_cost_center(uuid,text) to authenticated;
grant execute on function public.santiago_assign_finance_document_budget_mapping(uuid,uuid,text) to authenticated;

drop policy if exists finance_documents_read_authorized on public.finance_documents;

create policy finance_documents_read_authorized
on public.finance_documents
for select
to authenticated
using (
  public.current_app_role() in ('admin','service_role')
  or public.can_finance_approve()
  or (
    public.can_finance_payment_authorize()
    and (
      payment_status in ('pending_santiago','authorized','rejected','paid')
      or cost_center_escalation_status='pending_santiago'
    )
  )
  or (
    not public.can_finance_payment_authorize()
    and public.can_app_action('finance.adjust')
  )
);

create or replace view public.finance_approval_queue
with (security_invoker = true)
as
select
  d.id,
  d.document_type,
  d.external_source,
  d.external_id,
  d.supplier_name,
  d.supplier_rut,
  d.document_number,
  d.document_date,
  d.due_date,
  d.description,
  d.net_amount,
  d.tax_amount,
  d.total_amount,
  d.currency,
  d.classification_status,
  d.approval_status,
  d.valuation_status,
  d.amount_eur,
  d.fx_rate_to_eur,
  d.fx_date,
  d.confidence,
  d.classification_reason,
  d.historical_count,
  d.historical_dominance,
  d.historical_median,
  d.accepted_min,
  d.accepted_max,
  d.amount_in_range,
  d.decision_notes,
  d.approved_at,
  d.rejected_at,
  d.division_id,
  bd.name as division_name,
  bd.source_key as division_key,
  d.category_id,
  bc.name as category_name,
  bc.source_key as category_key,
  bc.category_role,
  d.cost_center_id,
  coalesce(cc.name,nullif(d.source_payload->>'historical_cost_center','')) as cost_center_name,
  cc.code as cost_center_code,
  d.source_payload->>'confidence_label' as confidence_label,
  case d.approval_status
    when 'pending_mapping' then 1
    when 'ready' then 2
    when 'pending_valuation' then 3
    when 'approved' then 4
    when 'rejected' then 5
    else 9
  end as queue_order,
  d.operational_label,
  d.payment_status,
  d.reconciliation_status,
  d.reconciliation_checked_at,
  d.reconciliation_notes,
  d.cost_center_escalation_status,
  d.cost_center_escalated_by,
  d.cost_center_escalated_at,
  d.cost_center_escalation_note,
  d.cost_center_resolved_by,
  d.cost_center_resolved_at,
  d.cost_center_resolution_note
from public.finance_documents d
left join public.budget_divisions bd on bd.id=d.division_id
left join public.budget_categories bc on bc.id=d.category_id
left join public.cost_centers cc on cc.id=d.cost_center_id;

grant select on public.finance_approval_queue to authenticated;

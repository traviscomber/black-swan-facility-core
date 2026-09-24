-- Separate expense validation (Raimundo) from final payment authorization/execution (Santiago).

alter table public.finance_documents
  add column if not exists payment_status text not null default 'not_ready',
  add column if not exists payment_decided_by uuid references auth.users(id) on delete restrict,
  add column if not exists payment_decided_at timestamptz,
  add column if not exists payment_decision_notes text,
  add column if not exists paid_by uuid references auth.users(id) on delete restrict,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists payment_amount numeric,
  add column if not exists payment_currency text;

alter table public.finance_documents
  drop constraint if exists finance_documents_payment_status_check;
alter table public.finance_documents
  add constraint finance_documents_payment_status_check
  check (payment_status in ('not_ready','pending_santiago','authorized','rejected','paid'));

create table if not exists public.finance_payment_authorizers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.finance_payment_authorizers enable row level security;
revoke all on public.finance_payment_authorizers from anon, authenticated;
grant select on public.finance_payment_authorizers to service_role;

insert into public.finance_payment_authorizers(user_id,email,is_active)
select user_id,email,true
from public.user_access_profiles
where lower(email)='santiago@blackswn.org'
on conflict (user_id) do update set email=excluded.email,is_active=true;

create or replace function public.can_finance_payment_authorize()
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $function$
  select case
    when public.current_app_role() in ('admin','service_role') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.finance_payment_authorizers a
      where a.user_id=auth.uid() and a.is_active
    )
  end;
$function$;

revoke all on function public.can_finance_payment_authorize() from public, anon;
grant execute on function public.can_finance_payment_authorize() to authenticated;

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
    'finance_document',p_document_id,
    case when p_decision='authorized' then 'authorize_payment' else 'reject_payment' end,
    'finance',auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('payment_status',v_doc.payment_status),
    jsonb_build_object('payment_status',v_status,'notes',nullif(trim(p_notes),'')),
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
    'finance_document',p_document_id,'record_supplier_payment','finance',
    auth.uid(),auth.jwt()->>'email',public.current_app_role(),
    jsonb_build_object('payment_status',v_doc.payment_status),
    jsonb_build_object(
      'payment_status','paid','payment_method',trim(p_payment_method),
      'payment_reference',trim(p_payment_reference),'paid_at',p_paid_at,
      'payment_amount',v_doc.total_amount,'payment_currency',v_doc.currency
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

create or replace function public.approve_finance_document(p_document_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_doc public.finance_documents%rowtype;
  v_category public.budget_categories%rowtype;
  v_posting_id uuid;
  v_signed_eur numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;
  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.approval_status <> 'ready' then raise exception 'Document is not ready for approval'; end if;
  if v_doc.division_id is null or v_doc.category_id is null then raise exception 'Canonical P&L center and category are required'; end if;
  select * into v_category from public.budget_categories where id=v_doc.category_id;
  if not found or v_category.division_id<>v_doc.division_id then raise exception 'Budget category does not belong to selected P&L center'; end if;
  if v_category.source_key is null then raise exception 'Legacy category cannot receive canonical finance postings'; end if;
  if coalesce(v_category.category_role,'cost')<>'cost' then raise exception 'Supplier documents cannot be posted to an income category'; end if;

  if upper(coalesce(v_doc.currency,''))<>'EUR' then
    update public.finance_documents
    set approval_status='pending_valuation',valuation_status='pending',
        approved_by=auth.uid(),approved_at=now(),decision_notes=p_notes,
        rejected_by=null,rejected_at=null,payment_status='pending_santiago',
        payment_decided_by=null,payment_decided_at=null,payment_decision_notes=null,
        paid_by=null,paid_at=null,payment_method=null,payment_reference=null,payment_amount=null,payment_currency=null,
        updated_at=now()
    where id=p_document_id;
    return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',null,'approval_status','pending_valuation','payment_status','pending_santiago');
  end if;

  v_signed_eur:=case when v_doc.document_type='credit_note' then -abs(v_doc.total_amount) else abs(v_doc.total_amount) end;
  insert into public.financial_postings(
    division_id,category_id,cost_center_id,operational_label,posting_type,transaction_date,
    source_module,source_table,source_id,source_label,source_amount,source_currency,
    amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by
  ) values (
    v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,v_doc.operational_label,'cost',
    v_doc.document_date,'finance','finance_documents',v_doc.id,
    coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),
    v_doc.total_amount,'EUR',v_signed_eur,1,v_doc.document_date,'posted',auth.uid(),now(),
    jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'confidence',v_doc.confidence,'classification_reason',v_doc.classification_reason,'operational_label',v_doc.operational_label),
    auth.uid()
  ) on conflict do nothing returning id into v_posting_id;

  if v_posting_id is null then
    select id into v_posting_id from public.financial_postings
    where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1;
  end if;

  update public.finance_documents
  set approval_status='approved',valuation_status='not_required',
      amount_eur=v_signed_eur,fx_rate_to_eur=1,fx_date=v_doc.document_date,
      approved_by=auth.uid(),approved_at=now(),decision_notes=p_notes,
      financial_posting_id=v_posting_id,rejected_by=null,rejected_at=null,
      payment_status='pending_santiago',payment_decided_by=null,payment_decided_at=null,payment_decision_notes=null,
      paid_by=null,paid_at=null,payment_method=null,payment_reference=null,payment_amount=null,payment_currency=null,
      updated_at=now()
  where id=p_document_id;

  return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',v_posting_id,'approval_status','approved','payment_status','pending_santiago');
end;
$function$;

create or replace function public.reject_finance_document(p_document_id uuid, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;
  if coalesce(trim(p_notes),'')='' then raise exception 'Rejection notes are required'; end if;
  update public.finance_documents
  set approval_status='rejected',payment_status='not_ready',
      rejected_by=auth.uid(),rejected_at=now(),decision_notes=p_notes,updated_at=now()
  where id=p_document_id and approval_status in ('pending_mapping','ready');
  if not found then raise exception 'Pending Raimundo finance document not found'; end if;
  return jsonb_build_object('success',true,'document_id',p_document_id,'approval_status','rejected');
end;
$function$;

-- Existing genuine approvals become Santiago's payment inbox; the four reset items have approved_at null and are excluded.
update public.finance_documents
set payment_status='pending_santiago',updated_at=now()
where approved_at is not null
  and approval_status in ('pending_valuation','approved')
  and payment_status='not_ready';

update public.user_access_profiles
set os_primary_domain='finance', os_start_path='/budgets/payments'
where lower(email)='santiago@blackswn.org' and is_active;

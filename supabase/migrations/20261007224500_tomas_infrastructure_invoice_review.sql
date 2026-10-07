-- Infrastructure supplier invoices: Tomas technical review -> Santiago final payment control.
-- Raimundo is intentionally excluded from the infrastructure invoice flow.

alter table public.finance_documents
  add column if not exists infrastructure_review_status text not null default 'not_required',
  add column if not exists infrastructure_reviewed_by uuid,
  add column if not exists infrastructure_reviewed_at timestamptz,
  add column if not exists infrastructure_review_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_documents_infrastructure_review_status_check'
  ) then
    alter table public.finance_documents
      add constraint finance_documents_infrastructure_review_status_check
      check (infrastructure_review_status in (
        'not_required','pending_tomas','approved_by_tomas','rejected_by_tomas'
      ));
  end if;
end $$;

create or replace function public.can_review_infrastructure_invoices()
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $$
  select case
    when public.current_app_role() in ('admin','service_role') then true
    when auth.uid() is null then false
    else exists (
      select 1
      from public.user_access_profiles uap
      join public.employees e on e.id = uap.employee_id
      where uap.user_id = auth.uid()
        and uap.is_active
        and e.is_active
        and e.id = '5b9b0ca7-9a46-4b0b-8995-0be0619dd43b'::uuid
        and lower(e.email) = 'tomas@blackswn.org'
    )
  end;
$$;

revoke all on function public.can_review_infrastructure_invoices() from public, anon;
grant execute on function public.can_review_infrastructure_invoices() to authenticated, service_role;

create or replace function public.route_infrastructure_finance_review()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_category_key text;
begin
  if new.category_id is not null then
    select source_key into v_category_key
    from public.budget_categories
    where id = new.category_id;
  end if;

  if v_category_key = 'buildings'
     and new.approval_status in ('ready','pending_mapping')
     and new.infrastructure_review_status in ('not_required','pending_tomas') then
    new.infrastructure_review_status := 'pending_tomas';
    new.infrastructure_reviewed_by := null;
    new.infrastructure_reviewed_at := null;
    new.infrastructure_review_notes := null;
    new.payment_status := 'not_ready';
  elsif tg_op = 'UPDATE'
        and v_category_key is distinct from 'buildings'
        and old.infrastructure_review_status = 'pending_tomas' then
    new.infrastructure_review_status := 'not_required';
    new.infrastructure_reviewed_by := null;
    new.infrastructure_reviewed_at := null;
    new.infrastructure_review_notes := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_route_infrastructure_finance_review on public.finance_documents;
create trigger trg_route_infrastructure_finance_review
before insert or update of category_id, approval_status
on public.finance_documents
for each row execute function public.route_infrastructure_finance_review();

update public.finance_documents d
set infrastructure_review_status = 'pending_tomas',
    payment_status = 'not_ready',
    infrastructure_reviewed_by = null,
    infrastructure_reviewed_at = null,
    infrastructure_review_notes = null,
    updated_at = now()
from public.budget_categories c
where c.id = d.category_id
  and c.source_key = 'buildings'
  and d.approval_status in ('pending_mapping','ready')
  and d.payment_status = 'not_ready'
  and d.reconciliation_status = 'unpaid'
  and d.cost_center_escalation_status = 'none'
  and d.infrastructure_review_status = 'not_required';

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

create or replace function public.review_infrastructure_finance_document(
  p_document_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_doc public.finance_documents%rowtype;
  v_category public.budget_categories%rowtype;
  v_posting_id uuid;
  v_signed_eur numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_review_infrastructure_invoices() then
    raise exception 'Infrastructure invoice review permission required';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_notes),'') = '' then
    raise exception 'Rejection reason is required';
  end if;

  select * into v_doc
  from public.finance_documents
  where id = p_document_id
  for update;
  if not found then raise exception 'Finance document not found'; end if;

  select * into v_category
  from public.budget_categories
  where id = v_doc.category_id;
  if not found or v_category.source_key <> 'buildings' then
    raise exception 'Document is not an infrastructure invoice';
  end if;
  if v_doc.infrastructure_review_status <> 'pending_tomas' then
    raise exception 'Infrastructure invoice is not awaiting Tomas review';
  end if;
  if v_doc.approval_status <> 'ready' then
    raise exception 'Infrastructure invoice must have a canonical Budget mapping before review';
  end if;

  if p_decision = 'rejected' then
    update public.finance_documents
    set infrastructure_review_status = 'rejected_by_tomas',
        infrastructure_reviewed_by = auth.uid(),
        infrastructure_reviewed_at = now(),
        infrastructure_review_notes = trim(p_notes),
        payment_status = 'pending_santiago',
        payment_decided_by = null,
        payment_decided_at = null,
        payment_decision_notes = null,
        decision_notes = trim(p_notes),
        updated_at = now()
    where id = p_document_id;

    insert into public.critical_action_audit_log(
      entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
      old_data,new_data,changed_fields,occurred_at
    ) values (
      'finance_document',p_document_id,'UPDATE','finance',
      auth.uid(),auth.jwt()->>'email',public.current_app_role(),
      jsonb_build_object('infrastructure_review_status',v_doc.infrastructure_review_status,'payment_status',v_doc.payment_status),
      jsonb_build_object('operation','reject_infrastructure_invoice_to_santiago','infrastructure_review_status','rejected_by_tomas','payment_status','pending_santiago','notes',trim(p_notes)),
      array['infrastructure_review_status','infrastructure_reviewed_by','infrastructure_reviewed_at','infrastructure_review_notes','payment_status'],now()
    );

    return jsonb_build_object('success',true,'document_id',p_document_id,'infrastructure_review_status','rejected_by_tomas','payment_status','pending_santiago');
  end if;

  if upper(coalesce(v_doc.currency,'')) <> 'EUR' then
    update public.finance_documents
    set infrastructure_review_status = 'approved_by_tomas',
        infrastructure_reviewed_by = auth.uid(),
        infrastructure_reviewed_at = now(),
        infrastructure_review_notes = nullif(trim(p_notes),''),
        approval_status = 'pending_valuation',
        valuation_status = 'pending',
        approved_by = auth.uid(),
        approved_at = now(),
        decision_notes = coalesce(nullif(trim(p_notes),''),'Infraestructura revisada por Tomás'),
        payment_status = 'pending_santiago',
        payment_decided_by = null,
        payment_decided_at = null,
        payment_decision_notes = null,
        updated_at = now()
    where id = p_document_id;

    return jsonb_build_object('success',true,'document_id',p_document_id,'infrastructure_review_status','approved_by_tomas','approval_status','pending_valuation','payment_status','pending_santiago');
  end if;

  v_signed_eur := case when v_doc.document_type='credit_note' then -abs(v_doc.total_amount) else abs(v_doc.total_amount) end;

  insert into public.financial_postings(
    division_id,category_id,cost_center_id,operational_label,posting_type,transaction_date,
    source_module,source_table,source_id,source_label,source_amount,source_currency,
    amount_eur,fx_rate_to_eur,fx_date,status,approved_by,approved_at,metadata,created_by
  ) values (
    v_doc.division_id,v_doc.category_id,v_doc.cost_center_id,v_doc.operational_label,'cost',
    v_doc.document_date,'finance','finance_documents',v_doc.id,
    coalesce(v_doc.supplier_name,'')||' · '||coalesce(v_doc.document_number,''),
    v_doc.total_amount,'EUR',v_signed_eur,1,v_doc.document_date,'posted',auth.uid(),now(),
    jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'reviewer','tomas','review_type','infrastructure'),
    auth.uid()
  ) on conflict do nothing returning id into v_posting_id;

  if v_posting_id is null then
    select id into v_posting_id
    from public.financial_postings
    where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected'
    limit 1;
  end if;

  update public.finance_documents
  set infrastructure_review_status = 'approved_by_tomas',
      infrastructure_reviewed_by = auth.uid(),
      infrastructure_reviewed_at = now(),
      infrastructure_review_notes = nullif(trim(p_notes),''),
      approval_status = 'approved',
      valuation_status = 'not_required',
      amount_eur = v_signed_eur,
      fx_rate_to_eur = 1,
      fx_date = v_doc.document_date,
      approved_by = auth.uid(),
      approved_at = now(),
      decision_notes = coalesce(nullif(trim(p_notes),''),'Infraestructura revisada por Tomás'),
      financial_posting_id = v_posting_id,
      payment_status = 'pending_santiago',
      payment_decided_by = null,
      payment_decided_at = null,
      payment_decision_notes = null,
      updated_at = now()
  where id = p_document_id;

  return jsonb_build_object('success',true,'document_id',p_document_id,'infrastructure_review_status','approved_by_tomas','approval_status','approved','payment_status','pending_santiago');
end;
$$;

revoke all on function public.review_infrastructure_finance_document(uuid,text,text) from public, anon;
grant execute on function public.review_infrastructure_finance_document(uuid,text,text) to authenticated, service_role;

create or replace function public.approve_finance_document(p_document_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
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
  if v_category.source_key = 'buildings' then raise exception 'Infrastructure invoices are reviewed by Tomas, not Raimundo'; end if;
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
$$;

create or replace function public.reject_finance_document(p_document_id uuid, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_category_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Finance approval permission required'; end if;
  if coalesce(trim(p_notes),'')='' then raise exception 'Rejection notes are required'; end if;

  select bc.source_key into v_category_key
  from public.finance_documents d
  left join public.budget_categories bc on bc.id=d.category_id
  where d.id=p_document_id;

  if v_category_key = 'buildings' then
    raise exception 'Infrastructure invoices are reviewed by Tomas, not Raimundo';
  end if;

  update public.finance_documents
  set approval_status='rejected',payment_status='not_ready',
      rejected_by=auth.uid(),rejected_at=now(),decision_notes=p_notes,updated_at=now()
  where id=p_document_id and approval_status in ('pending_mapping','ready');
  if not found then raise exception 'Pending Raimundo finance document not found'; end if;
  return jsonb_build_object('success',true,'document_id',p_document_id,'approval_status','rejected');
end;
$$;

create or replace function public.decide_finance_payment(p_document_id uuid, p_decision text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_doc public.finance_documents%rowtype;
  v_status text;
  v_category public.budget_categories%rowtype;
  v_posting_id uuid;
  v_signed_eur numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_payment_authorize() then raise exception 'Payment authorization permission required'; end if;
  if p_decision not in ('authorized','rejected') then raise exception 'Decision must be authorized or rejected'; end if;
  if p_decision='rejected' and coalesce(trim(p_notes),'')='' then raise exception 'Rejection reason is required'; end if;

  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.reconciliation_status in ('paid_observed','reconciled') then
    raise exception 'Payment is already observed in reconciliation and cannot be authorized again';
  end if;
  if v_doc.payment_status <> 'pending_santiago' then
    raise exception 'Payment is not awaiting Santiago decision';
  end if;

  if v_doc.infrastructure_review_status = 'rejected_by_tomas' then
    if p_decision = 'authorized' then
      select * into v_category from public.budget_categories where id=v_doc.category_id;
      if not found or v_category.source_key <> 'buildings' then raise exception 'Infrastructure category mismatch'; end if;

      if upper(coalesce(v_doc.currency,'')) <> 'EUR' then
        update public.finance_documents
        set approval_status='pending_valuation',valuation_status='pending',
            approved_by=auth.uid(),approved_at=now(),
            decision_notes=coalesce(nullif(trim(p_notes),''),'Santiago autoriza factura de infraestructura observada por Tomás'),
            updated_at=now()
        where id=p_document_id;
      else
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
          jsonb_build_object('document_type',v_doc.document_type,'override','santiago_after_tomas_rejection','tomas_notes',v_doc.infrastructure_review_notes),
          auth.uid()
        ) on conflict do nothing returning id into v_posting_id;

        if v_posting_id is null then
          select id into v_posting_id from public.financial_postings
          where source_table='finance_documents' and source_id=v_doc.id and status<>'rejected' limit 1;
        end if;

        update public.finance_documents
        set approval_status='approved',valuation_status='not_required',
            amount_eur=v_signed_eur,fx_rate_to_eur=1,fx_date=v_doc.document_date,
            approved_by=auth.uid(),approved_at=now(),
            decision_notes=coalesce(nullif(trim(p_notes),''),'Santiago autoriza factura de infraestructura observada por Tomás'),
            financial_posting_id=v_posting_id,
            updated_at=now()
        where id=p_document_id;
      end if;
    else
      update public.finance_documents
      set approval_status='rejected',
          rejected_by=auth.uid(),
          rejected_at=now(),
          decision_notes=coalesce(nullif(trim(p_notes),''),v_doc.infrastructure_review_notes),
          updated_at=now()
      where id=p_document_id;
    end if;
  elsif v_doc.approved_at is null or v_doc.approval_status not in ('pending_valuation','approved') then
    raise exception 'Expense approval is required before payment decision';
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
      'infrastructure_review_status',v_doc.infrastructure_review_status,
      'notes',nullif(trim(p_notes),'')
    ),
    array['payment_status','payment_decided_by','payment_decided_at','payment_decision_notes'],now()
  );

  return jsonb_build_object('success',true,'document_id',p_document_id,'payment_status',v_status);
end;
$$;


-- Confirm the one currently-unmapped infrastructure invoice identified from canonical
-- reconciliation evidence: electrical work at Cesar Palace belongs to Hospitality · Farm · Buildings.
do $
declare
  v_division_id uuid;
  v_category_id uuid;
  v_match_count integer;
begin
  select id into v_division_id
  from public.budget_divisions
  where source_key='hospitality-farm' and is_active and not coalesce(is_aggregate,false)
  limit 1;

  select id into v_category_id
  from public.budget_categories
  where division_id=v_division_id and source_key='buildings' and is_active
  limit 1;

  if v_division_id is null or v_category_id is null then
    raise exception 'Canonical Hospitality · Farm · Buildings mapping not found';
  end if;

  select count(*) into v_match_count
  from public.finance_documents
  where supplier_name ilike '%ELECTRICIDAD FRANCISCO JAVIER SOTO%'
    and document_number='FE / 496'
    and document_date='2026-09-23'
    and description ilike '%CESAR PALACE%'
    and approval_status='pending_mapping';

  if v_match_count <> 1 then
    raise exception 'Expected exactly one Cesar Palace FE / 496 invoice, found %', v_match_count;
  end if;

  update public.finance_documents
  set division_id=v_division_id,
      category_id=v_category_id,
      cost_center_id=null,
      operational_label='CESAR PALACE',
      approval_status='ready',
      classification_status='manual_review',
      classification_reason='Infraestructura confirmada por evidencia canónica: servicios eléctricos Cesar Palace · Hospitality · Farm · Buildings',
      confidence=null,
      source_payload=source_payload || jsonb_build_object(
        'canonical_budget_mapping',true,
        'canonical_budget_division_key','hospitality-farm',
        'canonical_budget_division_name','Farm',
        'canonical_budget_category_key','buildings',
        'canonical_budget_category_name','Buildings',
        'infrastructure_routing_confirmed',true,
        'infrastructure_routing_reason','Servicios eléctricos Cesar Palace; centro histórico HOSP FARM MANT Y REP CESAR PALACE',
        'infrastructure_routing_target','tomas'
      ),
      updated_at=now()
  where supplier_name ilike '%ELECTRICIDAD FRANCISCO JAVIER SOTO%'
    and document_number='FE / 496'
    and document_date='2026-09-23'
    and description ilike '%CESAR PALACE%'
    and approval_status='pending_mapping';
end $;

revoke all on function public.route_infrastructure_finance_review() from public, anon, authenticated;
revoke all on function public.get_infrastructure_invoice_review_queue() from public, anon;
revoke all on function public.review_infrastructure_finance_document(uuid,text,text) from public, anon;
grant execute on function public.get_infrastructure_invoice_review_queue() to authenticated, service_role;
grant execute on function public.review_infrastructure_finance_document(uuid,text,text) to authenticated, service_role;

create table if not exists public.finance_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null default 'invoice' check (document_type in ('invoice','credit_note','debit_note','other')),
  external_source text not null default 'manual',
  external_id text,
  supplier_id uuid references public.suppliers(id),
  supplier_name text not null,
  supplier_rut text,
  document_number text not null,
  document_date date not null,
  due_date date,
  description text,
  net_amount numeric,
  tax_amount numeric,
  total_amount numeric not null,
  currency text not null default 'EUR',
  division_id uuid references public.budget_divisions(id),
  category_id uuid references public.budget_categories(id),
  cost_center_id uuid references public.cost_centers(id),
  classification_status text not null default 'manual_review' check (classification_status in ('ready','exception','manual_review','approved','rejected')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  classification_reason text,
  historical_count integer not null default 0,
  historical_dominance numeric check (historical_dominance is null or (historical_dominance >= 0 and historical_dominance <= 1)),
  historical_median numeric,
  accepted_min numeric,
  accepted_max numeric,
  amount_in_range boolean,
  duplicate_key text,
  source_payload jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  decision_notes text,
  financial_posting_id uuid references public.financial_postings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_documents_source_identity_uq on public.finance_documents(external_source, external_id) where external_id is not null;
create unique index if not exists finance_documents_duplicate_key_uq on public.finance_documents(duplicate_key) where duplicate_key is not null;
create index if not exists finance_documents_queue_idx on public.finance_documents(classification_status, document_date desc);
create index if not exists finance_documents_budget_idx on public.finance_documents(division_id, category_id, document_date desc);

create table if not exists public.finance_classification_rules (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  supplier_name_pattern text,
  supplier_rut text,
  division_id uuid not null references public.budget_divisions(id),
  category_id uuid not null references public.budget_categories(id),
  cost_center_id uuid references public.cost_centers(id),
  minimum_history integer not null default 3,
  minimum_dominance numeric not null default 0.8 check (minimum_dominance between 0 and 1),
  accepted_min numeric,
  accepted_max numeric,
  historical_median numeric,
  historical_count integer not null default 0,
  historical_dominance numeric check (historical_dominance is null or historical_dominance between 0 and 1),
  description_keywords text[] not null default '{}',
  is_active boolean not null default true,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_classification_rules_supplier_idx on public.finance_classification_rules(supplier_id, supplier_rut, is_active);

update public.employees set role='Administrador del campo', updated_at=now() where lower(email)='raimundo@blackswan.com';
update public.employees set role='Jefe de proyectos', updated_at=now() where lower(email)='tomas@blackswn.org';
update public.employees set role='CEO', updated_at=now() where lower(email)='santiago@blackswan.com';

create or replace function public.can_finance_approve()
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select case
    when public.current_app_role() in ('admin','approver','service_role') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.employees e
      where e.is_active
        and lower(coalesce(e.email,'')) = lower(coalesce(auth.jwt()->>'email',''))
        and e.role in ('Administrador del campo','CEO')
    )
  end;
$$;

create or replace view public.finance_approval_queue
with (security_invoker=true) as
select
  d.id, d.document_type, d.external_source, d.external_id, d.supplier_name, d.supplier_rut,
  d.document_number, d.document_date, d.due_date, d.description, d.net_amount, d.tax_amount,
  d.total_amount, d.currency, d.classification_status, d.confidence, d.classification_reason,
  d.historical_count, d.historical_dominance, d.historical_median, d.accepted_min, d.accepted_max,
  d.amount_in_range, d.decision_notes, d.approved_at, d.rejected_at, d.division_id,
  bd.name as division_name, bd.source_key as division_key, d.category_id,
  bc.name as category_name, bc.source_key as category_key, d.cost_center_id,
  cc.name as cost_center_name, cc.code as cost_center_code,
  case d.classification_status when 'ready' then 1 when 'exception' then 2 when 'manual_review' then 3 when 'approved' then 4 when 'rejected' then 5 else 9 end as queue_order
from public.finance_documents d
left join public.budget_divisions bd on bd.id=d.division_id
left join public.budget_categories bc on bc.id=d.category_id
left join public.cost_centers cc on cc.id=d.cost_center_id;

create or replace function public.approve_finance_document(p_document_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_doc public.finance_documents%rowtype;
  v_posting_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Approval permission required'; end if;
  select * into v_doc from public.finance_documents where id=p_document_id for update;
  if not found then raise exception 'Finance document not found'; end if;
  if v_doc.classification_status not in ('ready','exception','manual_review') then raise exception 'Document is not pending approval'; end if;
  if v_doc.division_id is null or v_doc.category_id is null then raise exception 'Center and category are required before approval'; end if;
  if upper(coalesce(v_doc.currency,'')) <> 'EUR' then raise exception 'Budget canonical currency is EUR'; end if;

  insert into public.financial_postings(
    division_id, category_id, cost_center_id, posting_type, transaction_date,
    source_module, source_table, source_id, source_label,
    source_amount, source_currency, amount_eur, status,
    approved_by, approved_at, metadata, created_by
  ) values (
    v_doc.division_id, v_doc.category_id, v_doc.cost_center_id, 'cost', v_doc.document_date,
    'finance', 'finance_documents', v_doc.id,
    coalesce(v_doc.supplier_name,'') || ' · ' || coalesce(v_doc.document_number,''),
    v_doc.total_amount, 'EUR', v_doc.total_amount, 'posted',
    auth.uid(), now(),
    jsonb_build_object('document_type',v_doc.document_type,'external_source',v_doc.external_source,'confidence',v_doc.confidence,'classification_reason',v_doc.classification_reason),
    auth.uid()
  ) on conflict do nothing returning id into v_posting_id;

  if v_posting_id is null then
    select id into v_posting_id from public.financial_postings
    where source_table='finance_documents' and source_id=v_doc.id and status <> 'rejected' limit 1;
  end if;

  update public.finance_documents
  set classification_status='approved', approved_by=auth.uid(), approved_at=now(), decision_notes=p_notes,
      financial_posting_id=v_posting_id, updated_at=now()
  where id=p_document_id;

  return jsonb_build_object('success',true,'document_id',p_document_id,'posting_id',v_posting_id);
end;
$$;

create or replace function public.reject_finance_document(p_document_id uuid, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_finance_approve() then raise exception 'Approval permission required'; end if;
  if coalesce(trim(p_notes),'')='' then raise exception 'Rejection notes are required'; end if;
  update public.finance_documents
  set classification_status='rejected', rejected_by=auth.uid(), rejected_at=now(), decision_notes=p_notes, updated_at=now()
  where id=p_document_id and classification_status in ('ready','exception','manual_review');
  if not found then raise exception 'Pending finance document not found'; end if;
  return jsonb_build_object('success',true,'document_id',p_document_id);
end;
$$;

revoke all on function public.approve_finance_document(uuid,text) from public;
revoke all on function public.reject_finance_document(uuid,text) from public;
grant execute on function public.approve_finance_document(uuid,text) to authenticated;
grant execute on function public.reject_finance_document(uuid,text) to authenticated;

alter table public.finance_documents enable row level security;
alter table public.finance_classification_rules enable row level security;

drop policy if exists finance_documents_read on public.finance_documents;
create policy finance_documents_read on public.finance_documents for select to authenticated using (auth.uid() is not null);
drop policy if exists finance_documents_write on public.finance_documents;
create policy finance_documents_write on public.finance_documents for all to authenticated using (public.can_finance_approve()) with check (public.can_finance_approve());
drop policy if exists finance_rules_read on public.finance_classification_rules;
create policy finance_rules_read on public.finance_classification_rules for select to authenticated using (auth.uid() is not null);
drop policy if exists finance_rules_write on public.finance_classification_rules;
create policy finance_rules_write on public.finance_classification_rules for all to authenticated using (public.can_finance_approve()) with check (public.can_finance_approve());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='finance_documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_documents;
  END IF;
END $$;

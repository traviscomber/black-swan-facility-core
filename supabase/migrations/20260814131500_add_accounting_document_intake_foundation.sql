-- Black Swan OS: entity-aware accounting document and OCR intake foundation.
--
-- This migration is additive and review-first. It does not reinterpret or migrate
-- existing hospitality invoices/payments. AI/OCR output is stored as a proposal;
-- canonical accounting records require explicit review and approval.

create table if not exists public.accounting_counterparties (
  id uuid primary key default gen_random_uuid(),
  counterparty_type text not null,
  display_name text not null,
  tax_id text,
  email text,
  phone text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  counterparty_legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  external_reference text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_counterparty_type_check check (
    counterparty_type in ('supplier','customer','member','donor','employee','legal_entity','other')
  )
);

create unique index if not exists accounting_counterparties_supplier_uidx
  on public.accounting_counterparties(supplier_id)
  where supplier_id is not null;

create unique index if not exists accounting_counterparties_guest_uidx
  on public.accounting_counterparties(guest_id)
  where guest_id is not null;

create unique index if not exists accounting_counterparties_legal_entity_uidx
  on public.accounting_counterparties(counterparty_legal_entity_id)
  where counterparty_legal_entity_id is not null;

create table if not exists public.accounting_document_intake (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_reference text,
  source_file_name text,
  source_file_hash text,
  source_storage_path text,
  received_at timestamptz not null default now(),
  raw_ocr_text text,
  raw_extraction jsonb not null default '{}'::jsonb,
  proposed_document_type text,
  proposed_legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  proposed_counterparty_id uuid references public.accounting_counterparties(id) on delete set null,
  proposed_document_number text,
  proposed_document_date date,
  proposed_due_date date,
  proposed_currency text,
  proposed_net_amount numeric,
  proposed_tax_amount numeric,
  proposed_total_amount numeric,
  proposed_direction text,
  proposed_department_id uuid references public.entity_departments(id) on delete set null,
  proposed_cost_center_id uuid references public.cost_centers(id) on delete set null,
  proposed_account_code text,
  confidence numeric,
  model_provider text,
  model_name text,
  model_run_id text,
  status text not null default 'received',
  requires_review boolean not null default true,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  canonical_document_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_intake_source_type_check check (
    source_type in ('upload','email','scan','api','bank_import','manual')
  ),
  constraint accounting_intake_document_type_check check (
    proposed_document_type is null or proposed_document_type in (
      'supplier_invoice','customer_invoice','credit_note','receipt','payment_proof',
      'donation_slip','bank_document','tax_document','contract','other'
    )
  ),
  constraint accounting_intake_direction_check check (
    proposed_direction is null or proposed_direction in ('payable','receivable','donation','informational')
  ),
  constraint accounting_intake_status_check check (
    status in ('received','extracting','classified','review','approved','rejected','posted')
  ),
  constraint accounting_intake_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  constraint accounting_intake_amounts_check check (
    (proposed_net_amount is null or proposed_net_amount >= 0)
    and (proposed_tax_amount is null or proposed_tax_amount >= 0)
    and (proposed_total_amount is null or proposed_total_amount >= 0)
  )
);

create table if not exists public.accounting_documents (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  counterparty_id uuid references public.accounting_counterparties(id) on delete set null,
  intake_id uuid unique references public.accounting_document_intake(id) on delete set null,
  document_type text not null,
  direction text not null,
  document_number text,
  document_date date not null,
  due_date date,
  currency text not null default 'CLP',
  net_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null,
  status text not null default 'draft',
  source_invoice_id uuid references public.invoices(id) on delete set null,
  source_payment_id uuid references public.payments(id) on delete set null,
  source_operational_document_id uuid references public.operational_documents(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_document_type_check check (
    document_type in (
      'supplier_invoice','customer_invoice','credit_note','receipt','payment_proof',
      'donation_slip','bank_document','tax_document','contract','other'
    )
  ),
  constraint accounting_document_direction_check check (
    direction in ('payable','receivable','donation','informational')
  ),
  constraint accounting_document_status_check check (
    status in ('draft','approved','posted','voided')
  ),
  constraint accounting_document_amounts_check check (
    net_amount >= 0 and tax_amount >= 0 and total_amount >= 0
  ),
  constraint accounting_document_dates_check check (due_date is null or due_date >= document_date)
);

alter table public.accounting_document_intake
  add constraint accounting_document_intake_canonical_fk
  foreign key (canonical_document_id) references public.accounting_documents(id) on delete set null;

create table if not exists public.accounting_document_allocations (
  id uuid primary key default gen_random_uuid(),
  accounting_document_id uuid not null references public.accounting_documents(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  department_id uuid references public.entity_departments(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  account_code text,
  allocation_type text not null default 'expense',
  description text,
  amount numeric not null,
  tax_amount numeric not null default 0,
  asset_id uuid references public.assets(id) on delete set null,
  stock_item_id uuid references public.inventory_stock_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint accounting_allocation_type_check check (
    allocation_type in ('expense','revenue','donation','asset','inventory','tax','intercompany','other')
  ),
  constraint accounting_allocation_amount_check check (amount >= 0 and tax_amount >= 0)
);

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  transaction_date date not null,
  direction text not null,
  amount numeric not null,
  currency text not null default 'CLP',
  bank_reference text,
  account_reference text,
  counterparty_id uuid references public.accounting_counterparties(id) on delete set null,
  description text,
  source_type text not null default 'manual',
  source_reference text,
  raw_payload jsonb not null default '{}'::jsonb,
  reconciliation_status text not null default 'unmatched',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_transaction_direction_check check (direction in ('inflow','outflow')),
  constraint cash_transaction_amount_check check (amount > 0),
  constraint cash_transaction_source_type_check check (source_type in ('bank_import','manual','api')),
  constraint cash_transaction_reconciliation_check check (
    reconciliation_status in ('unmatched','partial','matched','exception')
  )
);

create table if not exists public.accounting_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  cash_transaction_id uuid not null references public.cash_transactions(id) on delete cascade,
  accounting_document_id uuid not null references public.accounting_documents(id) on delete cascade,
  matched_amount numeric not null,
  match_method text not null,
  confidence numeric,
  status text not null default 'proposed',
  proposed_by text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint accounting_reconciliation_amount_check check (matched_amount > 0),
  constraint accounting_reconciliation_method_check check (
    match_method in ('exact_reference','amount_date','counterparty','ai_proposed','manual')
  ),
  constraint accounting_reconciliation_status_check check (
    status in ('proposed','approved','rejected','reversed')
  ),
  constraint accounting_reconciliation_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists accounting_intake_status_idx
  on public.accounting_document_intake(status, received_at desc);
create index if not exists accounting_intake_entity_idx
  on public.accounting_document_intake(proposed_legal_entity_id, status);
create index if not exists accounting_documents_entity_date_idx
  on public.accounting_documents(legal_entity_id, document_date desc);
create index if not exists accounting_documents_counterparty_idx
  on public.accounting_documents(counterparty_id, document_date desc);
create index if not exists cash_transactions_entity_date_idx
  on public.cash_transactions(legal_entity_id, transaction_date desc);
create index if not exists reconciliation_cash_idx
  on public.accounting_reconciliation_matches(cash_transaction_id, status);
create index if not exists reconciliation_document_idx
  on public.accounting_reconciliation_matches(accounting_document_id, status);

-- Intake is intentionally admin-only while it may not yet have a reliable entity.
alter table public.accounting_counterparties enable row level security;
alter table public.accounting_document_intake enable row level security;
alter table public.accounting_documents enable row level security;
alter table public.accounting_document_allocations enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.accounting_reconciliation_matches enable row level security;

create policy accounting_counterparties_admin_select
  on public.accounting_counterparties for select to authenticated
  using (public.current_app_role() = 'admin');
create policy accounting_counterparties_admin_write
  on public.accounting_counterparties for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy accounting_intake_admin_select
  on public.accounting_document_intake for select to authenticated
  using (public.current_app_role() = 'admin');
create policy accounting_intake_admin_write
  on public.accounting_document_intake for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy accounting_documents_finance_select
  on public.accounting_documents for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy accounting_documents_finance_write
  on public.accounting_documents for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));

create policy accounting_allocations_finance_select
  on public.accounting_document_allocations for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy accounting_allocations_finance_write
  on public.accounting_document_allocations for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));

create policy cash_transactions_finance_select
  on public.cash_transactions for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy cash_transactions_finance_write
  on public.cash_transactions for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));

create policy reconciliation_finance_select
  on public.accounting_reconciliation_matches for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy reconciliation_finance_write
  on public.accounting_reconciliation_matches for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));

comment on table public.accounting_document_intake is 'OCR/document-understanding intake. AI output is a proposal only and must be reviewed before canonical posting.';
comment on table public.accounting_documents is 'Canonical entity-bound accounting source documents. Existing hospitality invoices/payments are not auto-migrated.';
comment on table public.accounting_document_allocations is 'Reviewed allocation of a canonical accounting document to department, cost center, account, asset, inventory, revenue, donation, tax, or intercompany purpose.';
comment on table public.cash_transactions is 'Entity-specific bank/cash transactions for reconciliation. Each row belongs to exactly one legal entity.';
comment on table public.accounting_reconciliation_matches is 'Auditable proposed/approved matches between cash movements and accounting documents.';
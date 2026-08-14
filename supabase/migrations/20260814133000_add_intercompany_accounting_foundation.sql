-- Black Swan OS: intercompany accounting foundation.
--
-- This migration creates the rule, paired-transaction, and reconciliation model.
-- It intentionally seeds no lease amount, billing frequency, tax treatment, or
-- commercial terms. Those values must come from approved legal/accounting data.

create table if not exists public.intercompany_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  source_legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  destination_legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  rule_type text not null,
  frequency text not null default 'ad_hoc',
  calculation_method text not null default 'manual',
  fixed_amount numeric,
  percentage_rate numeric,
  currency text not null default 'CLP',
  source_account_code text,
  destination_account_code text,
  tax_treatment text,
  invoice_required boolean not null default true,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft',
  agreement_reference text,
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intercompany_rule_distinct_entities_check check (source_legal_entity_id <> destination_legal_entity_id),
  constraint intercompany_rule_type_check check (
    rule_type in ('lease','service','cost_share','reimbursement','asset_charge','management_fee','other')
  ),
  constraint intercompany_frequency_check check (
    frequency in ('monthly','quarterly','annual','ad_hoc')
  ),
  constraint intercompany_calculation_method_check check (
    calculation_method in ('fixed','percentage','manual')
  ),
  constraint intercompany_fixed_amount_check check (fixed_amount is null or fixed_amount >= 0),
  constraint intercompany_percentage_check check (
    percentage_rate is null or (percentage_rate >= 0 and percentage_rate <= 100)
  ),
  constraint intercompany_rule_status_check check (
    status in ('draft','active','suspended','expired')
  ),
  constraint intercompany_rule_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint intercompany_rule_method_value_check check (
    (calculation_method <> 'fixed' or fixed_amount is not null)
    and (calculation_method <> 'percentage' or percentage_rate is not null)
  )
);

create table if not exists public.intercompany_transactions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.intercompany_rules(id) on delete set null,
  source_legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  destination_legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  period_start date,
  period_end date,
  transaction_date date not null,
  description text not null,
  net_amount numeric not null,
  tax_amount numeric not null default 0,
  total_amount numeric not null,
  currency text not null default 'CLP',
  source_accounting_document_id uuid references public.accounting_documents(id) on delete set null,
  destination_accounting_document_id uuid references public.accounting_documents(id) on delete set null,
  status text not null default 'proposed',
  exception_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intercompany_transaction_distinct_entities_check check (source_legal_entity_id <> destination_legal_entity_id),
  constraint intercompany_transaction_amounts_check check (
    net_amount >= 0 and tax_amount >= 0 and total_amount >= 0
  ),
  constraint intercompany_transaction_total_check check (total_amount = net_amount + tax_amount),
  constraint intercompany_transaction_period_check check (
    period_end is null or period_start is null or period_end >= period_start
  ),
  constraint intercompany_transaction_status_check check (
    status in ('proposed','approved','invoiced','partially_paid','settled','exception','cancelled')
  )
);

create table if not exists public.intercompany_reconciliations (
  id uuid primary key default gen_random_uuid(),
  intercompany_transaction_id uuid not null references public.intercompany_transactions(id) on delete cascade,
  source_cash_transaction_id uuid references public.cash_transactions(id) on delete set null,
  destination_cash_transaction_id uuid references public.cash_transactions(id) on delete set null,
  expected_amount numeric not null,
  source_recorded_amount numeric,
  destination_recorded_amount numeric,
  difference_amount numeric generated always as (
    coalesce(source_recorded_amount, 0) - coalesce(destination_recorded_amount, 0)
  ) stored,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intercompany_reconciliation_expected_check check (expected_amount >= 0),
  constraint intercompany_reconciliation_source_check check (source_recorded_amount is null or source_recorded_amount >= 0),
  constraint intercompany_reconciliation_destination_check check (destination_recorded_amount is null or destination_recorded_amount >= 0),
  constraint intercompany_reconciliation_status_check check (
    status in ('pending','matched','difference','exception','reversed')
  )
);

create index if not exists intercompany_rules_entities_idx
  on public.intercompany_rules(source_legal_entity_id, destination_legal_entity_id, status);
create index if not exists intercompany_transactions_entities_date_idx
  on public.intercompany_transactions(source_legal_entity_id, destination_legal_entity_id, transaction_date desc);
create index if not exists intercompany_transactions_status_idx
  on public.intercompany_transactions(status, transaction_date desc);
create index if not exists intercompany_reconciliations_status_idx
  on public.intercompany_reconciliations(status, created_at desc);

alter table public.intercompany_rules enable row level security;
alter table public.intercompany_transactions enable row level security;
alter table public.intercompany_reconciliations enable row level security;

-- Intercompany data is visible only when the user has finance access to BOTH
-- legal entities involved. This prevents club-level access to Corporacion/Infra
-- from leaking Agricola or Blue Marble transactions.
create policy intercompany_rules_finance_select
  on public.intercompany_rules for select to authenticated
  using (
    public.can_access_legal_entity(source_legal_entity_id, 'finance')
    and public.can_access_legal_entity(destination_legal_entity_id, 'finance')
  );
create policy intercompany_rules_finance_write
  on public.intercompany_rules for all to authenticated
  using (
    public.can_access_legal_entity(source_legal_entity_id, 'finance')
    and public.can_access_legal_entity(destination_legal_entity_id, 'finance')
  )
  with check (
    public.can_access_legal_entity(source_legal_entity_id, 'finance')
    and public.can_access_legal_entity(destination_legal_entity_id, 'finance')
  );

create policy intercompany_transactions_finance_select
  on public.intercompany_transactions for select to authenticated
  using (
    public.can_access_legal_entity(source_legal_entity_id, 'finance')
    and public.can_access_legal_entity(destination_legal_entity_id, 'finance')
  );
create policy intercompany_transactions_finance_write
  on public.intercompany_transactions for all to authenticated
  using (
    public.can_access_legal_entity(source_legal_entity_id, 'finance')
    and public.can_access_legal_entity(destination_legal_entity_id, 'finance')
  )
  with check (
    public.can_access_legal_entity(source_legal_entity_id, 'finance')
    and public.can_access_legal_entity(destination_legal_entity_id, 'finance')
  );

create policy intercompany_reconciliations_finance_select
  on public.intercompany_reconciliations for select to authenticated
  using (
    exists (
      select 1
      from public.intercompany_transactions t
      where t.id = intercompany_transaction_id
        and public.can_access_legal_entity(t.source_legal_entity_id, 'finance')
        and public.can_access_legal_entity(t.destination_legal_entity_id, 'finance')
    )
  );
create policy intercompany_reconciliations_finance_write
  on public.intercompany_reconciliations for all to authenticated
  using (
    exists (
      select 1
      from public.intercompany_transactions t
      where t.id = intercompany_transaction_id
        and public.can_access_legal_entity(t.source_legal_entity_id, 'finance')
        and public.can_access_legal_entity(t.destination_legal_entity_id, 'finance')
    )
  )
  with check (
    exists (
      select 1
      from public.intercompany_transactions t
      where t.id = intercompany_transaction_id
        and public.can_access_legal_entity(t.source_legal_entity_id, 'finance')
        and public.can_access_legal_entity(t.destination_legal_entity_id, 'finance')
    )
  );

comment on table public.intercompany_rules is 'Approved legal/accounting rules between Black Swan legal entities. No commercial terms are seeded without canonical agreements.';
comment on table public.intercompany_transactions is 'Paired intercompany obligation record from source entity to destination entity, with independent canonical accounting documents on each side.';
comment on table public.intercompany_reconciliations is 'Audit reconciliation between both sides of an intercompany transaction and their cash movements.';
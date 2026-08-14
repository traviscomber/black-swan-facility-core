-- Black Swan OS: entity-specific accounting/reporting and bank-status foundation.
-- No chart-of-account rows, opening balances, bank balances, or external credentials are seeded.
-- Real accounting structure and balances must come from canonical accountant/bank sources.

create table if not exists public.entity_chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type text not null,
  parent_account_id uuid references public.entity_chart_of_accounts(id) on delete restrict,
  cashflow_class text,
  is_active boolean not null default true,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, account_code),
  constraint entity_coa_type_check check (account_type in ('asset','liability','equity','revenue','expense')),
  constraint entity_coa_cashflow_check check (cashflow_class is null or cashflow_class in ('operating','investing','financing','non_cash'))
);

create table if not exists public.accounting_journal_entries (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  entry_date date not null,
  reference text,
  description text,
  source_type text not null,
  source_document_id uuid references public.accounting_documents(id) on delete set null,
  source_cash_transaction_id uuid references public.cash_transactions(id) on delete set null,
  intercompany_transaction_id uuid references public.intercompany_transactions(id) on delete set null,
  status text not null default 'draft',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_journal_source_check check (source_type in ('document','cash','intercompany','opening_balance','adjustment','manual')),
  constraint accounting_journal_status_check check (status in ('draft','approved','posted','reversed'))
);

create table if not exists public.accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.accounting_journal_entries(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  account_id uuid not null references public.entity_chart_of_accounts(id) on delete restrict,
  department_id uuid references public.entity_departments(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  description text,
  created_at timestamptz not null default now(),
  constraint accounting_journal_line_nonnegative check (debit >= 0 and credit >= 0),
  constraint accounting_journal_line_one_side check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists accounting_journal_entries_entity_date_idx
  on public.accounting_journal_entries(legal_entity_id, entry_date desc, status);
create index if not exists accounting_journal_lines_entry_idx
  on public.accounting_journal_lines(journal_entry_id);
create index if not exists accounting_journal_lines_account_idx
  on public.accounting_journal_lines(legal_entity_id, account_id);

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  provider_key text not null,
  provider_display_name text not null,
  connection_status text not null default 'not_configured',
  external_connection_reference text,
  last_successful_sync_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  configuration_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, provider_key),
  constraint bank_connection_status_check check (connection_status in ('not_configured','pending','connected','degraded','error','disabled'))
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  bank_connection_id uuid references public.bank_connections(id) on delete set null,
  account_name text not null,
  account_type text,
  currency text not null default 'CLP',
  external_account_reference text,
  masked_account_identifier text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, external_account_reference)
);

create table if not exists public.bank_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  balance_type text not null,
  amount numeric not null,
  currency text not null,
  as_of timestamptz not null,
  source text not null default 'api',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint bank_balance_type_check check (balance_type in ('available','current','ledger')),
  constraint bank_balance_source_check check (source in ('api','statement_import','manual_verified'))
);

create index if not exists bank_balance_snapshots_latest_idx
  on public.bank_balance_snapshots(legal_entity_id, bank_account_id, as_of desc);

create or replace view public.entity_trial_balance as
select
  je.legal_entity_id,
  jl.account_id,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  sum(jl.debit) as total_debit,
  sum(jl.credit) as total_credit,
  sum(jl.debit - jl.credit) as balance
from public.accounting_journal_entries je
join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
where je.status = 'posted'
group by je.legal_entity_id, jl.account_id, coa.account_code, coa.account_name, coa.account_type;

create or replace view public.entity_profit_and_loss as
select
  je.legal_entity_id,
  date_trunc('month', je.entry_date)::date as period_month,
  coa.account_type,
  coa.account_code,
  coa.account_name,
  sum(case when coa.account_type = 'revenue' then jl.credit - jl.debit else jl.debit - jl.credit end) as amount
from public.accounting_journal_entries je
join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
where je.status = 'posted' and coa.account_type in ('revenue','expense')
group by je.legal_entity_id, date_trunc('month', je.entry_date)::date, coa.account_type, coa.account_code, coa.account_name;

create or replace view public.entity_balance_sheet as
select
  je.legal_entity_id,
  coa.account_type,
  coa.account_code,
  coa.account_name,
  sum(case
    when coa.account_type in ('asset','expense') then jl.debit - jl.credit
    else jl.credit - jl.debit
  end) as balance
from public.accounting_journal_entries je
join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
where je.status = 'posted' and coa.account_type in ('asset','liability','equity')
group by je.legal_entity_id, coa.account_type, coa.account_code, coa.account_name;

create or replace view public.entity_cash_flow as
select
  je.legal_entity_id,
  date_trunc('month', je.entry_date)::date as period_month,
  coa.cashflow_class,
  sum(jl.debit - jl.credit) as net_movement
from public.accounting_journal_entries je
join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
where je.status = 'posted' and coa.cashflow_class is not null
group by je.legal_entity_id, date_trunc('month', je.entry_date)::date, coa.cashflow_class;

create or replace view public.entity_latest_bank_cash_status as
select distinct on (b.legal_entity_id, b.bank_account_id, b.balance_type)
  b.legal_entity_id,
  b.bank_account_id,
  ba.account_name,
  b.balance_type,
  b.amount,
  b.currency,
  b.as_of
from public.bank_balance_snapshots b
join public.bank_accounts ba on ba.id = b.bank_account_id and ba.legal_entity_id = b.legal_entity_id
order by b.legal_entity_id, b.bank_account_id, b.balance_type, b.as_of desc;

alter table public.entity_chart_of_accounts enable row level security;
alter table public.accounting_journal_entries enable row level security;
alter table public.accounting_journal_lines enable row level security;
alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_balance_snapshots enable row level security;

create policy entity_coa_finance_access on public.entity_chart_of_accounts for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy journal_entries_finance_access on public.accounting_journal_entries for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy journal_lines_finance_access on public.accounting_journal_lines for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy bank_connections_finance_access on public.bank_connections for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy bank_accounts_finance_access on public.bank_accounts for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy bank_balances_finance_access on public.bank_balance_snapshots for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));

comment on table public.entity_chart_of_accounts is 'Canonical chart of accounts per legal entity. No accounts are fabricated; import from each entity accountant/source.';
comment on table public.accounting_journal_entries is 'Entity-bound accounting journal entry header used for auditable P&L, balance sheet and cash-flow reporting.';
comment on table public.accounting_journal_lines is 'Double-entry journal lines. Posting validation should require balanced entries before status=posted.';
comment on table public.bank_connections is 'Bank API/integration status by legal entity. Secrets/tokens must remain outside this table in secure environment/provider storage.';
comment on table public.bank_balance_snapshots is 'Verified cash-status snapshots from bank APIs, statements or manually verified balances; never inferred.';
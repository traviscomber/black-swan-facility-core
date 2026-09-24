-- Automatic weekly bank cross for Santiago.
alter table public.finance_bank_statement_uploads
  add column if not exists processed_at timestamptz,
  add column if not exists matched_count integer not null default 0,
  add column if not exists unmatched_count integer not null default 0,
  add column if not exists processing_error text;

create table if not exists public.finance_bank_statement_rows (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.finance_bank_statement_uploads(id) on delete cascade,
  transaction_date date not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'CLP',
  direction text not null default 'debit' check (direction in ('debit','credit')),
  description text,
  bank_reference text,
  counterparty_name text,
  raw_payload jsonb not null default '{}'::jsonb,
  matched_document_id uuid references public.finance_documents(id) on delete set null,
  match_confidence numeric check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  match_reason text,
  created_at timestamptz not null default now()
);

create index if not exists finance_bank_statement_rows_statement_idx
  on public.finance_bank_statement_rows(statement_id, transaction_date desc);
create index if not exists finance_bank_statement_rows_document_idx
  on public.finance_bank_statement_rows(matched_document_id)
  where matched_document_id is not null;

alter table public.finance_bank_statement_rows enable row level security;
revoke all on public.finance_bank_statement_rows from anon, authenticated;
grant select on public.finance_bank_statement_rows to authenticated;

drop policy if exists finance_bank_statement_rows_finance_read on public.finance_bank_statement_rows;
create policy finance_bank_statement_rows_finance_read
  on public.finance_bank_statement_rows for select to authenticated
  using (
    (select public.can_app_action('finance.adjust'))
    or (select public.can_finance_payment_authorize())
  );

drop policy if exists finance_bank_statement_payment_authorizer_read on public.finance_bank_statement_uploads;
create policy finance_bank_statement_payment_authorizer_read
  on public.finance_bank_statement_uploads for select to authenticated
  using ((select public.can_finance_payment_authorize()));

comment on table public.finance_bank_statement_rows is
  'Parsed bank statement movements used to cross approved supplier expenses. A bank match may mark payment observed, never final reconciliation automatically.';

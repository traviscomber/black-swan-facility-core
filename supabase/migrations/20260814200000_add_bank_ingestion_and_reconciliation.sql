-- Black Swan OS: provider-neutral bank ingestion + reconciliation foundation.
-- No provider credentials or fabricated balances are stored here.

create table if not exists public.bank_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  bank_connection_id uuid references public.bank_connections(id) on delete set null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  processed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (legal_entity_id, provider_event_id),
  constraint bank_ingestion_event_status_check check (status in ('received','processed','duplicate','error'))
);

alter table public.cash_transactions
  add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null,
  add column if not exists provider_transaction_id text,
  add column if not exists booked_at timestamptz,
  add column if not exists value_date date,
  add column if not exists status text not null default 'booked';

create unique index if not exists cash_transactions_provider_unique
  on public.cash_transactions(legal_entity_id, bank_account_id, provider_transaction_id)
  where provider_transaction_id is not null;

create or replace function public.ingest_bank_transaction(
  p_legal_entity_id uuid,
  p_bank_account_id uuid,
  p_provider_transaction_id text,
  p_transaction_date date,
  p_direction text,
  p_amount numeric,
  p_currency text,
  p_description text default null,
  p_bank_reference text default null,
  p_counterparty_id uuid default null,
  p_raw_payload jsonb default '{}'::jsonb,
  p_booked_at timestamptz default null,
  p_value_date date default null,
  p_status text default 'booked'
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_id uuid;
  v_account_entity uuid;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'BANK_INGEST_FORBIDDEN';
  end if;

  select legal_entity_id into v_account_entity
  from public.bank_accounts where id = p_bank_account_id;

  if v_account_entity is null or v_account_entity <> p_legal_entity_id then
    raise exception 'BANK_ACCOUNT_ENTITY_MISMATCH';
  end if;

  insert into public.cash_transactions(
    legal_entity_id, bank_account_id, provider_transaction_id, transaction_date,
    direction, amount, currency, bank_reference, counterparty_id, description,
    source_type, raw_payload, booked_at, value_date, status
  ) values (
    p_legal_entity_id, p_bank_account_id, p_provider_transaction_id, p_transaction_date,
    p_direction, p_amount, coalesce(nullif(p_currency,''),'CLP'), p_bank_reference,
    p_counterparty_id, p_description, 'api', coalesce(p_raw_payload,'{}'::jsonb),
    p_booked_at, p_value_date, p_status
  )
  on conflict (legal_entity_id, bank_account_id, provider_transaction_id)
  where provider_transaction_id is not null
  do update set
    transaction_date = excluded.transaction_date,
    direction = excluded.direction,
    amount = excluded.amount,
    currency = excluded.currency,
    bank_reference = excluded.bank_reference,
    counterparty_id = excluded.counterparty_id,
    description = excluded.description,
    raw_payload = excluded.raw_payload,
    booked_at = excluded.booked_at,
    value_date = excluded.value_date,
    status = excluded.status,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.ingest_bank_balance_snapshot(
  p_bank_account_id uuid,
  p_balance_type text,
  p_amount numeric,
  p_currency text,
  p_as_of timestamptz,
  p_raw_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_entity_id uuid;
  v_id uuid;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'BANK_INGEST_FORBIDDEN';
  end if;

  select legal_entity_id into v_entity_id from public.bank_accounts where id = p_bank_account_id;
  if v_entity_id is null then raise exception 'BANK_ACCOUNT_NOT_FOUND'; end if;

  insert into public.bank_balance_snapshots(bank_account_id, legal_entity_id, balance_type, amount, currency, as_of, source, raw_payload)
  values (p_bank_account_id, v_entity_id, p_balance_type, p_amount, p_currency, p_as_of, 'api', coalesce(p_raw_payload,'{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.propose_reconciliation_matches(
  p_cash_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_cash public.cash_transactions%rowtype;
  v_count integer := 0;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'RECONCILIATION_FORBIDDEN';
  end if;

  select * into v_cash from public.cash_transactions where id = p_cash_transaction_id;
  if not found then raise exception 'CASH_TRANSACTION_NOT_FOUND'; end if;

  insert into public.accounting_reconciliation_matches(
    legal_entity_id, cash_transaction_id, accounting_document_id, matched_amount,
    match_method, confidence, status, proposed_by
  )
  select
    v_cash.legal_entity_id,
    v_cash.id,
    d.id,
    least(v_cash.amount, d.total_amount),
    case when d.total_amount = v_cash.amount then 'amount_date' else 'counterparty' end,
    case when d.total_amount = v_cash.amount then 0.90 else 0.65 end,
    'proposed',
    'deterministic_rule'
  from public.accounting_documents d
  where d.legal_entity_id = v_cash.legal_entity_id
    and d.status in ('approved','posted')
    and d.direction in ('payable','receivable','donation')
    and abs(d.document_date - v_cash.transaction_date) <= 7
    and (
      d.total_amount = v_cash.amount
      or (v_cash.counterparty_id is not null and d.counterparty_id = v_cash.counterparty_id)
    )
    and not exists (
      select 1 from public.accounting_reconciliation_matches m
      where m.cash_transaction_id = v_cash.id
        and m.accounting_document_id = d.id
        and m.status in ('proposed','approved')
    );

  get diagnostics v_count = row_count;
  return jsonb_build_object('cash_transaction_id', v_cash.id, 'proposals_created', v_count);
end;
$function$;

revoke all on function public.ingest_bank_transaction(uuid,uuid,text,date,text,numeric,text,text,text,uuid,jsonb,timestamptz,date,text) from public;
revoke all on function public.ingest_bank_balance_snapshot(uuid,text,numeric,text,timestamptz,jsonb) from public;
revoke all on function public.propose_reconciliation_matches(uuid) from public;
grant execute on function public.ingest_bank_transaction(uuid,uuid,text,date,text,numeric,text,text,text,uuid,jsonb,timestamptz,date,text) to authenticated;
grant execute on function public.ingest_bank_balance_snapshot(uuid,text,numeric,text,timestamptz,jsonb) to authenticated;
grant execute on function public.propose_reconciliation_matches(uuid) to authenticated;

alter table public.bank_ingestion_events enable row level security;
create policy bank_ingestion_events_admin on public.bank_ingestion_events for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

comment on table public.bank_ingestion_events is 'Idempotent provider webhook/poll event ledger. Raw payload retained for audit; credentials remain outside Postgres.';
comment on function public.propose_reconciliation_matches(uuid) is 'Creates deterministic reconciliation proposals only. It never approves a reconciliation automatically.';

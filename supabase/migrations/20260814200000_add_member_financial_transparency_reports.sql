-- Black Swan OS: read-only legal-entity financial reporting and member transparency.
-- Members may see approved financial reports for Black Swan Infra SpA and
-- Black Swan Corporacion only. Agricola and Blue Marble remain inaccessible.
-- No raw accounting mutation authority is granted by this migration.

create table if not exists public.member_auth_links (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  unique (member_id, user_id),
  constraint member_auth_links_status_check check (status in ('active','suspended','ended')),
  constraint member_auth_links_dates_check check (ended_at is null or ended_at >= linked_at)
);

create unique index if not exists member_auth_links_one_active_user
  on public.member_auth_links(user_id)
  where status = 'active' and ended_at is null;

alter table public.member_auth_links enable row level security;

create policy member_auth_links_admin_select
  on public.member_auth_links for select to authenticated
  using (public.current_app_role() = 'admin' or user_id = auth.uid());

create policy member_auth_links_admin_write
  on public.member_auth_links for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create or replace function public.can_view_financial_report(p_legal_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text;
begin
  if auth.uid() is null or p_legal_entity_id is null then
    return false;
  end if;

  if public.can_access_legal_entity(p_legal_entity_id, 'finance') then
    return true;
  end if;

  select code into v_code
  from public.legal_entities
  where id = p_legal_entity_id and is_active;

  if v_code not in ('BS_INFRA', 'BS_CORPORACION') then
    return false;
  end if;

  return exists (
    select 1
    from public.member_auth_links mal
    join public.members m on m.id = mal.member_id
    join public.legal_entities mle on mle.id = m.legal_entity_id
    where mal.user_id = auth.uid()
      and mal.status = 'active'
      and mal.ended_at is null
      and m.status = 'active'
      and mle.code = 'BS_CORPORACION'
  );
end;
$function$;

create or replace function public.get_entity_financial_report(
  p_legal_entity_id uuid,
  p_report_type text,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text;
  v_name text;
  v_from date;
  v_to date;
  v_rows jsonb;
  v_summary jsonb;
begin
  if not public.can_view_financial_report(p_legal_entity_id) then
    raise exception 'FINANCIAL_REPORT_FORBIDDEN';
  end if;

  select code, display_name into v_code, v_name
  from public.legal_entities
  where id = p_legal_entity_id and is_active;

  if v_code is null then
    raise exception 'LEGAL_ENTITY_NOT_FOUND';
  end if;

  v_from := coalesce(p_from, date_trunc('year', current_date)::date);
  v_to := coalesce(p_to, current_date);

  if v_to < v_from then
    raise exception 'INVALID_REPORT_PERIOD';
  end if;

  if p_report_type = 'pl' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.period_month, x.account_type, x.account_code), '[]'::jsonb)
    into v_rows
    from (
      select
        date_trunc('month', je.entry_date)::date as period_month,
        coa.account_type,
        coa.account_code,
        coa.account_name,
        sum(case when coa.account_type = 'revenue' then jl.credit - jl.debit else jl.debit - jl.credit end) as amount
      from public.accounting_journal_entries je
      join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
      join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
      where je.legal_entity_id = p_legal_entity_id
        and je.status = 'posted'
        and je.entry_date between v_from and v_to
        and coa.account_type in ('revenue','expense')
      group by date_trunc('month', je.entry_date)::date, coa.account_type, coa.account_code, coa.account_name
    ) x;

    select jsonb_build_object(
      'revenue', coalesce(sum(case when coa.account_type = 'revenue' then jl.credit - jl.debit else 0 end), 0),
      'expenses', coalesce(sum(case when coa.account_type = 'expense' then jl.debit - jl.credit else 0 end), 0),
      'net_result', coalesce(sum(case when coa.account_type = 'revenue' then jl.credit - jl.debit when coa.account_type = 'expense' then -(jl.debit - jl.credit) else 0 end), 0)
    ) into v_summary
    from public.accounting_journal_entries je
    join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
    join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
    where je.legal_entity_id = p_legal_entity_id
      and je.status = 'posted'
      and je.entry_date between v_from and v_to;

  elsif p_report_type = 'balance_sheet' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.account_type, x.account_code), '[]'::jsonb)
    into v_rows
    from (
      select coa.account_type, coa.account_code, coa.account_name,
        sum(case when coa.account_type = 'asset' then jl.debit - jl.credit else jl.credit - jl.debit end) as balance
      from public.accounting_journal_entries je
      join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
      join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
      where je.legal_entity_id = p_legal_entity_id
        and je.status = 'posted'
        and je.entry_date <= v_to
        and coa.account_type in ('asset','liability','equity')
      group by coa.account_type, coa.account_code, coa.account_name
    ) x;

    select jsonb_build_object(
      'assets', coalesce(sum(case when coa.account_type = 'asset' then jl.debit - jl.credit else 0 end),0),
      'liabilities', coalesce(sum(case when coa.account_type = 'liability' then jl.credit - jl.debit else 0 end),0),
      'equity', coalesce(sum(case when coa.account_type = 'equity' then jl.credit - jl.debit else 0 end),0)
    ) into v_summary
    from public.accounting_journal_entries je
    join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
    join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
    where je.legal_entity_id = p_legal_entity_id and je.status = 'posted' and je.entry_date <= v_to;

  elsif p_report_type = 'cash_flow' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.period_month, x.cashflow_class), '[]'::jsonb)
    into v_rows
    from (
      select date_trunc('month', je.entry_date)::date as period_month,
        coa.cashflow_class,
        sum(jl.debit - jl.credit) as net_movement
      from public.accounting_journal_entries je
      join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
      join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
      where je.legal_entity_id = p_legal_entity_id
        and je.status = 'posted'
        and je.entry_date between v_from and v_to
        and coa.cashflow_class is not null
      group by date_trunc('month', je.entry_date)::date, coa.cashflow_class
    ) x;

    select jsonb_build_object(
      'operating', coalesce(sum(case when coa.cashflow_class = 'operating' then jl.debit - jl.credit else 0 end),0),
      'investing', coalesce(sum(case when coa.cashflow_class = 'investing' then jl.debit - jl.credit else 0 end),0),
      'financing', coalesce(sum(case when coa.cashflow_class = 'financing' then jl.debit - jl.credit else 0 end),0),
      'non_cash', coalesce(sum(case when coa.cashflow_class = 'non_cash' then jl.debit - jl.credit else 0 end),0)
    ) into v_summary
    from public.accounting_journal_entries je
    join public.accounting_journal_lines jl on jl.journal_entry_id = je.id and jl.legal_entity_id = je.legal_entity_id
    join public.entity_chart_of_accounts coa on coa.id = jl.account_id and coa.legal_entity_id = je.legal_entity_id
    where je.legal_entity_id = p_legal_entity_id and je.status = 'posted' and je.entry_date between v_from and v_to;

  elsif p_report_type = 'cash_status' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.account_name, x.balance_type), '[]'::jsonb)
    into v_rows
    from (
      select distinct on (bbs.bank_account_id, bbs.balance_type)
        bbs.bank_account_id, ba.account_name, bbs.balance_type, bbs.amount, bbs.currency, bbs.as_of
      from public.bank_balance_snapshots bbs
      join public.bank_accounts ba on ba.id = bbs.bank_account_id and ba.legal_entity_id = bbs.legal_entity_id
      where bbs.legal_entity_id = p_legal_entity_id and ba.is_active
      order by bbs.bank_account_id, bbs.balance_type, bbs.as_of desc
    ) x;
    v_summary := jsonb_build_object('source', 'verified_bank_balance_snapshots');

  elsif p_report_type = 'revenue_donations' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.period_month, x.category), '[]'::jsonb)
    into v_rows
    from (
      select date_trunc('month', d.document_date)::date as period_month,
        case when d.direction = 'donation' or d.document_type = 'donation_slip' then 'donations' else 'revenue' end as category,
        d.currency,
        sum(d.total_amount) as amount
      from public.accounting_documents d
      where d.legal_entity_id = p_legal_entity_id
        and d.status = 'posted'
        and d.document_date between v_from and v_to
        and (d.direction in ('receivable','donation') or d.document_type in ('customer_invoice','donation_slip'))
      group by date_trunc('month', d.document_date)::date,
        case when d.direction = 'donation' or d.document_type = 'donation_slip' then 'donations' else 'revenue' end,
        d.currency
    ) x;

    select jsonb_build_object(
      'revenue', coalesce(sum(case when d.direction <> 'donation' and d.document_type <> 'donation_slip' then d.total_amount else 0 end),0),
      'donations', coalesce(sum(case when d.direction = 'donation' or d.document_type = 'donation_slip' then d.total_amount else 0 end),0)
    ) into v_summary
    from public.accounting_documents d
    where d.legal_entity_id = p_legal_entity_id
      and d.status = 'posted'
      and d.document_date between v_from and v_to
      and (d.direction in ('receivable','donation') or d.document_type in ('customer_invoice','donation_slip'));

  else
    raise exception 'UNSUPPORTED_REPORT_TYPE';
  end if;

  return jsonb_build_object(
    'legal_entity_id', p_legal_entity_id,
    'legal_entity_code', v_code,
    'legal_entity_name', v_name,
    'report_type', p_report_type,
    'from', v_from,
    'to', v_to,
    'generated_at', now(),
    'summary', coalesce(v_summary, '{}'::jsonb),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.can_view_financial_report(uuid) from public;
revoke all on function public.get_entity_financial_report(uuid,text,date,date) from public;
grant execute on function public.can_view_financial_report(uuid) to authenticated;
grant execute on function public.get_entity_financial_report(uuid,text,date,date) to authenticated;

comment on table public.member_auth_links is 'Explicit audited link between a Corporacion member and an authenticated user. Never inferred from email.';
comment on function public.can_view_financial_report(uuid) is 'Allows entity finance-entitled users, plus active Corporacion members for BS Infra and BS Corporacion only.';
comment on function public.get_entity_financial_report(uuid,text,date,date) is 'Read-only financial report boundary for P&L, Balance Sheet, Cash Flow, verified cash status, and Revenue/Donations.';

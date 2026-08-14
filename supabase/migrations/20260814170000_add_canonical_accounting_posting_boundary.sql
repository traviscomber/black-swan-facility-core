-- Black Swan OS: canonical accounting posting boundary.
-- Approved OCR intake may become a canonical accounting document, but posting
-- requires a separately reviewed and balanced journal. No accounts or amounts
-- are fabricated by this migration.

-- Finance visibility is not accounting mutation authority. Until dedicated
-- accounting operator roles/scopes are introduced, canonical accounting writes
-- remain admin-only while entity finance access remains read-only.
drop policy if exists accounting_documents_finance_write on public.accounting_documents;
drop policy if exists accounting_allocations_finance_write on public.accounting_document_allocations;
drop policy if exists journal_entries_finance_access on public.accounting_journal_entries;
drop policy if exists journal_lines_finance_access on public.accounting_journal_lines;

create policy accounting_documents_admin_write
  on public.accounting_documents for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy accounting_allocations_admin_write
  on public.accounting_document_allocations for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy journal_entries_finance_select
  on public.accounting_journal_entries for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));

create policy journal_entries_admin_write
  on public.accounting_journal_entries for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy journal_lines_finance_select
  on public.accounting_journal_lines for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));

create policy journal_lines_admin_write
  on public.accounting_journal_lines for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create or replace function public.materialize_accounting_document_from_intake(p_intake_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_intake public.accounting_document_intake%rowtype;
  v_document_id uuid;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select * into v_intake
  from public.accounting_document_intake
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'ACCOUNTING_INTAKE_NOT_FOUND';
  end if;

  if v_intake.canonical_document_id is not null then
    return v_intake.canonical_document_id;
  end if;

  if v_intake.status <> 'approved' or v_intake.reviewed_by is null or v_intake.reviewed_at is null then
    raise exception 'ACCOUNTING_INTAKE_NOT_APPROVED';
  end if;

  if v_intake.proposed_legal_entity_id is null
     or v_intake.proposed_document_type is null
     or v_intake.proposed_document_date is null
     or v_intake.proposed_direction is null
     or v_intake.proposed_total_amount is null
     or coalesce(v_intake.proposed_currency, '') = '' then
    raise exception 'ACCOUNTING_INTAKE_INCOMPLETE';
  end if;

  insert into public.accounting_documents (
    legal_entity_id,
    counterparty_id,
    intake_id,
    document_type,
    direction,
    document_number,
    document_date,
    due_date,
    currency,
    net_amount,
    tax_amount,
    total_amount,
    status,
    notes,
    metadata,
    approved_by,
    approved_at,
    created_by
  ) values (
    v_intake.proposed_legal_entity_id,
    v_intake.proposed_counterparty_id,
    v_intake.id,
    v_intake.proposed_document_type,
    v_intake.proposed_direction,
    v_intake.proposed_document_number,
    v_intake.proposed_document_date,
    v_intake.proposed_due_date,
    upper(v_intake.proposed_currency),
    coalesce(v_intake.proposed_net_amount, 0),
    coalesce(v_intake.proposed_tax_amount, 0),
    v_intake.proposed_total_amount,
    'approved',
    v_intake.review_notes,
    jsonb_build_object(
      'source', 'accounting_document_intake',
      'intake_id', v_intake.id,
      'model_provider', v_intake.model_provider,
      'model_name', v_intake.model_name,
      'model_run_id', v_intake.model_run_id,
      'confidence', v_intake.confidence
    ),
    v_intake.reviewed_by,
    v_intake.reviewed_at,
    auth.uid()
  )
  returning id into v_document_id;

  update public.accounting_document_intake
  set canonical_document_id = v_document_id,
      updated_at = now()
  where id = v_intake.id;

  return v_document_id;
end;
$function$;

create or replace function public.create_draft_journal_for_document(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_document public.accounting_documents%rowtype;
  v_existing uuid;
  v_journal_id uuid;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select * into v_document
  from public.accounting_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'ACCOUNTING_DOCUMENT_NOT_FOUND';
  end if;

  if v_document.status <> 'approved' then
    raise exception 'ACCOUNTING_DOCUMENT_NOT_APPROVED';
  end if;

  select id into v_existing
  from public.accounting_journal_entries
  where source_type = 'document'
    and source_document_id = p_document_id
    and status <> 'reversed'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  if not exists (
    select 1
    from public.accounting_document_allocations a
    where a.accounting_document_id = p_document_id
      and a.legal_entity_id = v_document.legal_entity_id
  ) then
    raise exception 'ACCOUNTING_DOCUMENT_ALLOCATION_REQUIRED';
  end if;

  insert into public.accounting_journal_entries (
    legal_entity_id,
    entry_date,
    reference,
    description,
    source_type,
    source_document_id,
    status,
    created_by
  ) values (
    v_document.legal_entity_id,
    v_document.document_date,
    v_document.document_number,
    coalesce(v_document.notes, v_document.document_type),
    'document',
    v_document.id,
    'draft',
    auth.uid()
  )
  returning id into v_journal_id;

  return v_journal_id;
end;
$function$;

create or replace function public.validate_accounting_journal(p_journal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_entity_id uuid;
  v_line_count integer;
  v_debit numeric;
  v_credit numeric;
  v_invalid_lines integer;
begin
  select legal_entity_id into v_entity_id
  from public.accounting_journal_entries
  where id = p_journal_id;

  if v_entity_id is null then
    raise exception 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;

  if auth.uid() is null or not public.can_access_legal_entity(v_entity_id, 'finance') then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select count(*), coalesce(sum(debit),0), coalesce(sum(credit),0)
  into v_line_count, v_debit, v_credit
  from public.accounting_journal_lines
  where journal_entry_id = p_journal_id;

  select count(*) into v_invalid_lines
  from public.accounting_journal_lines jl
  left join public.entity_chart_of_accounts coa on coa.id = jl.account_id
  where jl.journal_entry_id = p_journal_id
    and (
      jl.legal_entity_id <> v_entity_id
      or coa.id is null
      or coa.legal_entity_id <> v_entity_id
      or not coa.is_active
    );

  return jsonb_build_object(
    'journal_id', p_journal_id,
    'legal_entity_id', v_entity_id,
    'line_count', v_line_count,
    'total_debit', v_debit,
    'total_credit', v_credit,
    'invalid_line_count', v_invalid_lines,
    'is_balanced', v_line_count >= 2 and v_debit > 0 and v_debit = v_credit and v_invalid_lines = 0
  );
end;
$function$;

create or replace function public.approve_accounting_journal(p_journal_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_validation jsonb;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select status into v_status
  from public.accounting_journal_entries
  where id = p_journal_id
  for update;

  if v_status is null then
    raise exception 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;

  if v_status <> 'draft' then
    raise exception 'ACCOUNTING_JOURNAL_NOT_DRAFT';
  end if;

  v_validation := public.validate_accounting_journal(p_journal_id);
  if coalesce((v_validation->>'is_balanced')::boolean, false) is not true then
    raise exception 'ACCOUNTING_JOURNAL_NOT_BALANCED';
  end if;

  update public.accounting_journal_entries
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_journal_id;
end;
$function$;

create or replace function public.post_accounting_journal(p_journal_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_entry public.accounting_journal_entries%rowtype;
  v_validation jsonb;
  v_intake_id uuid;
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select * into v_entry
  from public.accounting_journal_entries
  where id = p_journal_id
  for update;

  if not found then
    raise exception 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;

  if v_entry.status <> 'approved' or v_entry.approved_by is null or v_entry.approved_at is null then
    raise exception 'ACCOUNTING_JOURNAL_NOT_APPROVED';
  end if;

  v_validation := public.validate_accounting_journal(p_journal_id);
  if coalesce((v_validation->>'is_balanced')::boolean, false) is not true then
    raise exception 'ACCOUNTING_JOURNAL_NOT_BALANCED';
  end if;

  update public.accounting_journal_entries
  set status = 'posted',
      posted_by = auth.uid(),
      posted_at = now(),
      updated_at = now()
  where id = p_journal_id;

  if v_entry.source_document_id is not null then
    update public.accounting_documents
    set status = 'posted',
        posted_by = auth.uid(),
        posted_at = now(),
        updated_at = now()
    where id = v_entry.source_document_id
      and legal_entity_id = v_entry.legal_entity_id;

    select intake_id into v_intake_id
    from public.accounting_documents
    where id = v_entry.source_document_id;

    if v_intake_id is not null then
      update public.accounting_document_intake
      set status = 'posted',
          updated_at = now()
      where id = v_intake_id;
    end if;
  end if;
end;
$function$;

revoke all on function public.materialize_accounting_document_from_intake(uuid) from public;
revoke all on function public.create_draft_journal_for_document(uuid) from public;
revoke all on function public.validate_accounting_journal(uuid) from public;
revoke all on function public.approve_accounting_journal(uuid) from public;
revoke all on function public.post_accounting_journal(uuid) from public;

grant execute on function public.materialize_accounting_document_from_intake(uuid) to authenticated;
grant execute on function public.create_draft_journal_for_document(uuid) to authenticated;
grant execute on function public.validate_accounting_journal(uuid) to authenticated;
grant execute on function public.approve_accounting_journal(uuid) to authenticated;
grant execute on function public.post_accounting_journal(uuid) to authenticated;

comment on function public.materialize_accounting_document_from_intake(uuid) is 'Creates one canonical accounting document from an explicitly human-approved intake. Does not create allocations or journal entries.';
comment on function public.create_draft_journal_for_document(uuid) is 'Creates only a draft journal header after canonical document approval and at least one explicit allocation. Journal lines remain human/accounting controlled.';
comment on function public.validate_accounting_journal(uuid) is 'Read-only double-entry validation for entity, active account ownership and debit/credit balance.';
comment on function public.post_accounting_journal(uuid) is 'Posts only a separately approved balanced journal and then marks its canonical source document/intake posted.';

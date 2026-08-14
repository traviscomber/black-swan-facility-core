-- Black Swan OS: controlled journal-line editing for draft accounting journals.
-- Browser/UI callers never mutate journal lines directly. This RPC replaces the
-- full draft line set atomically and validates canonical entity/account ownership.

create or replace function public.replace_draft_accounting_journal_lines(
  p_journal_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_entry public.accounting_journal_entries%rowtype;
  v_line jsonb;
  v_account_id uuid;
  v_department_id uuid;
  v_cost_center_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_description text;
  v_count integer := 0;
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

  if v_entry.status <> 'draft' then
    raise exception 'ACCOUNTING_JOURNAL_NOT_DRAFT';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'ACCOUNTING_LINES_ARRAY_REQUIRED';
  end if;

  if jsonb_array_length(p_lines) > 100 then
    raise exception 'ACCOUNTING_TOO_MANY_LINES';
  end if;

  -- Validate the complete replacement before deleting any current lines.
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      v_account_id := nullif(v_line->>'account_id','')::uuid;
      v_department_id := nullif(v_line->>'department_id','')::uuid;
      v_cost_center_id := nullif(v_line->>'cost_center_id','')::uuid;
      v_debit := coalesce(nullif(v_line->>'debit','')::numeric, 0);
      v_credit := coalesce(nullif(v_line->>'credit','')::numeric, 0);
      v_description := nullif(trim(v_line->>'description'), '');
    exception when others then
      raise exception 'ACCOUNTING_INVALID_LINE_FORMAT';
    end;

    if v_account_id is null then
      raise exception 'ACCOUNTING_ACCOUNT_REQUIRED';
    end if;

    if v_debit < 0 or v_credit < 0
       or not ((v_debit > 0 and v_credit = 0) or (v_credit > 0 and v_debit = 0)) then
      raise exception 'ACCOUNTING_LINE_ONE_SIDE_REQUIRED';
    end if;

    if not exists (
      select 1 from public.entity_chart_of_accounts coa
      where coa.id = v_account_id
        and coa.legal_entity_id = v_entry.legal_entity_id
        and coa.is_active
    ) then
      raise exception 'ACCOUNTING_INVALID_ACCOUNT';
    end if;

    if v_department_id is not null and not exists (
      select 1 from public.entity_departments d
      where d.id = v_department_id
        and d.legal_entity_id = v_entry.legal_entity_id
        and d.is_active
    ) then
      raise exception 'ACCOUNTING_INVALID_DEPARTMENT';
    end if;

    if v_cost_center_id is not null and not exists (
      select 1
      from public.cost_center_legal_entity_assignments a
      where a.cost_center_id = v_cost_center_id
        and a.legal_entity_id = v_entry.legal_entity_id
        and a.effective_from <= current_date
        and (a.effective_to is null or a.effective_to >= current_date)
    ) then
      raise exception 'ACCOUNTING_INVALID_COST_CENTER';
    end if;

    v_count := v_count + 1;
  end loop;

  delete from public.accounting_journal_lines
  where journal_entry_id = p_journal_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_account_id := nullif(v_line->>'account_id','')::uuid;
    v_department_id := nullif(v_line->>'department_id','')::uuid;
    v_cost_center_id := nullif(v_line->>'cost_center_id','')::uuid;
    v_debit := coalesce(nullif(v_line->>'debit','')::numeric, 0);
    v_credit := coalesce(nullif(v_line->>'credit','')::numeric, 0);
    v_description := nullif(trim(v_line->>'description'), '');

    insert into public.accounting_journal_lines (
      journal_entry_id,
      legal_entity_id,
      account_id,
      department_id,
      cost_center_id,
      debit,
      credit,
      description
    ) values (
      p_journal_id,
      v_entry.legal_entity_id,
      v_account_id,
      v_department_id,
      v_cost_center_id,
      v_debit,
      v_credit,
      v_description
    );
  end loop;

  return public.validate_accounting_journal(p_journal_id);
end;
$function$;

revoke all on function public.replace_draft_accounting_journal_lines(uuid,jsonb) from public;
grant execute on function public.replace_draft_accounting_journal_lines(uuid,jsonb) to authenticated;

comment on function public.replace_draft_accounting_journal_lines(uuid,jsonb) is
  'Atomically replaces lines on a draft accounting journal after validating active same-entity accounts, departments and cost centers. Admin-only; cannot edit approved/posted journals.';

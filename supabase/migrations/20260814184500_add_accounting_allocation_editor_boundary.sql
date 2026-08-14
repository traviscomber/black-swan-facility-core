-- Black Swan OS: controlled accounting allocation editor boundary.
-- Canonical documents must have explicit, entity-valid allocations that reconcile
-- exactly to the document total before journal creation.

create or replace function public.validate_accounting_document_allocations(p_document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_document public.accounting_documents%rowtype;
  v_count integer;
  v_amount numeric;
  v_tax numeric;
  v_invalid integer;
begin
  select * into v_document
  from public.accounting_documents
  where id = p_document_id;

  if not found then
    raise exception 'ACCOUNTING_DOCUMENT_NOT_FOUND';
  end if;

  if auth.uid() is null or not public.can_access_legal_entity(v_document.legal_entity_id, 'finance') then
    raise exception 'ACCOUNTING_FORBIDDEN';
  end if;

  select count(*), coalesce(sum(amount),0), coalesce(sum(tax_amount),0)
  into v_count, v_amount, v_tax
  from public.accounting_document_allocations
  where accounting_document_id = p_document_id;

  select count(*) into v_invalid
  from public.accounting_document_allocations a
  left join public.entity_departments d on d.id = a.department_id
  left join public.cost_center_legal_entity_assignments cc
    on cc.cost_center_id = a.cost_center_id
   and cc.legal_entity_id = v_document.legal_entity_id
   and cc.effective_to is null
  where a.accounting_document_id = p_document_id
    and (
      a.legal_entity_id <> v_document.legal_entity_id
      or (a.department_id is not null and (d.id is null or d.legal_entity_id <> v_document.legal_entity_id or not d.is_active))
      or (a.cost_center_id is not null and cc.cost_center_id is null)
      or a.amount < 0
      or a.tax_amount < 0
    );

  return jsonb_build_object(
    'document_id', p_document_id,
    'legal_entity_id', v_document.legal_entity_id,
    'allocation_count', v_count,
    'allocated_net', v_amount,
    'allocated_tax', v_tax,
    'allocated_total', v_amount + v_tax,
    'document_total', v_document.total_amount,
    'invalid_allocation_count', v_invalid,
    'is_reconciled', v_count > 0 and v_invalid = 0 and (v_amount + v_tax) = v_document.total_amount
  );
end;
$function$;

create or replace function public.replace_accounting_document_allocations(
  p_document_id uuid,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_document public.accounting_documents%rowtype;
  v_row jsonb;
  v_department_id uuid;
  v_cost_center_id uuid;
  v_amount numeric;
  v_tax numeric;
  v_type text;
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
    raise exception 'ACCOUNTING_DOCUMENT_NOT_EDITABLE';
  end if;

  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'ACCOUNTING_ALLOCATIONS_REQUIRED';
  end if;

  delete from public.accounting_document_allocations
  where accounting_document_id = p_document_id;

  for v_row in select * from jsonb_array_elements(p_allocations)
  loop
    v_department_id := nullif(v_row->>'department_id','')::uuid;
    v_cost_center_id := nullif(v_row->>'cost_center_id','')::uuid;
    v_amount := coalesce((v_row->>'amount')::numeric, 0);
    v_tax := coalesce((v_row->>'tax_amount')::numeric, 0);
    v_type := coalesce(nullif(v_row->>'allocation_type',''), 'expense');

    if v_amount < 0 or v_tax < 0 then
      raise exception 'ACCOUNTING_ALLOCATION_NEGATIVE';
    end if;

    if v_type not in ('expense','revenue','donation','asset','inventory','tax','intercompany','other') then
      raise exception 'ACCOUNTING_ALLOCATION_TYPE_INVALID';
    end if;

    if v_department_id is not null and not exists (
      select 1 from public.entity_departments d
      where d.id = v_department_id
        and d.legal_entity_id = v_document.legal_entity_id
        and d.is_active
    ) then
      raise exception 'ACCOUNTING_ALLOCATION_DEPARTMENT_INVALID';
    end if;

    if v_cost_center_id is not null and not exists (
      select 1 from public.cost_center_legal_entity_assignments a
      where a.cost_center_id = v_cost_center_id
        and a.legal_entity_id = v_document.legal_entity_id
        and a.effective_to is null
    ) then
      raise exception 'ACCOUNTING_ALLOCATION_COST_CENTER_INVALID';
    end if;

    insert into public.accounting_document_allocations (
      accounting_document_id,
      legal_entity_id,
      department_id,
      cost_center_id,
      account_code,
      allocation_type,
      description,
      amount,
      tax_amount,
      metadata
    ) values (
      p_document_id,
      v_document.legal_entity_id,
      v_department_id,
      v_cost_center_id,
      nullif(v_row->>'account_code',''),
      v_type,
      nullif(v_row->>'description',''),
      v_amount,
      v_tax,
      case when jsonb_typeof(v_row->'metadata') = 'object' then v_row->'metadata' else '{}'::jsonb end
    );
  end loop;

  if coalesce((public.validate_accounting_document_allocations(p_document_id)->>'is_reconciled')::boolean, false) is not true then
    raise exception 'ACCOUNTING_ALLOCATIONS_NOT_RECONCILED';
  end if;

  return public.validate_accounting_document_allocations(p_document_id);
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
  v_allocation_validation jsonb;
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

  v_allocation_validation := public.validate_accounting_document_allocations(p_document_id);
  if coalesce((v_allocation_validation->>'is_reconciled')::boolean, false) is not true then
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
  ) returning id into v_journal_id;

  return v_journal_id;
end;
$function$;

revoke all on function public.validate_accounting_document_allocations(uuid) from public;
revoke all on function public.replace_accounting_document_allocations(uuid,jsonb) from public;
grant execute on function public.validate_accounting_document_allocations(uuid) to authenticated;
grant execute on function public.replace_accounting_document_allocations(uuid,jsonb) to authenticated;

comment on function public.validate_accounting_document_allocations(uuid) is 'Validates that canonical document allocations belong to the same entity and reconcile exactly to document total.';
comment on function public.replace_accounting_document_allocations(uuid,jsonb) is 'Admin-only replacement of explicit accounting allocations for an approved canonical document.';

-- Human review gate for OCR/accounting intake.
-- Approval here confirms the reviewed intake proposal only; it does not post
-- journals, reconcile cash, approve payments, or create canonical accounting entries.

create table if not exists public.accounting_intake_reviews (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.accounting_document_intake(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','rejected','returned')),
  corrected_fields jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists accounting_intake_reviews_intake_created_idx
  on public.accounting_intake_reviews(intake_id, created_at desc);

alter table public.accounting_intake_reviews enable row level security;

create policy accounting_intake_reviews_read
on public.accounting_intake_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.accounting_document_intake i
    where i.id = accounting_intake_reviews.intake_id
      and (
        i.proposed_legal_entity_id is null
        or public.can_access_legal_entity(i.proposed_legal_entity_id, 'read')
      )
  )
);

revoke all on public.accounting_intake_reviews from anon;
grant select on public.accounting_intake_reviews to authenticated;

create or replace function public.review_accounting_intake(
  p_intake_id uuid,
  p_decision text,
  p_corrected_fields jsonb default '{}'::jsonb,
  p_notes text default null
)
returns public.accounting_document_intake
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_intake public.accounting_document_intake%rowtype;
  v_entity uuid;
  v_status text;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if v_role not in ('admin','approver') then
    raise exception 'accounting review permission required';
  end if;

  if p_decision not in ('approved','rejected','returned') then
    raise exception 'invalid review decision';
  end if;

  select * into v_intake
  from public.accounting_document_intake
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'accounting intake not found';
  end if;

  v_entity := coalesce(
    nullif(p_corrected_fields->>'proposed_legal_entity_id','')::uuid,
    v_intake.proposed_legal_entity_id
  );

  if v_entity is not null and not public.can_access_legal_entity(v_entity, 'write') then
    raise exception 'legal entity write access required';
  end if;

  -- Store the human correction as an immutable review record first.
  insert into public.accounting_intake_reviews(
    intake_id, reviewer_user_id, decision, corrected_fields, notes
  ) values (
    p_intake_id, v_user, p_decision, coalesce(p_corrected_fields, '{}'::jsonb), p_notes
  );

  -- Human corrections replace only proposal fields. Posting remains a later step.
  update public.accounting_document_intake
  set
    proposed_document_type = coalesce(p_corrected_fields->>'proposed_document_type', proposed_document_type),
    proposed_legal_entity_id = coalesce(nullif(p_corrected_fields->>'proposed_legal_entity_id','')::uuid, proposed_legal_entity_id),
    proposed_counterparty_id = coalesce(nullif(p_corrected_fields->>'proposed_counterparty_id','')::uuid, proposed_counterparty_id),
    proposed_document_number = coalesce(p_corrected_fields->>'proposed_document_number', proposed_document_number),
    proposed_document_date = coalesce(nullif(p_corrected_fields->>'proposed_document_date','')::date, proposed_document_date),
    proposed_due_date = coalesce(nullif(p_corrected_fields->>'proposed_due_date','')::date, proposed_due_date),
    proposed_currency = coalesce(p_corrected_fields->>'proposed_currency', proposed_currency),
    proposed_net_amount = coalesce(nullif(p_corrected_fields->>'proposed_net_amount','')::numeric, proposed_net_amount),
    proposed_tax_amount = coalesce(nullif(p_corrected_fields->>'proposed_tax_amount','')::numeric, proposed_tax_amount),
    proposed_total_amount = coalesce(nullif(p_corrected_fields->>'proposed_total_amount','')::numeric, proposed_total_amount),
    proposed_direction = coalesce(p_corrected_fields->>'proposed_direction', proposed_direction),
    proposed_department_id = coalesce(nullif(p_corrected_fields->>'proposed_department_id','')::uuid, proposed_department_id),
    proposed_cost_center_id = coalesce(nullif(p_corrected_fields->>'proposed_cost_center_id','')::uuid, proposed_cost_center_id),
    proposed_account_code = coalesce(p_corrected_fields->>'proposed_account_code', proposed_account_code),
    status = case p_decision
      when 'approved' then 'approved'
      when 'rejected' then 'rejected'
      else 'review'
    end,
    requires_review = (p_decision <> 'approved')
  where id = p_intake_id
  returning * into v_intake;

  return v_intake;
end;
$function$;

revoke all on function public.review_accounting_intake(uuid,text,jsonb,text) from public;
revoke all on function public.review_accounting_intake(uuid,text,jsonb,text) from anon;
grant execute on function public.review_accounting_intake(uuid,text,jsonb,text) to authenticated;

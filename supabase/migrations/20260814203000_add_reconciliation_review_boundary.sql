-- Black Swan OS: explicit human reconciliation approval boundary.
-- Reconciliation proposals never become canonical matches without an admin review.

create or replace function public.review_reconciliation_match(
  p_match_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_match public.accounting_reconciliation_matches%rowtype;
  v_cash public.cash_transactions%rowtype;
  v_document public.accounting_documents%rowtype;
  v_cash_approved numeric := 0;
  v_document_approved numeric := 0;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'RECONCILIATION_REVIEW_FORBIDDEN';
  end if;

  if p_decision not in ('approved','rejected') then
    raise exception 'INVALID_RECONCILIATION_DECISION';
  end if;

  select * into v_match
  from public.accounting_reconciliation_matches
  where id = p_match_id
  for update;

  if not found then raise exception 'RECONCILIATION_MATCH_NOT_FOUND'; end if;
  if v_match.status <> 'proposed' then raise exception 'RECONCILIATION_ALREADY_REVIEWED'; end if;

  select * into v_cash from public.cash_transactions where id = v_match.cash_transaction_id;
  select * into v_document from public.accounting_documents where id = v_match.accounting_document_id;

  if v_cash.id is null or v_document.id is null then
    raise exception 'RECONCILIATION_SOURCE_NOT_FOUND';
  end if;
  if v_cash.legal_entity_id <> v_match.legal_entity_id
     or v_document.legal_entity_id <> v_match.legal_entity_id then
    raise exception 'RECONCILIATION_ENTITY_MISMATCH';
  end if;

  if p_decision = 'approved' then
    select coalesce(sum(matched_amount),0) into v_cash_approved
    from public.accounting_reconciliation_matches
    where cash_transaction_id = v_cash.id and status = 'approved';

    if v_cash_approved + v_match.matched_amount > v_cash.amount then
      raise exception 'RECONCILIATION_EXCEEDS_CASH_AMOUNT';
    end if;

    select coalesce(sum(matched_amount),0) into v_document_approved
    from public.accounting_reconciliation_matches
    where accounting_document_id = v_document.id and status = 'approved';

    if v_document_approved + v_match.matched_amount > v_document.total_amount then
      raise exception 'RECONCILIATION_EXCEEDS_DOCUMENT_AMOUNT';
    end if;
  end if;

  update public.accounting_reconciliation_matches
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      notes = case
        when nullif(btrim(coalesce(p_notes,'')),'') is null then notes
        else concat_ws(E'\n', notes, p_notes)
      end
  where id = p_match_id;

  select coalesce(sum(matched_amount),0) into v_cash_approved
  from public.accounting_reconciliation_matches
  where cash_transaction_id = v_cash.id and status = 'approved';

  update public.cash_transactions
  set reconciliation_status = case
        when v_cash_approved = 0 then 'unmatched'
        when v_cash_approved < amount then 'partial'
        when v_cash_approved = amount then 'matched'
        else 'exception'
      end,
      updated_at = now()
  where id = v_cash.id;

  return jsonb_build_object(
    'match_id', p_match_id,
    'decision', p_decision,
    'cash_transaction_id', v_cash.id,
    'approved_amount', v_cash_approved,
    'cash_amount', v_cash.amount,
    'reconciliation_status', (
      select reconciliation_status from public.cash_transactions where id = v_cash.id
    )
  );
end;
$function$;

revoke all on function public.review_reconciliation_match(uuid,text,text) from public;
grant execute on function public.review_reconciliation_match(uuid,text,text) to authenticated;

comment on function public.review_reconciliation_match(uuid,text,text) is
  'Human review boundary for bank/document reconciliation. Enforces legal-entity integrity and prevents approved matches from exceeding cash or document totals.';

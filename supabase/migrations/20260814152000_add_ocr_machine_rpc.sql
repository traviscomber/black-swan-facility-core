-- Black Swan OS: restricted machine identity for OCR proposal processing.
--
-- This migration is additive and intentionally does not grant any machine ability
-- to approve/post accounting documents, reconcile cash, approve payments, or
-- modify permissions. Machine tokens are stored only as SHA-256 hashes.

create table if not exists public.machine_principals (
  id uuid primary key default gen_random_uuid(),
  principal_key text not null unique,
  display_name text not null,
  token_hash bytea not null unique,
  scopes text[] not null default '{}'::text[],
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machine_principal_scopes_nonempty check (array_length(scopes, 1) is not null)
);

alter table public.machine_principals enable row level security;

create policy machine_principals_admin_select
  on public.machine_principals for select to authenticated
  using (public.current_app_role() = 'admin');

create policy machine_principals_admin_write
  on public.machine_principals for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

alter table public.accounting_document_intake
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists processing_last_attempt_at timestamptz,
  add column if not exists processing_error_code text,
  add column if not exists processing_error_message text;

alter table public.accounting_document_intake
  drop constraint if exists accounting_intake_status_check;

alter table public.accounting_document_intake
  add constraint accounting_intake_status_check check (
    status in ('received','extracting','classified','review','approved','rejected','posted','failed')
  );

create or replace function public.require_machine_scope(p_scope text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_token text;
  v_principal_id uuid;
begin
  v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  v_token := nullif(v_headers ->> 'x-black-swan-machine-token', '');

  if v_token is null then
    raise exception 'machine token required' using errcode = '28000';
  end if;

  select mp.id
    into v_principal_id
  from public.machine_principals mp
  where mp.is_active = true
    and digest(v_token, 'sha256') = mp.token_hash
    and p_scope = any(mp.scopes)
  limit 1;

  if v_principal_id is null then
    raise exception 'machine scope denied' using errcode = '42501';
  end if;

  update public.machine_principals
     set last_used_at = now(), updated_at = now()
   where id = v_principal_id;

  return v_principal_id;
end;
$$;

revoke all on function public.require_machine_scope(text) from public, anon, authenticated;

create or replace function public.ocr_claim_intake(
  p_intake_id uuid,
  p_model_provider text,
  p_model_name text,
  p_model_run_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_principal_id uuid;
  v_row public.accounting_document_intake%rowtype;
begin
  v_principal_id := public.require_machine_scope('ocr:write');

  update public.accounting_document_intake
     set status = 'extracting',
         processing_attempts = processing_attempts + 1,
         processing_last_attempt_at = now(),
         processing_error_code = null,
         processing_error_message = null,
         model_provider = p_model_provider,
         model_name = p_model_name,
         model_run_id = p_model_run_id,
         updated_at = now()
   where id = p_intake_id
     and status in ('received','extracting','failed')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'intake not claimable' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'source_storage_path', v_row.source_storage_path,
    'source_file_name', v_row.source_file_name,
    'processing_attempts', v_row.processing_attempts,
    'machine_principal_id', v_principal_id
  );
end;
$$;

revoke all on function public.ocr_claim_intake(uuid,text,text,text) from public, authenticated;
grant execute on function public.ocr_claim_intake(uuid,text,text,text) to anon;

create or replace function public.ocr_write_proposal(
  p_intake_id uuid,
  p_raw_ocr_text text,
  p_raw_extraction jsonb,
  p_proposed_document_type text,
  p_proposed_legal_entity_id uuid,
  p_proposed_counterparty_id uuid,
  p_proposed_document_number text,
  p_proposed_document_date date,
  p_proposed_due_date date,
  p_proposed_currency text,
  p_proposed_net_amount numeric,
  p_proposed_tax_amount numeric,
  p_proposed_total_amount numeric,
  p_proposed_direction text,
  p_proposed_department_id uuid,
  p_proposed_cost_center_id uuid,
  p_proposed_account_code text,
  p_confidence numeric,
  p_model_provider text,
  p_model_name text,
  p_model_run_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_principal_id uuid;
  v_row public.accounting_document_intake%rowtype;
begin
  v_principal_id := public.require_machine_scope('ocr:write');

  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then
    raise exception 'invalid confidence' using errcode = '22023';
  end if;

  update public.accounting_document_intake
     set raw_ocr_text = p_raw_ocr_text,
         raw_extraction = coalesce(p_raw_extraction, '{}'::jsonb),
         proposed_document_type = p_proposed_document_type,
         proposed_legal_entity_id = p_proposed_legal_entity_id,
         proposed_counterparty_id = p_proposed_counterparty_id,
         proposed_document_number = p_proposed_document_number,
         proposed_document_date = p_proposed_document_date,
         proposed_due_date = p_proposed_due_date,
         proposed_currency = p_proposed_currency,
         proposed_net_amount = p_proposed_net_amount,
         proposed_tax_amount = p_proposed_tax_amount,
         proposed_total_amount = p_proposed_total_amount,
         proposed_direction = p_proposed_direction,
         proposed_department_id = p_proposed_department_id,
         proposed_cost_center_id = p_proposed_cost_center_id,
         proposed_account_code = p_proposed_account_code,
         confidence = p_confidence,
         model_provider = p_model_provider,
         model_name = p_model_name,
         model_run_id = p_model_run_id,
         status = 'classified',
         requires_review = true,
         processing_error_code = null,
         processing_error_message = null,
         updated_at = now()
   where id = p_intake_id
     and status = 'extracting'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'intake not writable' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'requires_review', v_row.requires_review,
    'confidence', v_row.confidence,
    'machine_principal_id', v_principal_id
  );
end;
$$;

revoke all on function public.ocr_write_proposal(uuid,text,jsonb,text,uuid,uuid,text,date,date,text,numeric,numeric,numeric,text,uuid,uuid,text,numeric,text,text,text) from public, authenticated;
grant execute on function public.ocr_write_proposal(uuid,text,jsonb,text,uuid,uuid,text,date,date,text,numeric,numeric,numeric,text,uuid,uuid,text,numeric,text,text,text) to anon;

create or replace function public.ocr_mark_failed(
  p_intake_id uuid,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_machine_scope('ocr:write');

  update public.accounting_document_intake
     set status = 'failed',
         requires_review = true,
         processing_error_code = left(coalesce(p_error_code, 'ocr_failed'), 120),
         processing_error_message = left(coalesce(p_error_message, 'OCR processing failed'), 1000),
         updated_at = now()
   where id = p_intake_id
     and status in ('received','extracting','failed');
end;
$$;

revoke all on function public.ocr_mark_failed(uuid,text,text) from public, authenticated;
grant execute on function public.ocr_mark_failed(uuid,text,text) to anon;

comment on table public.machine_principals is 'Restricted machine identities. Only token hashes are stored; scopes are explicit and narrow.';
comment on function public.ocr_claim_intake(uuid,text,text,text) is 'Machine-only claim step for OCR processing. Cannot approve or post accounting records.';
comment on function public.ocr_write_proposal(uuid,text,jsonb,text,uuid,uuid,text,date,date,text,numeric,numeric,numeric,text,uuid,uuid,text,numeric,text,text,text) is 'Machine-only OCR proposal writer. All output remains requires_review=true.';
comment on function public.ocr_mark_failed(uuid,text,text) is 'Machine-only OCR failure marker. Does not alter canonical accounting state.';

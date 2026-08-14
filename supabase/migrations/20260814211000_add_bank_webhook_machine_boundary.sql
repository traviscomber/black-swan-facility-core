-- Black Swan OS: restricted machine boundary for external financial-provider webhooks.
-- A webhook machine can append verified provider events only. It cannot create
-- journals, approve reconciliation, approve payments, or alter access control.

create table if not exists public.bank_webhook_machine_tokens (
  id uuid primary key default gen_random_uuid(),
  token_name text not null unique,
  token_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  rotated_at timestamptz
);

alter table public.bank_webhook_machine_tokens enable row level security;

create or replace function public.record_verified_bank_provider_event(
  p_machine_token text,
  p_bank_connection_id uuid,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_entity_id uuid;
  v_provider_key text;
  v_event_id uuid;
  v_existing boolean := false;
begin
  if p_machine_token is null or length(p_machine_token) < 32 then
    raise exception 'BANK_MACHINE_UNAUTHORIZED';
  end if;

  if not exists (
    select 1 from public.bank_webhook_machine_tokens t
    where t.token_hash = encode(digest(p_machine_token, 'sha256'), 'hex')
      and t.is_active
      and (t.expires_at is null or t.expires_at > now())
  ) then
    raise exception 'BANK_MACHINE_UNAUTHORIZED';
  end if;

  select legal_entity_id, provider_key into v_entity_id, v_provider_key
  from public.bank_connections
  where id = p_bank_connection_id
    and connection_status <> 'disabled';

  if v_entity_id is null then raise exception 'BANK_CONNECTION_NOT_FOUND'; end if;

  select id into v_event_id
  from public.bank_ingestion_events
  where legal_entity_id = v_entity_id
    and provider_event_id = p_provider_event_id;

  if v_event_id is not null then
    v_existing := true;
  else
    insert into public.bank_ingestion_events(
      legal_entity_id, bank_connection_id, provider_event_id, event_type,
      payload_hash, raw_payload, status
    ) values (
      v_entity_id, p_bank_connection_id, p_provider_event_id,
      concat(v_provider_key, ':', p_event_type), p_payload_hash,
      coalesce(p_raw_payload, '{}'::jsonb), 'received'
    ) returning id into v_event_id;

    update public.bank_connections
    set last_webhook_at = now(), webhook_status = 'active', updated_at = now()
    where id = p_bank_connection_id;
  end if;

  return jsonb_build_object(
    'event_id', v_event_id,
    'duplicate', v_existing,
    'provider_key', v_provider_key,
    'legal_entity_id', v_entity_id
  );
end;
$function$;

revoke all on function public.record_verified_bank_provider_event(text,uuid,text,text,text,jsonb) from public;
grant execute on function public.record_verified_bank_provider_event(text,uuid,text,text,text,jsonb) to anon;
grant execute on function public.record_verified_bank_provider_event(text,uuid,text,text,text,jsonb) to authenticated;

comment on function public.record_verified_bank_provider_event(text,uuid,text,text,text,jsonb) is 'Restricted webhook append boundary. Machine token is SHA-256 checked; function only appends idempotent provider events.';

-- TUU / Haulmer Remote Payment v2 integration for the existing Black Swan POS terminal.
-- Provider credentials and device serial remain in Cloudflare secrets, never Postgres.
-- This boundary records idempotent payment requests and provider status only.

create table if not exists public.tuu_remote_payment_requests (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  event_id uuid references public.operational_events(id) on delete set null,
  portal_id uuid references public.event_guest_portals(id) on delete set null,
  registration_id uuid references public.event_portal_registrations(id) on delete set null,
  idempotency_key uuid not null unique default gen_random_uuid(),
  amount_clp integer not null,
  dte_type integer not null default 0,
  payment_method integer,
  description text,
  provider_status text not null default 'created',
  provider_status_code integer,
  provider_request_id text,
  sequence_number text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  last_polled_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tuu_remote_amount_check check (amount_clp between 100 and 99999999),
  constraint tuu_remote_dte_check check (dte_type in (0,33,48,99)),
  constraint tuu_remote_method_check check (payment_method is null or payment_method in (1,2)),
  constraint tuu_remote_status_check check (provider_status in ('created','pending','sent','cancelled','processing','failed','completed'))
);

create index if not exists tuu_remote_payment_registration_idx
  on public.tuu_remote_payment_requests(registration_id, created_at desc);
create index if not exists tuu_remote_payment_status_idx
  on public.tuu_remote_payment_requests(provider_status, updated_at desc);

alter table public.tuu_remote_payment_requests enable row level security;

create policy tuu_remote_payment_admin_view
  on public.tuu_remote_payment_requests for select to authenticated
  using (public.current_app_role() in ('admin','approver'));

create or replace function public.prepare_tuu_remote_payment(
  p_registration_id uuid,
  p_amount_clp integer,
  p_dte_type integer default 0,
  p_payment_method integer default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_registration public.event_portal_registrations%rowtype;
  v_portal public.event_guest_portals%rowtype;
  v_event public.operational_events%rowtype;
  v_corp uuid;
  v_request public.tuu_remote_payment_requests%rowtype;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if p_amount_clp < 100 or p_amount_clp > 99999999 then raise exception 'TUU amount must be between 100 and 99999999 CLP'; end if;
  if p_dte_type not in (0,33,48,99) then raise exception 'Unsupported TUU DTE type'; end if;
  if p_payment_method is not null and p_payment_method not in (1,2) then raise exception 'Unsupported TUU payment method'; end if;

  select * into v_registration from public.event_portal_registrations where id=p_registration_id;
  if not found then raise exception 'Registration not found'; end if;
  if v_registration.registration_status not in ('confirmed','checked_in','completed') then raise exception 'Registration is not payable in current state'; end if;

  select * into v_portal from public.event_guest_portals where id=v_registration.portal_id;
  select * into v_event from public.operational_events where id=v_portal.event_id;
  select id into v_corp from public.legal_entities where code='BS_CORPORACION';
  if v_corp is null then raise exception 'Corporacion legal entity not configured'; end if;

  insert into public.tuu_remote_payment_requests(
    legal_entity_id,event_id,portal_id,registration_id,amount_clp,dte_type,payment_method,description,requested_by
  ) values (
    v_corp,v_event.id,v_portal.id,v_registration.id,p_amount_clp,p_dte_type,p_payment_method,
    coalesce(nullif(trim(coalesce(p_description,'')),''),'Event participation - '||v_event.name),auth.uid()
  ) returning * into v_request;

  return jsonb_build_object(
    'request_id',v_request.id,
    'idempotency_key',v_request.idempotency_key,
    'amount_clp',v_request.amount_clp,
    'dte_type',v_request.dte_type,
    'payment_method',v_request.payment_method,
    'description',v_request.description,
    'event_name',v_event.name,
    'guest_name',v_registration.full_name,
    'guest_email',v_registration.email
  );
end;
$function$;

revoke all on function public.prepare_tuu_remote_payment(uuid,integer,integer,integer,text) from public;
grant execute on function public.prepare_tuu_remote_payment(uuid,integer,integer,integer,text) to authenticated;

create or replace function public.record_tuu_remote_payment_result(
  p_request_id uuid,
  p_provider_status text,
  p_provider_status_code integer default null,
  p_provider_request_id text default null,
  p_sequence_number text default null,
  p_provider_payload jsonb default '{}'::jsonb,
  p_last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_result public.tuu_remote_payment_requests%rowtype;
begin
  if auth.uid() is null or v_role not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  if p_provider_status not in ('created','pending','sent','cancelled','processing','failed','completed') then raise exception 'Invalid TUU status'; end if;

  update public.tuu_remote_payment_requests
  set provider_status=p_provider_status,
      provider_status_code=p_provider_status_code,
      provider_request_id=coalesce(nullif(p_provider_request_id,''),provider_request_id),
      sequence_number=coalesce(nullif(p_sequence_number,''),sequence_number),
      provider_payload=coalesce(p_provider_payload,'{}'::jsonb),
      last_error=nullif(p_last_error,''),
      last_polled_at=now(),
      completed_at=case when p_provider_status='completed' then coalesce(completed_at,now()) else completed_at end,
      updated_at=now()
  where id=p_request_id
  returning * into v_result;

  if not found then raise exception 'TUU payment request not found'; end if;

  if v_result.registration_id is not null and p_provider_status='completed' then
    update public.event_portal_registrations
    set payment_status='paid',updated_at=now()
    where id=v_result.registration_id and payment_status <> 'paid';
  elsif v_result.registration_id is not null and p_provider_status='failed' then
    update public.event_portal_registrations
    set payment_status='failed',updated_at=now()
    where id=v_result.registration_id and payment_status not in ('paid','refunded');
  end if;

  return to_jsonb(v_result);
end;
$function$;

revoke all on function public.record_tuu_remote_payment_result(uuid,text,integer,text,text,jsonb,text) from public;
grant execute on function public.record_tuu_remote_payment_result(uuid,text,integer,text,text,jsonb,text) to authenticated;

create or replace function public.get_tuu_remote_payment(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or public.current_app_role() not in ('admin','approver') then raise exception 'Insufficient permissions'; end if;
  select to_jsonb(r) into v_result from public.tuu_remote_payment_requests r where r.id=p_request_id;
  if v_result is null then raise exception 'TUU payment request not found'; end if;
  return v_result;
end;
$function$;

revoke all on function public.get_tuu_remote_payment(uuid) from public;
grant execute on function public.get_tuu_remote_payment(uuid) to authenticated;

comment on table public.tuu_remote_payment_requests is 'Idempotent TUU/Haulmer Remote Payment v2 requests sent to the physical Black Swan POS. Secrets and device serial live only in Cloudflare.';

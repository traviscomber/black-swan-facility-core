-- Narrow machine boundary for event notification delivery.
-- Cloudflare holds the raw worker secret and provider credentials. Postgres stores only a SHA-256 hash.

create table if not exists public.notification_delivery_machine_config (
  id boolean primary key default true,
  token_sha256 text not null,
  max_attempts integer not null default 5,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint notification_delivery_machine_singleton check (id = true),
  constraint notification_delivery_max_attempts_check check (max_attempts between 1 and 20)
);

alter table public.notification_delivery_machine_config enable row level security;

create or replace function public.configure_notification_delivery_machine(
  p_machine_token text,
  p_max_attempts integer default 5
)
returns void
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then
    raise exception 'Administrator role required';
  end if;
  if length(coalesce(p_machine_token,'')) < 32 then
    raise exception 'Machine token must be at least 32 characters';
  end if;

  insert into public.notification_delivery_machine_config(id,token_sha256,max_attempts,updated_at,updated_by)
  values(true,encode(extensions.digest(p_machine_token,'sha256'),'hex'),greatest(1,least(coalesce(p_max_attempts,5),20)),now(),auth.uid())
  on conflict(id) do update set
    token_sha256=excluded.token_sha256,
    max_attempts=excluded.max_attempts,
    updated_at=now(),
    updated_by=auth.uid();
end;
$function$;

revoke all on function public.configure_notification_delivery_machine(text,integer) from public;
grant execute on function public.configure_notification_delivery_machine(text,integer) to authenticated;

create or replace function public.notification_machine_authorized(p_machine_token text)
returns boolean
language sql
stable
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
  select exists (
    select 1
    from public.notification_delivery_machine_config c
    where c.id=true
      and c.token_sha256=encode(extensions.digest(coalesce(p_machine_token,''),'sha256'),'hex')
  );
$function$;

revoke all on function public.notification_machine_authorized(text) from public;

create or replace function public.claim_event_notifications(
  p_machine_token text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_limit integer := greatest(1,least(coalesce(p_limit,10),50));
  v_max_attempts integer;
  v_result jsonb;
begin
  if not public.notification_machine_authorized(p_machine_token) then
    raise exception 'NOTIFICATION_MACHINE_FORBIDDEN';
  end if;

  select max_attempts into v_max_attempts
  from public.notification_delivery_machine_config
  where id=true;

  with candidates as (
    select o.id
    from public.event_notification_outbox o
    where (
      (o.status in ('pending','failed') and o.available_at <= now())
      or (o.status='processing' and o.updated_at < now()-interval '15 minutes')
    )
      and o.attempts < coalesce(v_max_attempts,5)
      and o.recipient_email is not null
      -- Invite links contain an ephemeral secret that is never stored in Postgres.
      -- Keep invite-issued rows queued until a separate ephemeral delivery-link mechanism is added.
      and o.notification_type <> 'invite_issued'
    order by o.available_at asc, o.created_at asc
    for update skip locked
    limit v_limit
  ), claimed as (
    update public.event_notification_outbox o
    set status='processing',attempts=o.attempts+1,updated_at=now(),last_error=null
    from candidates c
    where o.id=c.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'event_id',c.event_id,
    'portal_id',c.portal_id,
    'registration_id',c.registration_id,
    'invite_id',c.invite_id,
    'notification_type',c.notification_type,
    'recipient_email',c.recipient_email,
    'recipient_phone',c.recipient_phone,
    'payload',c.payload,
    'attempts',c.attempts,
    'event',jsonb_build_object(
      'name',e.name,
      'start_date',e.start_date,
      'end_date',e.end_date,
      'location_name',e.location_name
    ),
    'portal',case when p.id is null then null else jsonb_build_object(
      'slug',p.slug,
      'headline',p.headline,
      'status',p.status
    ) end
  ) order by c.available_at,c.created_at),'[]'::jsonb)
  into v_result
  from claimed c
  join public.operational_events e on e.id=c.event_id
  left join public.event_guest_portals p on p.id=c.portal_id;

  return coalesce(v_result,'[]'::jsonb);
end;
$function$;

revoke all on function public.claim_event_notifications(text,integer) from public;
grant execute on function public.claim_event_notifications(text,integer) to anon;
grant execute on function public.claim_event_notifications(text,integer) to authenticated;

create or replace function public.complete_event_notification_delivery(
  p_machine_token text,
  p_notification_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_attempts integer;
  v_max_attempts integer;
begin
  if not public.notification_machine_authorized(p_machine_token) then
    raise exception 'NOTIFICATION_MACHINE_FORBIDDEN';
  end if;

  select attempts into v_attempts
  from public.event_notification_outbox
  where id=p_notification_id
  for update;
  if not found then raise exception 'Notification not found'; end if;

  select max_attempts into v_max_attempts
  from public.notification_delivery_machine_config where id=true;

  if p_success then
    update public.event_notification_outbox
    set status='sent',sent_at=now(),last_error=null,updated_at=now(),
        payload=payload || case when nullif(trim(coalesce(p_provider_message_id,'')),'') is null then '{}'::jsonb else jsonb_build_object('provider_message_id',p_provider_message_id) end
    where id=p_notification_id and status='processing';
  else
    update public.event_notification_outbox
    set status='failed',
        last_error=left(coalesce(p_error,'delivery_failed'),1000),
        available_at=case when v_attempts >= coalesce(v_max_attempts,5) then now()+interval '365 days'
                          else now() + make_interval(mins => least(v_attempts*5,60)) end,
        updated_at=now()
    where id=p_notification_id and status='processing';
  end if;
end;
$function$;

revoke all on function public.complete_event_notification_delivery(text,uuid,boolean,text,text) from public;
grant execute on function public.complete_event_notification_delivery(text,uuid,boolean,text,text) to anon;
grant execute on function public.complete_event_notification_delivery(text,uuid,boolean,text,text) to authenticated;

comment on table public.notification_delivery_machine_config is 'Singleton hash-only credential configuration for the Cloudflare notification delivery worker.';

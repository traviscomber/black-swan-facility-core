-- Guest portal passcodes are optional because invite_token is the preferred mode.
-- When passcodes are used, require enough entropy before storing the bcrypt hash.

create or replace function public.upsert_event_guest_portal(
  p_event_id uuid,
  p_slug text,
  p_access_mode text default 'invite_token'::text,
  p_passcode text default null::text,
  p_headline text default null::text,
  p_black_swan_intro text default null::text,
  p_event_description text default null::text,
  p_program jsonb default '[]'::jsonb,
  p_practical_info jsonb default '{}'::jsonb,
  p_capacity integer default null::integer,
  p_allow_companions boolean default false,
  p_max_companions integer default 0,
  p_commercial_model text default 'free'::text,
  p_ticket_price numeric default null::numeric,
  p_currency text default 'CLP'::text,
  p_collecting_legal_entity_id uuid default null::uuid,
  p_payment_provider text default null::text,
  p_status text default 'draft'::text
)
returns public.event_guest_portals
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_result public.event_guest_portals%rowtype;
  v_passcode_hash text;
  v_passcode text := trim(coalesce(p_passcode, ''));
begin
  if auth.uid() is null or v_role <> 'admin' then
    raise exception 'Administrator role required';
  end if;

  if not exists(select 1 from public.operational_events where id = p_event_id) then
    raise exception 'Event not found';
  end if;

  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Slug must be lowercase kebab-case';
  end if;

  if p_access_mode not in ('invite_token', 'passcode', 'invite_or_passcode') then
    raise exception 'Invalid access mode';
  end if;

  if p_access_mode <> 'invite_token'
     and v_passcode = ''
     and not exists(
       select 1
       from public.event_guest_portals
       where event_id = p_event_id
         and passcode_hash is not null
     ) then
    raise exception 'Passcode required for selected access mode';
  end if;

  if v_passcode <> '' then
    if length(v_passcode) < 16
       or v_passcode !~ '[A-Za-z]'
       or v_passcode !~ '[0-9]' then
      raise exception 'Passcode must be at least 16 characters and include letters and numbers';
    end if;
    v_passcode_hash := extensions.crypt(v_passcode, extensions.gen_salt('bf'));
  end if;

  insert into public.event_guest_portals(
    event_id, slug, status, access_mode, passcode_hash, headline,
    black_swan_intro, event_description, program, practical_info,
    capacity, allow_companions, max_companions, commercial_model,
    ticket_price, currency, collecting_legal_entity_id, payment_provider,
    created_by
  )
  values(
    p_event_id, p_slug, p_status, p_access_mode, v_passcode_hash, p_headline,
    p_black_swan_intro, p_event_description, coalesce(p_program, '[]'::jsonb),
    coalesce(p_practical_info, '{}'::jsonb), p_capacity, p_allow_companions,
    p_max_companions, p_commercial_model, p_ticket_price,
    upper(coalesce(p_currency, 'CLP')), p_collecting_legal_entity_id,
    p_payment_provider, auth.uid()
  )
  on conflict(event_id) do update set
    slug = excluded.slug,
    status = excluded.status,
    access_mode = excluded.access_mode,
    passcode_hash = coalesce(excluded.passcode_hash, event_guest_portals.passcode_hash),
    headline = excluded.headline,
    black_swan_intro = excluded.black_swan_intro,
    event_description = excluded.event_description,
    program = excluded.program,
    practical_info = excluded.practical_info,
    capacity = excluded.capacity,
    allow_companions = excluded.allow_companions,
    max_companions = excluded.max_companions,
    commercial_model = excluded.commercial_model,
    ticket_price = excluded.ticket_price,
    currency = excluded.currency,
    collecting_legal_entity_id = excluded.collecting_legal_entity_id,
    payment_provider = excluded.payment_provider,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.upsert_event_guest_portal(
  uuid, text, text, text, text, text, text, jsonb, jsonb, integer,
  boolean, integer, text, numeric, text, uuid, text, text
) from public, anon;

grant execute on function public.upsert_event_guest_portal(
  uuid, text, text, text, text, text, text, jsonb, jsonb, integer,
  boolean, integer, text, numeric, text, uuid, text, text
) to authenticated, service_role;

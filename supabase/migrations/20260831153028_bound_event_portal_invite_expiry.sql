-- Event portal bearer invitations must always expire with the event lifecycle.
-- Tokens remain 192-bit random values stored only as SHA-256 hashes.

create or replace function public.issue_event_portal_invite(
  p_portal_id uuid,
  p_inviting_member_id uuid default null::uuid,
  p_invitee_name text default null::text,
  p_invitee_email text default null::text,
  p_expires_at timestamp with time zone default null::timestamp with time zone,
  p_max_uses integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_invite_id uuid;
  v_default_expiry timestamptz;
  v_effective_expiry timestamptz;
begin
  if auth.uid() is null or v_role not in ('admin', 'approver') then
    raise exception 'Insufficient permissions';
  end if;

  select coalesce(
           p.registration_closes_at,
           ((e.end_date + 1)::timestamp at time zone 'America/Santiago')
         )
    into v_default_expiry
  from public.event_guest_portals p
  join public.operational_events e on e.id = p.event_id
  where p.id = p_portal_id;

  if not found then
    raise exception 'Portal not found';
  end if;

  v_effective_expiry := coalesce(p_expires_at, v_default_expiry);

  if v_effective_expiry <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  if v_effective_expiry > v_default_expiry then
    raise exception 'Invitation cannot outlive the portal registration window or event';
  end if;

  if p_inviting_member_id is not null
     and not exists(
       select 1 from public.members
       where id = p_inviting_member_id and status = 'active'
     ) then
    raise exception 'Active member not found';
  end if;

  insert into public.event_portal_invites(
    portal_id, inviting_member_id, invitee_name, invitee_email,
    token_hash, expires_at, max_uses, created_by
  )
  values(
    p_portal_id,
    p_inviting_member_id,
    nullif(trim(coalesce(p_invitee_name, '')), ''),
    nullif(lower(trim(coalesce(p_invitee_email, ''))), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_effective_expiry,
    greatest(coalesce(p_max_uses, 1), 1),
    auth.uid()
  )
  returning id into v_invite_id;

  return jsonb_build_object(
    'invite_id', v_invite_id,
    'token', v_token,
    'expires_at', v_effective_expiry
  );
end;
$function$;

revoke all on function public.issue_event_portal_invite(
  uuid, uuid, text, text, timestamp with time zone, integer
) from public, anon;

grant execute on function public.issue_event_portal_invite(
  uuid, uuid, text, text, timestamp with time zone, integer
) to authenticated, service_role;

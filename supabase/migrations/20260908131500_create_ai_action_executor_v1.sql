-- Black Swan AI authorized executor v1
-- Scope: one internal, reversible-by-operator capability only: task.create_internal.
-- External, financial and physical side effects remain unsupported.

create table if not exists public.ai_action_proposals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  capability text not null,
  payload jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'awaiting_confirmation',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  claimed_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_action_proposals_capability_check check (capability in ('task.create_internal')),
  constraint ai_action_proposals_status_check check (
    status in ('awaiting_confirmation','executing','succeeded','failed','rejected','expired')
  ),
  constraint ai_action_proposals_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint ai_action_proposals_context_object_check check (jsonb_typeof(context) = 'object')
);

create index if not exists ai_action_proposals_owner_created_idx
  on public.ai_action_proposals(created_by, created_at desc);
create index if not exists ai_action_proposals_pending_expiry_idx
  on public.ai_action_proposals(expires_at)
  where status = 'awaiting_confirmation';

alter table public.ai_action_proposals enable row level security;

revoke all on table public.ai_action_proposals from anon, authenticated;
grant select on table public.ai_action_proposals to authenticated;

drop policy if exists ai_action_proposals_owner_select on public.ai_action_proposals;
create policy ai_action_proposals_owner_select
  on public.ai_action_proposals
  for select
  to authenticated
  using (created_by = auth.uid());

create or replace function public.create_ai_task_proposal(
  p_title text,
  p_description text default null,
  p_operational_area text default null,
  p_location_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns public.ai_action_proposals
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_title text := nullif(btrim(p_title), '');
  v_description text := nullif(btrim(p_description), '');
  v_operational_area text := nullif(btrim(p_operational_area), '');
  v_proposal public.ai_action_proposals;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'unauthorized';
  end if;

  if not exists (
    select 1
    from public.ai_agentic_access a
    where a.user_id = v_user_id and a.enabled = true
  ) then
    raise exception using errcode = '42501', message = 'agentic_access_denied';
  end if;

  if v_title is null then
    raise exception using errcode = '22023', message = 'task_title_required';
  end if;
  if length(v_title) > 160 then
    raise exception using errcode = '22023', message = 'task_title_too_long';
  end if;
  if v_description is not null and length(v_description) > 4000 then
    raise exception using errcode = '22023', message = 'task_description_too_long';
  end if;
  if p_context is null or jsonb_typeof(p_context) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_context';
  end if;

  -- This mirrors the canonical tasks RLS/trigger rule before a proposal can exist.
  if not public.can_access_operational_task_scope(v_operational_area, p_location_id) then
    raise exception using errcode = '42501', message = 'task_scope_denied';
  end if;

  insert into public.ai_action_proposals(created_by, capability, payload, context)
  values (
    v_user_id,
    'task.create_internal',
    jsonb_strip_nulls(jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'operational_area', v_operational_area,
      'location_id', p_location_id
    )),
    p_context
  )
  returning * into v_proposal;

  return v_proposal;
end;
$function$;

create or replace function public.execute_ai_action_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.ai_action_proposals;
  v_task public.tasks;
  v_title text;
  v_description text;
  v_operational_area text;
  v_location_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'unauthorized';
  end if;

  select * into v_proposal
  from public.ai_action_proposals
  where id = p_proposal_id and created_by = v_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'proposal_not_found');
  end if;

  if v_proposal.status <> 'awaiting_confirmation' then
    return jsonb_build_object(
      'success', false,
      'error', 'proposal_not_executable',
      'status', v_proposal.status
    );
  end if;

  if v_proposal.expires_at <= now() then
    update public.ai_action_proposals
      set status = 'expired', updated_at = now(), completed_at = now(), error = 'proposal_expired'
    where id = v_proposal.id;
    return jsonb_build_object('success', false, 'error', 'proposal_expired', 'status', 'expired');
  end if;

  if not exists (
    select 1
    from public.ai_agentic_access a
    where a.user_id = v_user_id and a.enabled = true
  ) then
    return jsonb_build_object('success', false, 'error', 'agentic_access_denied');
  end if;

  if v_proposal.capability <> 'task.create_internal' then
    return jsonb_build_object('success', false, 'error', 'capability_not_allowed');
  end if;

  v_title := nullif(btrim(v_proposal.payload->>'title'), '');
  v_description := nullif(btrim(v_proposal.payload->>'description'), '');
  v_operational_area := nullif(btrim(v_proposal.payload->>'operational_area'), '');
  begin
    v_location_id := nullif(v_proposal.payload->>'location_id', '')::uuid;
  exception when invalid_text_representation then
    v_location_id := null;
  end;

  if v_title is null or length(v_title) > 160 then
    update public.ai_action_proposals
      set status = 'failed', claimed_at = now(), completed_at = now(), updated_at = now(), error = 'invalid_task_payload'
    where id = v_proposal.id;
    return jsonb_build_object('success', false, 'error', 'invalid_task_payload', 'status', 'failed');
  end if;

  if not public.can_access_operational_task_scope(v_operational_area, v_location_id) then
    update public.ai_action_proposals
      set status = 'failed', claimed_at = now(), completed_at = now(), updated_at = now(), error = 'task_scope_denied'
    where id = v_proposal.id;
    return jsonb_build_object('success', false, 'error', 'task_scope_denied', 'status', 'failed');
  end if;

  -- Atomic claim while the proposal row is locked. Replays cannot pass this transition.
  update public.ai_action_proposals
    set status = 'executing', claimed_at = now(), updated_at = now(), error = null
  where id = v_proposal.id;

  begin
    insert into public.tasks(title, description, status, location_id, operational_area)
    values (v_title, v_description, 'nueva', v_location_id, v_operational_area)
    returning * into v_task;

    update public.ai_action_proposals
      set status = 'succeeded', completed_at = now(), updated_at = now(),
          result = jsonb_build_object('task_id', v_task.id, 'status', v_task.status)
    where id = v_proposal.id;

    return jsonb_build_object(
      'success', true,
      'status', 'succeeded',
      'capability', v_proposal.capability,
      'task', jsonb_build_object('id', v_task.id, 'title', v_task.title, 'status', v_task.status)
    );
  exception when others then
    update public.ai_action_proposals
      set status = 'failed', completed_at = now(), updated_at = now(), error = left(sqlerrm, 500)
    where id = v_proposal.id;
    return jsonb_build_object('success', false, 'error', 'executor_failed', 'status', 'failed');
  end;
end;
$function$;

revoke all on function public.create_ai_task_proposal(text,text,text,uuid,jsonb) from public, anon;
revoke all on function public.execute_ai_action_proposal(uuid) from public, anon;
grant execute on function public.create_ai_task_proposal(text,text,text,uuid,jsonb) to authenticated;
grant execute on function public.execute_ai_action_proposal(uuid) to authenticated;

comment on table public.ai_action_proposals is
  'Server-owned confirmation envelope for allowlisted Black Swan AI actions. Direct client writes are intentionally disabled.';
comment on function public.execute_ai_action_proposal(uuid) is
  'Atomically consumes one owned, unexpired AI proposal and executes only statically allowlisted capability task.create_internal.';

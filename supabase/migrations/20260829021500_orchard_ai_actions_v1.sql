create table if not exists public.orchard_ai_action_proposals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  intent text not null,
  action_type text not null check (action_type in ('create_task','create_game_plan','create_crop_cycle')),
  summary text not null,
  rationale text,
  payload jsonb not null,
  model text not null,
  prompt_version text not null,
  source_counts jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','executed','rejected','failed')),
  decided_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orchard_ai_action_proposals_owner_status_created_idx
  on public.orchard_ai_action_proposals (created_by, status, created_at desc);

alter table public.orchard_ai_action_proposals enable row level security;

drop policy if exists orchard_ai_action_proposals_select_own on public.orchard_ai_action_proposals;
create policy orchard_ai_action_proposals_select_own
  on public.orchard_ai_action_proposals for select to authenticated
  using (created_by = auth.uid());

drop policy if exists orchard_ai_action_proposals_insert_own on public.orchard_ai_action_proposals;
create policy orchard_ai_action_proposals_insert_own
  on public.orchard_ai_action_proposals for insert to authenticated
  with check (created_by = auth.uid());

create or replace function public.reject_orchard_ai_action(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.orchard_ai_action_proposals%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_row from public.orchard_ai_action_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_row.created_by <> auth.uid() then raise exception 'Forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'Proposal is not pending'; end if;

  update public.orchard_ai_action_proposals
  set status='rejected', decided_at=now(), updated_at=now()
  where id=p_proposal_id;

  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'rejected');
end;
$$;

create or replace function public.execute_orchard_ai_action(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.orchard_ai_action_proposals%rowtype;
  v_payload jsonb;
  v_result_id uuid;
  v_action text;
  v_title text;
  v_name text;
  v_crop_name text;
  v_game_plan_id uuid;
  v_location_id uuid;
  v_start date;
  v_end date;
  v_target date;
  v_minutes integer;
  v_area numeric;
  v_qty numeric;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;

  select * into v_row from public.orchard_ai_action_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_row.created_by <> auth.uid() then raise exception 'Forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'Proposal is not pending'; end if;

  v_payload := v_row.payload;
  v_action := v_row.action_type;

  update public.orchard_ai_action_proposals
  set status='approved', decided_at=now(), updated_at=now()
  where id=p_proposal_id;

  if v_action = 'create_task' then
    v_title := nullif(trim(v_payload->>'title'), '');
    if v_title is null then raise exception 'Task title is required'; end if;
    if coalesce(v_payload->>'priority','media') not in ('baja','media','alta','urgente') then raise exception 'Invalid task priority'; end if;
    if nullif(v_payload->>'estimated_minutes','') is not null then
      v_minutes := (v_payload->>'estimated_minutes')::integer;
      if v_minutes < 5 or v_minutes > 1440 then raise exception 'Invalid estimated minutes'; end if;
    end if;
    if nullif(v_payload->>'location_id','') is not null then
      v_location_id := (v_payload->>'location_id')::uuid;
      if not public.can_access_orchard_location(v_location_id) then raise exception 'Orchard location access denied'; end if;
    elsif not public.can_access_orchard_global() then
      raise exception 'Orchard access denied';
    end if;

    insert into public.tasks (
      title, description, priority, due_date, location_id, operational_area,
      task_category, estimated_minutes, source_type, source_label, source_path, created_by
    ) values (
      v_title,
      nullif(trim(v_payload->>'description'), ''),
      coalesce(nullif(v_payload->>'priority',''), 'media'),
      nullif(v_payload->>'due_date','')::date,
      v_location_id,
      'huerto_vinedo',
      'orchard_ai',
      v_minutes,
      null,
      'Orchard AI approved action',
      '/orchard/assistant',
      auth.uid()
    ) returning id into v_result_id;

  elsif v_action = 'create_game_plan' then
    if not public.can_access_orchard_global() then raise exception 'Orchard access denied'; end if;
    v_name := nullif(trim(v_payload->>'name'), '');
    if v_name is null then raise exception 'Game plan name is required'; end if;
    v_start := nullif(v_payload->>'start_date','')::date;
    v_end := nullif(v_payload->>'end_date','')::date;
    if v_start is null or v_end is null then raise exception 'Game plan dates are required'; end if;
    if v_end < v_start then raise exception 'Game plan end date must be on or after start date'; end if;

    insert into public.orchard_game_plans (name, season, start_date, end_date, objective, notes, created_by)
    values (
      v_name,
      nullif(trim(v_payload->>'season'), ''),
      v_start,
      v_end,
      nullif(trim(v_payload->>'objective'), ''),
      nullif(trim(v_payload->>'notes'), ''),
      auth.uid()
    ) returning id into v_result_id;

  elsif v_action = 'create_crop_cycle' then
    if not public.can_access_orchard_global() then raise exception 'Orchard access denied'; end if;
    v_game_plan_id := nullif(v_payload->>'game_plan_id','')::uuid;
    if v_game_plan_id is null or not exists(select 1 from public.orchard_game_plans where id=v_game_plan_id) then raise exception 'Game plan not found or not accessible'; end if;
    v_crop_name := nullif(trim(v_payload->>'crop_name'), '');
    if v_crop_name is null then raise exception 'Crop name is required'; end if;
    if coalesce(v_payload->>'cycle_type','direct_sow') not in ('direct_sow','transplant','perennial','cover_crop') then raise exception 'Invalid cycle type'; end if;
    v_start := nullif(v_payload->>'planned_start_date','')::date;
    if v_start is null then raise exception 'Planned start date is required'; end if;
    v_target := nullif(v_payload->>'target_harvest_date','')::date;
    if v_target is not null and v_target < v_start then raise exception 'Target harvest date must be on or after planned start date'; end if;
    if nullif(v_payload->>'planned_area_sqm','') is not null then
      v_area := (v_payload->>'planned_area_sqm')::numeric;
      if v_area < 0 then raise exception 'Planned area cannot be negative'; end if;
    end if;
    if nullif(v_payload->>'target_quantity','') is not null then
      v_qty := (v_payload->>'target_quantity')::numeric;
      if v_qty < 0 then raise exception 'Target quantity cannot be negative'; end if;
    end if;

    insert into public.orchard_crop_cycles (
      game_plan_id, crop_name, variety, cycle_type, planned_start_date,
      target_harvest_date, planned_area_sqm, target_quantity, target_unit, notes, created_by
    ) values (
      v_game_plan_id,
      v_crop_name,
      nullif(trim(v_payload->>'variety'), ''),
      coalesce(nullif(v_payload->>'cycle_type',''), 'direct_sow'),
      v_start,
      v_target,
      v_area,
      v_qty,
      nullif(trim(v_payload->>'target_unit'), ''),
      nullif(trim(v_payload->>'notes'), ''),
      auth.uid()
    ) returning id into v_result_id;
  else
    raise exception 'Unsupported action type';
  end if;

  update public.orchard_ai_action_proposals
  set status='executed', executed_at=now(), updated_at=now(),
      execution_result=jsonb_build_object('entity_id',v_result_id,'action_type',v_action)
  where id=p_proposal_id;

  return jsonb_build_object('proposal_id',p_proposal_id,'status','executed','action_type',v_action,'entity_id',v_result_id);
exception when others then
  update public.orchard_ai_action_proposals
  set status='failed', error_message=sqlerrm, decided_at=coalesce(decided_at,now()), updated_at=now()
  where id=p_proposal_id and created_by=auth.uid();
  return jsonb_build_object('proposal_id',p_proposal_id,'status','failed','error',sqlerrm);
end;
$$;

revoke all on function public.execute_orchard_ai_action(uuid) from public, anon;
revoke all on function public.reject_orchard_ai_action(uuid) from public, anon;
grant execute on function public.execute_orchard_ai_action(uuid) to authenticated;
grant execute on function public.reject_orchard_ai_action(uuid) to authenticated;

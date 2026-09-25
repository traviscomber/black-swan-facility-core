-- Expand the confirmation-gated agentic executor with one reversible operational capability:
-- assign an open, unassigned hospitality request to the least-loaded active employee.

alter table public.ai_action_proposals
  drop constraint if exists ai_action_proposals_capability_check;

alter table public.ai_action_proposals
  add constraint ai_action_proposals_capability_check
  check (capability in ('task.create_internal','hospitality.assign_request'));

create or replace function public.create_ai_hospitality_assignment_proposal(
  p_request_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns public.ai_action_proposals
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_request public.hospitality_requests%rowtype;
  v_employee public.employees%rowtype;
  v_proposal public.ai_action_proposals;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='unauthorized';
  end if;

  if not exists (
    select 1 from public.ai_agentic_access a
    where a.user_id=v_user_id and a.enabled=true
  ) then
    raise exception using errcode='42501', message='agentic_access_denied';
  end if;

  if public.current_app_role() not in ('admin','approver') then
    raise exception using errcode='42501', message='hospitality_assignment_denied';
  end if;

  select * into v_request
  from public.hospitality_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='hospitality_request_not_found';
  end if;

  if v_request.status in ('completed','resolved','cancelled') then
    raise exception using errcode='22023', message='hospitality_request_closed';
  end if;

  if v_request.assigned_to is not null then
    raise exception using errcode='22023', message='hospitality_request_already_assigned';
  end if;

  select e.* into v_employee
  from public.employees e
  where coalesce(e.is_active,true)=true
  order by (
    select count(*)
    from public.hospitality_requests hr
    where hr.assigned_to=e.id
      and hr.status not in ('completed','resolved','cancelled')
  ) asc,
  e.name asc
  limit 1;

  if not found then
    raise exception using errcode='P0002', message='no_active_employee_available';
  end if;

  insert into public.ai_action_proposals(created_by,capability,payload,context)
  values (
    v_user_id,
    'hospitality.assign_request',
    jsonb_build_object(
      'request_id',v_request.id,
      'employee_id',v_employee.id,
      'employee_name',v_employee.name,
      'guest_name',v_request.guest_name,
      'request_type',v_request.request_type
    ),
    coalesce(p_context,'{}'::jsonb)
  )
  returning * into v_proposal;

  return v_proposal;
end;
$function$;

create or replace function public.execute_ai_action_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.ai_action_proposals;
  v_task public.tasks;
  v_title text;
  v_description text;
  v_operational_area text;
  v_location_id uuid;
  v_request public.hospitality_requests%rowtype;
  v_employee public.employees%rowtype;
  v_request_id uuid;
  v_employee_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='unauthorized';
  end if;

  select * into v_proposal
  from public.ai_action_proposals
  where id=p_proposal_id and created_by=v_user_id
  for update;

  if not found then
    return jsonb_build_object('success',false,'error','proposal_not_found');
  end if;

  if v_proposal.status<>'awaiting_confirmation' then
    return jsonb_build_object('success',false,'error','proposal_not_executable','status',v_proposal.status);
  end if;

  if v_proposal.expires_at<=now() then
    update public.ai_action_proposals
    set status='expired',updated_at=now(),completed_at=now(),error='proposal_expired'
    where id=v_proposal.id;
    return jsonb_build_object('success',false,'error','proposal_expired','status','expired');
  end if;

  if not exists (
    select 1 from public.ai_agentic_access a
    where a.user_id=v_user_id and a.enabled=true
  ) then
    return jsonb_build_object('success',false,'error','agentic_access_denied');
  end if;

  update public.ai_action_proposals
  set status='executing',claimed_at=now(),updated_at=now(),error=null
  where id=v_proposal.id;

  if v_proposal.capability='task.create_internal' then
    v_title := nullif(btrim(v_proposal.payload->>'title'),'');
    v_description := nullif(btrim(v_proposal.payload->>'description'),'');
    v_operational_area := nullif(btrim(v_proposal.payload->>'operational_area'),'');
    begin
      v_location_id := nullif(v_proposal.payload->>'location_id','')::uuid;
    exception when invalid_text_representation then
      v_location_id := null;
    end;

    if v_title is null or length(v_title)>160 then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='invalid_task_payload'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','invalid_task_payload','status','failed');
    end if;

    if not public.can_access_operational_task_scope(v_operational_area,v_location_id) then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='task_scope_denied'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','task_scope_denied','status','failed');
    end if;

    begin
      insert into public.tasks(title,description,status,location_id,operational_area)
      values (v_title,v_description,'nueva',v_location_id,v_operational_area)
      returning * into v_task;

      update public.ai_action_proposals
      set status='succeeded',completed_at=now(),updated_at=now(),
          result=jsonb_build_object('task_id',v_task.id,'status',v_task.status)
      where id=v_proposal.id;

      return jsonb_build_object(
        'success',true,
        'status','succeeded',
        'capability',v_proposal.capability,
        'task',jsonb_build_object('id',v_task.id,'title',v_task.title,'status',v_task.status)
      );
    exception when others then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error=left(sqlerrm,500)
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','executor_failed','status','failed');
    end;
  end if;

  if v_proposal.capability='hospitality.assign_request' then
    if public.current_app_role() not in ('admin','approver') then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='hospitality_assignment_denied'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','hospitality_assignment_denied','status','failed');
    end if;

    begin
      v_request_id := (v_proposal.payload->>'request_id')::uuid;
      v_employee_id := (v_proposal.payload->>'employee_id')::uuid;
    exception when others then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='invalid_hospitality_assignment_payload'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','invalid_hospitality_assignment_payload','status','failed');
    end;

    select * into v_request
    from public.hospitality_requests
    where id=v_request_id
    for update;

    select * into v_employee
    from public.employees
    where id=v_employee_id and coalesce(is_active,true)=true;

    if v_request.id is null or v_employee.id is null then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='assignment_target_unavailable'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','assignment_target_unavailable','status','failed');
    end if;

    if v_request.status in ('completed','resolved','cancelled') or v_request.assigned_to is not null then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='request_no_longer_assignable'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','request_no_longer_assignable','status','failed');
    end if;

    update public.hospitality_requests
    set assigned_to=v_employee.id,
        status=case when status='pending' then 'assigned' else status end,
        updated_at=now()
    where id=v_request.id;

    insert into public.critical_action_audit_log(
      entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
      old_data,new_data,changed_fields,occurred_at
    ) values (
      'hospitality_request',v_request.id,'UPDATE','hospitality',
      auth.uid(),auth.jwt()->>'email',public.current_app_role(),
      jsonb_build_object('assigned_to',v_request.assigned_to,'status',v_request.status),
      jsonb_build_object(
        'operation','agentic_assign_hospitality_request',
        'assigned_to',v_employee.id,
        'employee_name',v_employee.name,
        'status',case when v_request.status='pending' then 'assigned' else v_request.status end
      ),
      array['assigned_to','status'],now()
    );

    update public.ai_action_proposals
    set status='succeeded',completed_at=now(),updated_at=now(),
        result=jsonb_build_object(
          'request_id',v_request.id,
          'employee_id',v_employee.id,
          'employee_name',v_employee.name,
          'status','assigned'
        )
    where id=v_proposal.id;

    return jsonb_build_object(
      'success',true,
      'status','succeeded',
      'capability',v_proposal.capability,
      'request_id',v_request.id,
      'employee_id',v_employee.id,
      'employee_name',v_employee.name
    );
  end if;

  update public.ai_action_proposals
  set status='failed',completed_at=now(),updated_at=now(),error='capability_not_allowed'
  where id=v_proposal.id;

  return jsonb_build_object('success',false,'error','capability_not_allowed','status','failed');
end;
$function$;

revoke all on function public.create_ai_hospitality_assignment_proposal(uuid,jsonb) from public,anon;
grant execute on function public.create_ai_hospitality_assignment_proposal(uuid,jsonb) to authenticated;

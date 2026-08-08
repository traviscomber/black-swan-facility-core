-- Separate Housekeeping execution from supervisor approval.
-- Operators may execute tasks with housekeeping.operate; approve/reject requires housekeeping.manage.

create or replace function public.update_housekeeping_task_operation(
  p_task_id uuid,
  p_action text,
  p_assigned_to uuid default null,
  p_notes text default null,
  p_quality_score integer default null
)
returns public.housekeeping_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.housekeeping_tasks%rowtype;
  v_now timestamptz := now();
  v_location_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.can_app_action('housekeeping.operate') then
    raise exception 'housekeeping operation permission required';
  end if;

  select * into v_task
  from public.housekeeping_tasks
  where id = p_task_id
  for update;

  if not found then raise exception 'housekeeping task not found'; end if;

  select r.location_id into v_location_id
  from public.rooms r
  where r.id = v_task.room_id;

  if not public.can_access_operational_scope('housekeeping', v_location_id) then
    raise exception 'housekeeping scope denied';
  end if;

  if p_action in ('approve','reject') and not public.can_app_action('housekeeping.manage') then
    raise exception 'housekeeping supervisor permission required';
  end if;

  if p_action='assign' then
    if p_assigned_to is null then raise exception 'assigned user required'; end if;
    update public.housekeeping_tasks set assigned_to=p_assigned_to,status='assigned',updated_at=v_now where id=p_task_id;
  elsif p_action='start' then
    if v_task.assigned_to is null then raise exception 'assign task before start'; end if;
    update public.housekeeping_tasks set status='in_progress',started_at=coalesce(started_at,v_now),updated_at=v_now where id=p_task_id;
  elsif p_action='complete' then
    update public.housekeeping_tasks set status=case when requires_inspection then 'inspection' else 'completed' end,
      completed_at=v_now,
      actual_duration_minutes=case when started_at is null then actual_duration_minutes else greatest(1,round(extract(epoch from (v_now-started_at))/60)::int) end,
      inspection_status=case when requires_inspection then 'pending' else 'not_required' end,
      resolution_notes=coalesce(p_notes,resolution_notes),updated_at=v_now where id=p_task_id;
  elsif p_action='approve' then
    if not v_task.requires_inspection then raise exception 'inspection not required'; end if;
    if v_task.status <> 'inspection' then raise exception 'task must be awaiting inspection'; end if;
    update public.housekeeping_tasks set status='completed',inspection_status='approved',quality_score=p_quality_score,
      inspection_notes=p_notes,inspected_by=auth.uid(),inspected_at=v_now,verified_by=auth.uid(),verified_at=v_now,updated_at=v_now where id=p_task_id;
    if v_task.room_id is not null then
      update public.rooms
      set operational_status='ready',status='available'
      where id=v_task.room_id and operational_status not in ('out_of_service','maintenance');
    end if;
  elsif p_action='reject' then
    if not v_task.requires_inspection then raise exception 'inspection not required'; end if;
    if v_task.status <> 'inspection' then raise exception 'task must be awaiting inspection'; end if;
    if coalesce(trim(p_notes),'')='' then raise exception 'rejection reason required'; end if;
    update public.housekeeping_tasks set status='in_progress',inspection_status='rejected',inspection_notes=p_notes,
      inspected_by=auth.uid(),inspected_at=v_now,updated_at=v_now where id=p_task_id;
  else
    raise exception 'unsupported action';
  end if;

  select * into v_task from public.housekeeping_tasks where id=p_task_id;
  return v_task;
end
$$;

revoke all on function public.update_housekeeping_task_operation(uuid,text,uuid,text,integer) from public, anon;
grant execute on function public.update_housekeeping_task_operation(uuid,text,uuid,text,integer) to authenticated, service_role;

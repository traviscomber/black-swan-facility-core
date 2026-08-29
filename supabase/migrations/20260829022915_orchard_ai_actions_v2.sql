alter table public.orchard_ai_action_proposals
  drop constraint if exists orchard_ai_action_proposals_action_type_check;

alter table public.orchard_ai_action_proposals
  add constraint orchard_ai_action_proposals_action_type_check
  check (action_type = any (array[
    'create_task'::text,
    'create_game_plan'::text,
    'create_crop_cycle'::text,
    'create_succession'::text,
    'allocate_bed'::text
  ]));

create or replace function public.execute_orchard_ai_action(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row public.orchard_ai_action_proposals%rowtype;
  v_payload jsonb;
  v_result_id uuid;
  v_action text;
  v_title text;
  v_name text;
  v_crop_name text;
  v_game_plan_id uuid;
  v_crop_cycle_id uuid;
  v_succession_id uuid;
  v_bed_id uuid;
  v_location_id uuid;
  v_employee_id uuid;
  v_start date;
  v_end date;
  v_target date;
  v_transplant date;
  v_first_harvest date;
  v_last_harvest date;
  v_minutes integer;
  v_area numeric;
  v_qty numeric;
  v_bed_area numeric;
  v_plants integer;
  v_days integer;
  v_sequence integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_row from public.orchard_ai_action_proposals where id=p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_row.created_by<>auth.uid() then raise exception 'Forbidden'; end if;
  if v_row.status<>'pending' then return jsonb_build_object('proposal_id',p_proposal_id,'status',v_row.status,'error','Proposal is not pending'); end if;
  v_payload:=v_row.payload;
  v_action:=v_row.action_type;
  begin
    update public.orchard_ai_action_proposals set status='approved',decided_at=now(),updated_at=now() where id=p_proposal_id;
    if v_action='create_task' then
      v_title:=nullif(trim(v_payload->>'title'),'');
      if v_title is null then raise exception 'Task title is required'; end if;
      if coalesce(v_payload->>'priority','media') not in ('baja','media','alta','urgente') then raise exception 'Invalid task priority'; end if;
      if nullif(v_payload->>'estimated_minutes','') is not null then v_minutes:=(v_payload->>'estimated_minutes')::integer; if v_minutes<5 or v_minutes>1440 then raise exception 'Invalid estimated minutes'; end if; end if;
      if nullif(v_payload->>'location_id','') is not null then v_location_id:=(v_payload->>'location_id')::uuid; if not public.can_access_orchard_location(v_location_id) then raise exception 'Orchard location access denied'; end if;
      elsif not public.can_access_orchard_global() then raise exception 'Orchard access denied'; end if;
      select employee_id into v_employee_id from public.user_access_profiles where user_id=auth.uid() and is_active;
      if v_employee_id is null then raise exception 'Current user has no linked employee identity'; end if;
      insert into public.tasks(title,description,priority,due_date,location_id,operational_area,task_category,estimated_minutes,source_type,source_label,source_path,created_by)
      values(v_title,nullif(trim(v_payload->>'description'),''),coalesce(nullif(v_payload->>'priority',''),'media'),nullif(v_payload->>'due_date','')::date,v_location_id,'huerto_vinedo','orchard_ai',v_minutes,null,'Orchard AI approved action','/orchard/assistant',v_employee_id) returning id into v_result_id;
    elsif v_action='create_game_plan' then
      if not public.can_access_orchard_global() then raise exception 'Orchard access denied'; end if;
      v_name:=nullif(trim(v_payload->>'name'),''); if v_name is null then raise exception 'Game plan name is required'; end if;
      v_start:=nullif(v_payload->>'start_date','')::date; v_end:=nullif(v_payload->>'end_date','')::date;
      if v_start is null or v_end is null then raise exception 'Game plan dates are required'; end if; if v_end<v_start then raise exception 'Game plan end date must be on or after start date'; end if;
      insert into public.orchard_game_plans(name,season,start_date,end_date,objective,notes,created_by)
      values(v_name,nullif(trim(v_payload->>'season'),''),v_start,v_end,nullif(trim(v_payload->>'objective'),''),nullif(trim(v_payload->>'notes'),''),auth.uid()) returning id into v_result_id;
    elsif v_action='create_crop_cycle' then
      if not public.can_access_orchard_global() then raise exception 'Orchard access denied'; end if;
      v_game_plan_id:=nullif(v_payload->>'game_plan_id','')::uuid; if v_game_plan_id is null or not exists(select 1 from public.orchard_game_plans where id=v_game_plan_id) then raise exception 'Game plan not found or not accessible'; end if;
      v_crop_name:=nullif(trim(v_payload->>'crop_name'),''); if v_crop_name is null then raise exception 'Crop name is required'; end if;
      if coalesce(v_payload->>'cycle_type','direct_sow') not in ('direct_sow','transplant','perennial','cover_crop') then raise exception 'Invalid cycle type'; end if;
      v_start:=nullif(v_payload->>'planned_start_date','')::date; if v_start is null then raise exception 'Planned start date is required'; end if;
      v_target:=nullif(v_payload->>'target_harvest_date','')::date; if v_target is not null and v_target<v_start then raise exception 'Target harvest date must be on or after planned start date'; end if;
      if nullif(v_payload->>'planned_area_sqm','') is not null then v_area:=(v_payload->>'planned_area_sqm')::numeric; if v_area<0 then raise exception 'Planned area cannot be negative'; end if; end if;
      if nullif(v_payload->>'target_quantity','') is not null then v_qty:=(v_payload->>'target_quantity')::numeric; if v_qty<0 then raise exception 'Target quantity cannot be negative'; end if; end if;
      insert into public.orchard_crop_cycles(game_plan_id,crop_name,variety,cycle_type,planned_start_date,target_harvest_date,planned_area_sqm,target_quantity,target_unit,notes,created_by)
      values(v_game_plan_id,v_crop_name,nullif(trim(v_payload->>'variety'),''),coalesce(nullif(v_payload->>'cycle_type',''),'direct_sow'),v_start,v_target,v_area,v_qty,nullif(trim(v_payload->>'target_unit'),''),nullif(trim(v_payload->>'notes'),''),auth.uid()) returning id into v_result_id;
    elsif v_action='create_succession' then
      if not public.can_access_orchard_global() then raise exception 'Orchard access denied'; end if;
      v_crop_cycle_id:=nullif(v_payload->>'crop_cycle_id','')::uuid; if v_crop_cycle_id is null then raise exception 'Crop cycle is required'; end if;
      perform 1 from public.orchard_crop_cycles where id=v_crop_cycle_id for update; if not found then raise exception 'Crop cycle not found or not accessible'; end if;
      v_start:=nullif(v_payload->>'planned_sow_date','')::date; if v_start is null then raise exception 'Planned sow date is required'; end if;
      v_transplant:=nullif(v_payload->>'planned_transplant_date','')::date; v_first_harvest:=nullif(v_payload->>'planned_first_harvest_date','')::date; v_last_harvest:=nullif(v_payload->>'planned_last_harvest_date','')::date;
      if v_transplant is not null and v_transplant<v_start then raise exception 'Transplant date must be on or after sow date'; end if;
      if v_first_harvest is not null and v_first_harvest<v_start then raise exception 'First harvest date must be on or after sow date'; end if;
      if v_last_harvest is not null and (v_first_harvest is null or v_last_harvest<v_first_harvest) then raise exception 'Last harvest date requires and must follow first harvest date'; end if;
      if nullif(v_payload->>'days_to_maturity','') is not null then v_days:=(v_payload->>'days_to_maturity')::integer; if v_days<=0 then raise exception 'Days to maturity must be positive'; end if; end if;
      if nullif(v_payload->>'planned_plants','') is not null then v_plants:=(v_payload->>'planned_plants')::integer; if v_plants<0 then raise exception 'Planned plants cannot be negative'; end if; end if;
      if nullif(v_payload->>'planned_area_sqm','') is not null then v_area:=(v_payload->>'planned_area_sqm')::numeric; if v_area<0 then raise exception 'Planned area cannot be negative'; end if; end if;
      select coalesce(max(sequence_no),0)+1 into v_sequence from public.orchard_crop_successions where crop_cycle_id=v_crop_cycle_id;
      insert into public.orchard_crop_successions(crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,days_to_maturity,planned_plants,planned_area_sqm,notes,created_by)
      values(v_crop_cycle_id,v_sequence,v_start,v_transplant,v_first_harvest,v_last_harvest,v_days,v_plants,v_area,nullif(trim(v_payload->>'notes'),''),auth.uid()) returning id into v_result_id;
    elsif v_action='allocate_bed' then
      v_bed_id:=nullif(v_payload->>'bed_id','')::uuid; v_succession_id:=nullif(v_payload->>'crop_succession_id','')::uuid;
      if v_bed_id is null or v_succession_id is null then raise exception 'Bed and succession are required'; end if;
      if not public.can_access_orchard_bed(v_bed_id) then raise exception 'Orchard bed access denied'; end if;
      if not public.can_access_orchard_succession(v_succession_id) then raise exception 'Orchard succession access denied'; end if;
      select coalesce(area_sqm,coalesce(length_m,0)*coalesce(width_m,0)) into v_bed_area from public.orchard_beds where id=v_bed_id and status='active' for update;
      if not found then raise exception 'Active bed not found or not accessible'; end if;
      if not exists(select 1 from public.orchard_crop_successions where id=v_succession_id and status<>'cancelled') then raise exception 'Succession not found, inaccessible, or cancelled'; end if;
      v_start:=nullif(v_payload->>'planned_start_date','')::date; v_end:=nullif(v_payload->>'planned_end_date','')::date;
      if v_start is null or v_end is null then raise exception 'Allocation dates are required'; end if; if v_end<v_start then raise exception 'Allocation end date must be on or after start date'; end if;
      if nullif(v_payload->>'allocated_area_sqm','') is not null then v_area:=(v_payload->>'allocated_area_sqm')::numeric; if v_area<=0 then raise exception 'Allocated area must be positive'; end if; if v_bed_area>0 and v_area>v_bed_area then raise exception 'Allocated area exceeds bed capacity'; end if; end if;
      if nullif(v_payload->>'planned_plants','') is not null then v_plants:=(v_payload->>'planned_plants')::integer; if v_plants<0 then raise exception 'Planned plants cannot be negative'; end if; end if;
      if exists(select 1 from public.orchard_bed_allocations where bed_id=v_bed_id and daterange(planned_start_date,planned_end_date,'[]') && daterange(v_start,v_end,'[]')) then raise exception 'Bed is already occupied during part of the requested date range'; end if;
      insert into public.orchard_bed_allocations(bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants,notes,created_by)
      values(v_bed_id,v_succession_id,v_start,v_end,v_area,v_plants,nullif(trim(v_payload->>'notes'),''),auth.uid()) returning id into v_result_id;
    else raise exception 'Unsupported action type'; end if;
    update public.orchard_ai_action_proposals set status='executed',executed_at=now(),updated_at=now(),execution_result=jsonb_build_object('entity_id',v_result_id,'action_type',v_action),error_message=null where id=p_proposal_id;
    return jsonb_build_object('proposal_id',p_proposal_id,'status','executed','action_type',v_action,'entity_id',v_result_id);
  exception when others then
    update public.orchard_ai_action_proposals set status='failed',error_message=sqlerrm,decided_at=coalesce(decided_at,now()),updated_at=now() where id=p_proposal_id and status in ('pending','approved');
    return jsonb_build_object('proposal_id',p_proposal_id,'status','failed','error',sqlerrm);
  end;
end;
$function$;

revoke all on function public.execute_orchard_ai_action(uuid) from public, anon;
grant execute on function public.execute_orchard_ai_action(uuid) to authenticated, service_role;

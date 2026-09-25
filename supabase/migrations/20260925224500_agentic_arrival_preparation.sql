-- Add confirmation-gated arrival preparation bundle for Santiago.
-- The agent may prepare the bundle automatically, but execution still requires explicit confirmation.

alter table public.ai_action_proposals
  drop constraint if exists ai_action_proposals_capability_check;

alter table public.ai_action_proposals
  add constraint ai_action_proposals_capability_check
  check (capability in (
    'task.create_internal',
    'hospitality.assign_request',
    'hospitality.prepare_arrival'
  ));

create or replace function public.create_ai_arrival_preparation_proposal(
  p_reservation_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns public.ai_action_proposals
language plpgsql
security definer
set search_path='public','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.reservations%rowtype;
  v_location_id uuid;
  v_location_name text;
  v_room_number text;
  v_existing integer := 0;
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
    raise exception using errcode='42501', message='arrival_preparation_denied';
  end if;

  select * into v_reservation
  from public.reservations
  where id=p_reservation_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='reservation_not_found';
  end if;

  if coalesce(v_reservation.status,'') in ('cancelled','checked_out','checked-out') then
    raise exception using errcode='22023', message='reservation_not_preparable';
  end if;

  select
    coalesce(v_reservation.location_id, r.location_id),
    l.name,
    r.room_number
  into v_location_id, v_location_name, v_room_number
  from public.rooms r
  left join public.locations l on l.id=coalesce(v_reservation.location_id,r.location_id)
  where r.id=v_reservation.room_id;

  if v_location_id is null then
    raise exception using errcode='22023', message='arrival_location_required';
  end if;

  select count(*) into v_existing
  from public.hospitality_requests hr
  where hr.reservation_id=v_reservation.id
    and hr.request_type in (
      'luggage_labeling',
      'luggage_distribution',
      'firewood_delivery',
      'light_fireplace',
      'turn_on_heating',
      'arrival_lighting',
      'hot_water_check',
      'drinking_water',
      'amenities',
      'access_check',
      'final_walkthrough'
    );

  insert into public.ai_action_proposals(created_by,capability,payload,context)
  values (
    v_user_id,
    'hospitality.prepare_arrival',
    jsonb_build_object(
      'reservation_id',v_reservation.id,
      'guest_name',v_reservation.guest_name,
      'check_in',v_reservation.check_in,
      'room_id',v_reservation.room_id,
      'room_number',v_room_number,
      'location_id',v_location_id,
      'location_name',v_location_name,
      'bundle_size',11,
      'existing_tasks',v_existing
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
  v_reservation public.reservations%rowtype;
  v_reservation_id uuid;
  v_arrival_location_id uuid;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_task_key text;
  v_task_label text;
  v_task_description text;
  v_task_priority text;
  v_created_ids uuid[] := '{}';
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

  if v_proposal.capability='hospitality.prepare_arrival' then
    if public.current_app_role() not in ('admin','approver') then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='arrival_preparation_denied'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','arrival_preparation_denied','status','failed');
    end if;

    begin
      v_reservation_id := (v_proposal.payload->>'reservation_id')::uuid;
    exception when others then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='invalid_arrival_payload'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','invalid_arrival_payload','status','failed');
    end;

    select * into v_reservation
    from public.reservations
    where id=v_reservation_id
    for update;

    if v_reservation.id is null
       or coalesce(v_reservation.status,'') in ('cancelled','checked_out','checked-out') then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='reservation_no_longer_preparable'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','reservation_no_longer_preparable','status','failed');
    end if;

    select coalesce(v_reservation.location_id,r.location_id)
    into v_arrival_location_id
    from public.rooms r
    where r.id=v_reservation.room_id;

    if v_arrival_location_id is null then
      update public.ai_action_proposals
      set status='failed',completed_at=now(),updated_at=now(),error='arrival_location_required'
      where id=v_proposal.id;
      return jsonb_build_object('success',false,'error','arrival_location_required','status','failed');
    end if;

    for v_task_key,v_task_label,v_task_description,v_task_priority in
      values
        ('luggage_labeling','Etiquetado de maletas','Etiquetar e identificar el equipaje antes de moverlo o distribuirlo.','high'),
        ('luggage_distribution','Distribuir maletas','Mover el equipaje etiquetado a la habitación o casa correspondiente.','normal'),
        ('firewood_delivery','Llevar leña','Dejar leña suficiente y ordenada en el punto asignado.','normal'),
        ('light_fireplace','Prender chimenea','Prender la chimenea antes de la llegada y verificar funcionamiento.','normal'),
        ('turn_on_heating','Prender calefacción','Encender calefacción con anticipación y revisar temperatura interior.','normal'),
        ('arrival_lighting','Encender luces','Encender iluminación interior, acceso y exterior necesaria para la llegada.','normal'),
        ('hot_water_check','Revisar agua caliente','Confirmar disponibilidad y temperatura de agua caliente.','normal'),
        ('drinking_water','Dejar agua','Dejar agua potable preparada para el huésped.','normal'),
        ('amenities','Revisar amenities','Confirmar amenities completos y correctamente presentados.','normal'),
        ('access_check','Revisar acceso','Verificar puertas, accesos, llaves y recorrido de entrada.','normal'),
        ('final_walkthrough','Recorrido final','Hacer último recorrido operativo y confirmar presentación de la casa.','normal')
    loop
      if exists (
        select 1
        from public.hospitality_requests hr
        where hr.reservation_id=v_reservation.id
          and hr.request_type=v_task_key
      ) then
        v_skipped_count := v_skipped_count + 1;
      else
        insert into public.hospitality_requests(
          reservation_id,room_id,location_id,guest_name,guest_phone,guest_email,
          request_type,category,description,priority,status
        ) values (
          v_reservation.id,
          v_reservation.room_id,
          v_arrival_location_id,
          v_reservation.guest_name,
          v_reservation.guest_phone,
          v_reservation.guest_email,
          v_task_key,
          'arrival_detail',
          v_task_label || '. ' || v_task_description || ' · Preparación agentic confirmada para llegada.',
          v_task_priority,
          'pending'
        )
        returning id into v_request_id;

        v_created_ids := array_append(v_created_ids,v_request_id);
        v_created_count := v_created_count + 1;
      end if;
    end loop;

    insert into public.critical_action_audit_log(
      entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
      old_data,new_data,changed_fields,occurred_at
    ) values (
      'reservation',v_reservation.id,'UPDATE','hospitality',
      auth.uid(),auth.jwt()->>'email',public.current_app_role(),
      jsonb_build_object('agentic_arrival_bundle',false),
      jsonb_build_object(
        'operation','agentic_prepare_arrival_bundle',
        'created_count',v_created_count,
        'skipped_existing',v_skipped_count,
        'created_request_ids',to_jsonb(v_created_ids)
      ),
      array['hospitality_requests'],now()
    );

    update public.ai_action_proposals
    set status='succeeded',completed_at=now(),updated_at=now(),
        result=jsonb_build_object(
          'reservation_id',v_reservation.id,
          'created_count',v_created_count,
          'skipped_existing',v_skipped_count,
          'created_request_ids',to_jsonb(v_created_ids)
        )
    where id=v_proposal.id;

    return jsonb_build_object(
      'success',true,
      'status','succeeded',
      'capability',v_proposal.capability,
      'reservation_id',v_reservation.id,
      'created_count',v_created_count,
      'skipped_existing',v_skipped_count
    );
  end if;

  update public.ai_action_proposals
  set status='failed',completed_at=now(),updated_at=now(),error='capability_not_allowed'
  where id=v_proposal.id;

  return jsonb_build_object('success',false,'error','capability_not_allowed','status','failed');
end;
$function$;

revoke all on function public.create_ai_arrival_preparation_proposal(uuid,jsonb) from public,anon;
grant execute on function public.create_ai_arrival_preparation_proposal(uuid,jsonb) to authenticated;

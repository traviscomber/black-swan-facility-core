-- Scope property configuration and shift handovers by canonical location.
-- booking_shift_handovers is empty at migration time, so location_id can become required safely.

alter table public.booking_shift_handovers
  add column if not exists location_id uuid references public.locations(id) on delete restrict;

alter table public.booking_shift_handovers
  alter column location_id set not null;

create index if not exists booking_shift_handovers_location_date_idx
  on public.booking_shift_handovers(location_id, shift_date desc, created_at desc);

-- Locations are structural configuration, not an operator-level write surface.
drop policy if exists locations_authenticated_insert on public.locations;
drop policy if exists locations_authenticated_update on public.locations;

create policy locations_admin_approver_insert
on public.locations
for insert
to authenticated
with check (public.current_app_role() in ('admin','approver'));

create policy locations_admin_approver_update
on public.locations
for update
to authenticated
using (public.current_app_role() in ('admin','approver'))
with check (public.current_app_role() in ('admin','approver'));

-- Scope handovers by property while preserving draft-owner editing semantics.
drop policy if exists booking_shift_handovers_select_authenticated on public.booking_shift_handovers;
drop policy if exists booking_shift_handovers_insert_own_draft on public.booking_shift_handovers;
drop policy if exists booking_shift_handovers_update_own_draft on public.booking_shift_handovers;

create policy booking_shift_handovers_select_scoped
on public.booking_shift_handovers
for select
to authenticated
using (
  public.current_app_role() in ('admin','approver','operator')
  and public.can_access_operational_scope('booking', location_id)
);

create policy booking_shift_handovers_insert_own_draft_scoped
on public.booking_shift_handovers
for insert
to authenticated
with check (
  public.current_app_role() in ('admin','approver','operator')
  and created_by = auth.uid()
  and status = 'draft'
  and public.can_access_operational_scope('booking', location_id)
);

create policy booking_shift_handovers_update_own_draft_scoped
on public.booking_shift_handovers
for update
to authenticated
using (
  public.current_app_role() in ('admin','approver','operator')
  and created_by = auth.uid()
  and status = 'draft'
  and public.can_access_operational_scope('booking', location_id)
)
with check (
  created_by = auth.uid()
  and status = 'draft'
  and public.can_access_operational_scope('booking', location_id)
);

-- Child visibility/writes inherit the handover's location scope.
drop policy if exists booking_handover_items_select_authenticated on public.booking_handover_items;
drop policy if exists booking_handover_items_insert_draft_owner on public.booking_handover_items;
drop policy if exists booking_handover_items_update_draft_owner on public.booking_handover_items;
drop policy if exists booking_handover_items_delete_draft_owner on public.booking_handover_items;

create policy booking_handover_items_select_scoped
on public.booking_handover_items
for select
to authenticated
using (
  public.current_app_role() in ('admin','approver','operator')
  and exists (
    select 1 from public.booking_shift_handovers h
    where h.id = booking_handover_items.handover_id
      and public.can_access_operational_scope('booking', h.location_id)
  )
);

create policy booking_handover_items_insert_draft_owner_scoped
on public.booking_handover_items
for insert
to authenticated
with check (
  public.current_app_role() in ('admin','approver','operator')
  and exists (
    select 1 from public.booking_shift_handovers h
    where h.id = booking_handover_items.handover_id
      and h.status = 'draft'
      and h.created_by = auth.uid()
      and public.can_access_operational_scope('booking', h.location_id)
  )
);

create policy booking_handover_items_update_draft_owner_scoped
on public.booking_handover_items
for update
to authenticated
using (
  public.current_app_role() in ('admin','approver','operator')
  and exists (
    select 1 from public.booking_shift_handovers h
    where h.id = booking_handover_items.handover_id
      and h.status = 'draft'
      and h.created_by = auth.uid()
      and public.can_access_operational_scope('booking', h.location_id)
  )
)
with check (
  exists (
    select 1 from public.booking_shift_handovers h
    where h.id = booking_handover_items.handover_id
      and h.status = 'draft'
      and h.created_by = auth.uid()
      and public.can_access_operational_scope('booking', h.location_id)
  )
);

create policy booking_handover_items_delete_draft_owner_scoped
on public.booking_handover_items
for delete
to authenticated
using (
  public.current_app_role() in ('admin','approver','operator')
  and exists (
    select 1 from public.booking_shift_handovers h
    where h.id = booking_handover_items.handover_id
      and h.status = 'draft'
      and h.created_by = auth.uid()
      and public.can_access_operational_scope('booking', h.location_id)
  )
);

-- SECURITY DEFINER lifecycle RPCs must enforce the same property scope explicitly.
create or replace function public.submit_booking_handover(p_handover_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_old public.booking_shift_handovers%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver','operator') then raise exception 'Insufficient permissions'; end if;
  select * into v_old from public.booking_shift_handovers where id=p_handover_id for update;
  if not found then raise exception 'Handover not found'; end if;
  if not public.can_access_operational_scope('booking', v_old.location_id) then raise exception 'Handover outside operational scope'; end if;
  if v_old.status <> 'draft' then raise exception 'Only draft handovers can be submitted'; end if;
  if v_old.created_by is distinct from auth.uid() and v_role <> 'admin' then raise exception 'Only the draft owner or an admin can submit this handover'; end if;
  if not exists(select 1 from public.booking_handover_items where handover_id=p_handover_id and status in ('pending','acknowledged','carried_forward')) and coalesce(trim(v_old.summary),'')='' then raise exception 'Handover requires summary or pending items'; end if;
  update public.booking_shift_handovers set status='submitted',submitted_at=now(),updated_at=now() where id=p_handover_id;
  insert into public.critical_action_audit_log(entity_type,entity_id,action,category,actor_id,actor_email,actor_role,old_data,new_data,changed_fields)
  values('handover',p_handover_id,'handover_submitted','operations',auth.uid(),auth.jwt()->>'email',v_role,jsonb_build_object('status',v_old.status),jsonb_build_object('status','submitted'),array['status']);
end;
$function$;

create or replace function public.accept_booking_handover(p_handover_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_handover public.booking_shift_handovers%rowtype;
  v_actor_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_incoming_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver','operator') then raise exception 'Insufficient permissions'; end if;
  select * into v_handover from public.booking_shift_handovers where id=p_handover_id for update;
  if not found then raise exception 'Handover not found'; end if;
  if not public.can_access_operational_scope('booking', v_handover.location_id) then raise exception 'Handover outside operational scope'; end if;
  if v_handover.status <> 'submitted' then raise exception 'Only submitted handovers can be accepted'; end if;
  if v_role='operator' and v_handover.incoming_employee_id is not null then
    select lower(coalesce(email,'')) into v_incoming_email from public.employees where id=v_handover.incoming_employee_id;
    if coalesce(v_incoming_email,'')='' or v_incoming_email<>v_actor_email then raise exception 'Only the assigned incoming employee can accept this handover'; end if;
  end if;
  update public.booking_shift_handovers set status='accepted',accepted_at=now(),accepted_by=auth.uid(),updated_at=now() where id=p_handover_id;
  insert into public.critical_action_audit_log(entity_type,entity_id,action,category,actor_id,actor_email,actor_role,old_data,new_data,changed_fields)
  values('handover',p_handover_id,'handover_accepted','operations',auth.uid(),auth.jwt()->>'email',v_role,jsonb_build_object('status','submitted'),jsonb_build_object('status','accepted'),array['status']);
end;
$function$;

create or replace function public.update_booking_handover_item_status(p_item_id uuid,p_status text)
returns public.booking_handover_items
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_item public.booking_handover_items%rowtype;
  v_handover public.booking_shift_handovers%rowtype;
  v_old_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver','operator') then raise exception 'Insufficient permissions'; end if;
  if p_status not in ('acknowledged','resolved','carried_forward') then raise exception 'Unsupported handover item status'; end if;
  select * into v_item from public.booking_handover_items where id=p_item_id for update;
  if not found then raise exception 'Handover item not found'; end if;
  select * into v_handover from public.booking_shift_handovers where id=v_item.handover_id for update;
  if not found then raise exception 'Handover not found'; end if;
  if not public.can_access_operational_scope('booking', v_handover.location_id) then raise exception 'Handover outside operational scope'; end if;
  if v_handover.status not in ('submitted','accepted') then raise exception 'Only submitted or accepted handovers can update item status'; end if;
  if v_role='operator' and v_handover.accepted_by is not null and v_handover.accepted_by<>auth.uid() then raise exception 'Only the employee who accepted the handover can update its items'; end if;
  if p_status='acknowledged' and v_item.status not in ('pending','carried_forward') then raise exception 'Only pending or carried-forward items can be acknowledged';
  elsif p_status in ('resolved','carried_forward') and v_item.status not in ('pending','acknowledged','carried_forward') then raise exception 'Invalid handover item transition'; end if;
  v_old_status:=v_item.status;
  update public.booking_handover_items set status=p_status,resolved_at=case when p_status='resolved' then now() else null end,resolved_by=case when p_status='resolved' then auth.uid() else null end where id=p_item_id returning * into v_item;
  insert into public.critical_action_audit_log(entity_type,entity_id,action,category,actor_id,actor_email,actor_role,old_data,new_data,changed_fields)
  values('handover_item',p_item_id,'handover_item_status_changed','operations',auth.uid(),auth.jwt()->>'email',v_role,jsonb_build_object('status',v_old_status),jsonb_build_object('status',p_status),array['status']);
  return v_item;
end;
$function$;

create or replace function public.close_booking_handover(p_handover_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_handover public.booking_shift_handovers%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_role not in ('admin','approver','operator') then raise exception 'Insufficient permissions'; end if;
  select * into v_handover from public.booking_shift_handovers where id=p_handover_id for update;
  if not found then raise exception 'Handover not found'; end if;
  if not public.can_access_operational_scope('booking', v_handover.location_id) then raise exception 'Handover outside operational scope'; end if;
  if v_handover.status <> 'accepted' then raise exception 'Only accepted handovers can be closed'; end if;
  if v_role='operator' and v_handover.accepted_by is distinct from auth.uid() then raise exception 'Only the employee who accepted the handover can close it'; end if;
  if exists(select 1 from public.booking_handover_items where handover_id=p_handover_id and status in ('pending','acknowledged')) then raise exception 'Resolve or carry forward all open handover items before closing'; end if;
  update public.booking_shift_handovers set status='closed',updated_at=now() where id=p_handover_id;
  insert into public.critical_action_audit_log(entity_type,entity_id,action,category,actor_id,actor_email,actor_role,old_data,new_data,changed_fields)
  values('handover',p_handover_id,'handover_closed','operations',auth.uid(),auth.jwt()->>'email',v_role,jsonb_build_object('status','accepted'),jsonb_build_object('status','closed'),array['status']);
end;
$function$;

revoke all on function public.submit_booking_handover(uuid) from public, anon;
revoke all on function public.accept_booking_handover(uuid) from public, anon;
revoke all on function public.update_booking_handover_item_status(uuid,text) from public, anon;
revoke all on function public.close_booking_handover(uuid) from public, anon;
grant execute on function public.submit_booking_handover(uuid) to authenticated, service_role;
grant execute on function public.accept_booking_handover(uuid) to authenticated, service_role;
grant execute on function public.update_booking_handover_item_status(uuid,text) to authenticated, service_role;
grant execute on function public.close_booking_handover(uuid) to authenticated, service_role;

-- Canonical reservation logistics lifecycle for Hospitality operations.

create or replace function public.update_reservation_logistics_status(
  p_logistics_id uuid,
  p_status text
)
returns public.reservation_logistics
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text := public.current_app_role();
  v_row public.reservation_logistics%rowtype;
  v_location_id uuid;
  v_old_status text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('hospitality.operate') then raise exception 'Hospitality permission required'; end if;
  if p_status not in ('planned','confirmed','completed','cancelled') then raise exception 'Unsupported logistics status'; end if;

  select * into v_row
  from public.reservation_logistics
  where id = p_logistics_id
  for update;

  if not found then raise exception 'Logistics record not found'; end if;

  select location_id into v_location_id
  from public.reservations
  where id = v_row.reservation_id;

  if not public.can_access_operational_scope('hospitality', v_location_id) then
    raise exception 'Logistics record outside operational scope';
  end if;

  if v_row.status = 'draft' and p_status not in ('planned','cancelled') then
    raise exception 'Draft logistics can only be planned or cancelled';
  elsif v_row.status = 'planned' and p_status not in ('confirmed','cancelled') then
    raise exception 'Planned logistics can only be confirmed or cancelled';
  elsif v_row.status = 'confirmed' and p_status not in ('completed','cancelled') then
    raise exception 'Confirmed logistics can only be completed or cancelled';
  elsif v_row.status in ('completed','cancelled') then
    raise exception 'Completed or cancelled logistics are terminal';
  end if;

  v_old_status := v_row.status;

  update public.reservation_logistics
  set status = p_status,
      updated_at = now()
  where id = p_logistics_id
  returning * into v_row;

  insert into public.critical_action_audit_log(
    entity_type,entity_id,action,category,actor_id,actor_email,actor_role,
    old_data,new_data,changed_fields
  ) values (
    'reservation_logistics',p_logistics_id,'logistics_status_changed','operations',v_actor,auth.jwt()->>'email',v_role,
    jsonb_build_object('status',v_old_status),jsonb_build_object('status',p_status),array['status']
  );

  return v_row;
end;
$function$;

revoke all on function public.update_reservation_logistics_status(uuid,text) from public, anon;
grant execute on function public.update_reservation_logistics_status(uuid,text) to authenticated, service_role;

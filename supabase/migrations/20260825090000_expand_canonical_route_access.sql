-- BlackSwan Access Hardening: expand the canonical route-access snapshot.
-- Authorization remains sourced from current_app_role() and the canonical
-- effective-access RPC. Legacy JWT metadata and employee title/email checks
-- are deliberately excluded.

create or replace function public.get_current_route_access()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text;
  v_effective jsonb := '{}'::jsonb;
  v_row jsonb;
  v_admin boolean := false;
  v_has_explicit_scopes boolean := false;
  v_departments jsonb := '[]'::jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_can_approve_procurement boolean := false;
  v_capabilities jsonb := '{}'::jsonb;
  v_view_all_departments boolean := false;
  v_booking_view boolean := false;
  v_operations_view boolean := false;
  v_people_view boolean := false;
  v_places_view boolean := false;
  v_finance_view boolean := false;
  v_network_view boolean := false;
  v_procurement_view boolean := false;
  v_maintenance_view boolean := false;
  v_inventory_view boolean := false;
  v_orchard_view boolean := false;
  v_vineyard_view boolean := false;
  v_cattle_view boolean := false;
  v_fuel_view boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_role := public.current_app_role();
  v_admin := v_role = 'admin';

  -- get_current_user_effective_access is the existing canonical aggregate used
  -- by the application shell. Calling it through FROM works whether the RPC
  -- exposes a composite row or a json/jsonb scalar; normalize either shape.
  select to_jsonb(x) into v_row
  from public.get_current_user_effective_access() as x
  limit 1;

  if v_row ? 'get_current_user_effective_access' then
    v_effective := coalesce(v_row -> 'get_current_user_effective_access', '{}'::jsonb);
  else
    v_effective := coalesce(v_row, '{}'::jsonb);
  end if;

  v_departments := case when jsonb_typeof(v_effective -> 'departments') = 'array' then v_effective -> 'departments' else '[]'::jsonb end;
  v_actions := case when jsonb_typeof(v_effective -> 'allowed_actions') = 'array' then v_effective -> 'allowed_actions' else '[]'::jsonb end;
  v_has_explicit_scopes := case when jsonb_typeof(v_effective -> 'access') = 'array' then jsonb_array_length(v_effective -> 'access') > 0 else false end;
  v_view_all_departments := v_admin or not v_has_explicit_scopes;
  v_can_approve_procurement := v_admin
    or coalesce((v_effective ->> 'can_approve_procurement')::boolean, false)
    or v_role = 'approver';

  v_booking_view := v_view_all_departments or v_departments ?| array['booking','hospitality'] or v_actions ? 'booking.modify';
  v_operations_view := v_view_all_departments or v_departments ?| array['operations','booking','hospitality','maintenance','procurement'];
  v_people_view := v_view_all_departments or v_departments ?| array['administration','hr','people'];
  v_maintenance_view := v_view_all_departments or v_departments ? 'maintenance' or v_actions ? 'maintenance.operate';
  v_inventory_view := v_view_all_departments or v_departments ? 'inventory' or v_actions ? 'inventory.process';
  v_orchard_view := v_view_all_departments or v_departments ? 'orchard';
  v_vineyard_view := v_view_all_departments or v_departments ? 'vineyard';
  v_cattle_view := v_view_all_departments or v_departments ? 'cattle';
  v_fuel_view := v_view_all_departments or v_departments ? 'fuel' or v_actions ? 'fuel.review';
  v_places_view := v_view_all_departments or v_maintenance_view or v_inventory_view or v_orchard_view or v_vineyard_view or v_cattle_view or v_fuel_view;
  v_finance_view := v_view_all_departments or v_departments ? 'finance' or v_actions ? 'payments.record';
  v_network_view := v_view_all_departments or v_departments ?| array['network','events','education'];
  v_procurement_view := v_view_all_departments or v_departments ? 'procurement' or v_actions ? 'procurement.operate' or v_can_approve_procurement;

  v_capabilities := jsonb_build_object(
    'booking', case when v_admin then '["admin"]'::jsonb when v_booking_view and v_actions ? 'booking.modify' then '["operate"]'::jsonb when v_booking_view then '["view"]'::jsonb else '[]'::jsonb end,
    'operations', case when v_admin then '["admin"]'::jsonb when v_operations_view then '["view"]'::jsonb else '[]'::jsonb end,
    'people', case when v_admin then '["admin"]'::jsonb when v_people_view then '["view"]'::jsonb else '[]'::jsonb end,
    'places_assets', case when v_admin then '["admin"]'::jsonb when v_places_view then '["view"]'::jsonb else '[]'::jsonb end,
    'finance', case when v_admin then '["admin"]'::jsonb when v_finance_view then '["view"]'::jsonb else '[]'::jsonb end,
    'network', case when v_admin then '["admin"]'::jsonb when v_network_view then '["view"]'::jsonb else '[]'::jsonb end,
    'admin', case when v_admin then '["admin"]'::jsonb else '[]'::jsonb end,
    'procurement', case when v_admin then '["admin"]'::jsonb when v_can_approve_procurement then '["approve"]'::jsonb when v_actions ? 'procurement.operate' then '["operate"]'::jsonb when v_procurement_view then '["view"]'::jsonb else '[]'::jsonb end,
    'maintenance', case when v_admin then '["admin"]'::jsonb when v_actions ? 'maintenance.operate' then '["operate"]'::jsonb when v_maintenance_view then '["view"]'::jsonb else '[]'::jsonb end,
    'inventory', case when v_admin then '["admin"]'::jsonb when v_actions ? 'inventory.process' then '["operate"]'::jsonb when v_inventory_view then '["view"]'::jsonb else '[]'::jsonb end,
    'orchard', case when v_admin then '["admin"]'::jsonb when v_orchard_view then '["view"]'::jsonb else '[]'::jsonb end,
    'vineyard', case when v_admin then '["admin"]'::jsonb when v_vineyard_view then '["view"]'::jsonb else '[]'::jsonb end,
    'cattle', case when v_admin then '["admin"]'::jsonb when v_cattle_view then '["view"]'::jsonb else '[]'::jsonb end,
    'fuel', case when v_admin then '["admin"]'::jsonb when v_actions ? 'fuel.review' then '["operate"]'::jsonb when v_fuel_view then '["view"]'::jsonb else '[]'::jsonb end,
    'map', case when v_admin then '["admin"]'::jsonb when v_places_view then '["view"]'::jsonb else '[]'::jsonb end
  );

  return jsonb_build_object(
    'role_key', v_role,
    'is_admin', v_admin,
    'can_approve_procurement', v_can_approve_procurement,
    'capabilities', v_capabilities
  );
end;
$function$;

revoke all on function public.get_current_route_access() from public;
grant execute on function public.get_current_route_access() to authenticated;
grant execute on function public.get_current_route_access() to service_role;

comment on function public.get_current_route_access() is
  'Canonical authenticated route-access snapshot derived from current_app_role() and get_current_user_effective_access(); JWT metadata and person identity are not authorization sources.';

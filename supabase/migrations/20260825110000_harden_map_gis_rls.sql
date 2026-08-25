-- BlackSwan Access Hardening: canonical RLS for operational Map/GIS tables.
-- End-user reads require map:view; metadata updates require map:operate;
-- structural inserts/deletes remain admin-only. Service role keeps its normal
-- PostgreSQL RLS bypass behavior.

create or replace function public.can_view_operational_map()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_access jsonb;
  v_levels jsonb;
begin
  if auth.uid() is null then return false; end if;
  v_access := public.get_current_route_access();
  v_levels := coalesce(v_access -> 'capabilities' -> 'map', '[]'::jsonb);
  return v_levels ?| array['view','operate','approve','admin'];
exception when others then
  return false;
end;
$function$;

create or replace function public.can_operate_operational_map()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_access jsonb;
  v_levels jsonb;
begin
  if auth.uid() is null then return false; end if;
  v_access := public.get_current_route_access();
  v_levels := coalesce(v_access -> 'capabilities' -> 'map', '[]'::jsonb);
  return v_levels ?| array['operate','approve','admin'];
exception when others then
  return false;
end;
$function$;

revoke all on function public.can_view_operational_map() from public;
revoke all on function public.can_operate_operational_map() from public;
grant execute on function public.can_view_operational_map() to authenticated, service_role;
grant execute on function public.can_operate_operational_map() to authenticated, service_role;

alter table public.infrastructure_plans enable row level security;
alter table public.infrastructure_connections enable row level security;
alter table public.gis_overlays enable row level security;

-- Permissive RLS policies combine with OR semantics. Remove historical policies
-- on these three sensitive tables before installing the canonical policy set,
-- otherwise an older broad authenticated policy could bypass this hardening.
do $block$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('infrastructure_plans','infrastructure_connections','gis_overlays')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$block$;

create policy infrastructure_plans_map_read
  on public.infrastructure_plans for select to authenticated
  using (public.can_view_operational_map());
create policy infrastructure_connections_map_read
  on public.infrastructure_connections for select to authenticated
  using (public.can_view_operational_map());
create policy gis_overlays_map_read
  on public.gis_overlays for select to authenticated
  using (public.can_view_operational_map());

-- Preserve existing operational edits while keeping them behind map:operate.
create policy infrastructure_plans_map_update
  on public.infrastructure_plans for update to authenticated
  using (public.can_operate_operational_map())
  with check (public.can_operate_operational_map());
create policy infrastructure_connections_map_update
  on public.infrastructure_connections for update to authenticated
  using (public.can_operate_operational_map())
  with check (public.can_operate_operational_map());
create policy gis_overlays_map_update
  on public.gis_overlays for update to authenticated
  using (public.can_operate_operational_map())
  with check (public.can_operate_operational_map());

-- Structural creation/removal is privileged. This is intentionally separate
-- from routine metadata edits such as the Map page's overlay display color.
create policy infrastructure_plans_admin_insert
  on public.infrastructure_plans for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy infrastructure_plans_admin_delete
  on public.infrastructure_plans for delete to authenticated
  using (public.current_app_role() = 'admin');
create policy infrastructure_connections_admin_insert
  on public.infrastructure_connections for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy infrastructure_connections_admin_delete
  on public.infrastructure_connections for delete to authenticated
  using (public.current_app_role() = 'admin');
create policy gis_overlays_admin_insert
  on public.gis_overlays for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy gis_overlays_admin_delete
  on public.gis_overlays for delete to authenticated
  using (public.current_app_role() = 'admin');

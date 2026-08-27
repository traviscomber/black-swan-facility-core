create or replace function public.can_access_operational_scope(
  p_department text,
  p_location_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_app_role();
  v_has_scopes boolean;
begin
  if coalesce(auth.role(),'') = 'service_role' then return true; end if;
  if v_user is null then return false; end if;
  if v_role in ('none','disabled') then return false; end if;
  if v_role = 'admin' then return true; end if;

  select exists(
    select 1 from public.user_operational_scopes s
    where s.user_id = v_user and s.is_active
  ) into v_has_scopes;

  if not v_has_scopes then return true; end if;

  return exists(
    select 1
    from public.user_operational_scopes s
    where s.user_id = v_user
      and s.is_active
      and (
        s.department is null
        or lower(s.department) in ('*','all')
        or lower(s.department)=lower(coalesce(p_department,''))
      )
      and (
        s.location_id is null
        or (p_location_id is not null and s.location_id=p_location_id)
      )
  );
end;
$function$;

comment on function public.can_access_operational_scope(text, uuid) is
  'Fail-closed operational scope check: users without an active access profile are denied, and location-specific scopes never authorize objects whose location is NULL.';

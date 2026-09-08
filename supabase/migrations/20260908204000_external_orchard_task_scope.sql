create or replace function public.can_access_operational_task_scope(p_operational_area text, p_location_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_has_scopes boolean;
  v_department text := coalesce(nullif(trim(p_operational_area), ''), 'tasks');
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;
  if auth.uid() is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if v_role = 'operator' then
    return public.is_external_orchard_user()
      and lower(v_department) in ('orchard','huerto_vinedo')
      and p_location_id is not null
      and public.can_access_external_orchard_location(p_location_id);
  end if;
  if v_role <> 'approver' then
    return false;
  end if;

  select exists(
    select 1
    from public.user_operational_scopes s
    where s.user_id = auth.uid() and s.is_active
  ) into v_has_scopes;

  if not v_has_scopes then
    return true;
  end if;

  if p_location_id is null then
    return false;
  end if;

  return public.can_access_operational_scope(v_department, p_location_id);
end;
$$;

create or replace function public.list_maintenance_assignees()
returns table(employee_id uuid, employee_name text, employee_role text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.can_app_action('maintenance.operate') then
    raise exception 'Maintenance permission required';
  end if;

  return query
  select e.id, e.name, e.role
  from public.employees e
  where coalesce(e.is_active, true)
  order by e.name;
end;
$$;

revoke all on function public.list_maintenance_assignees() from public, anon;
grant execute on function public.list_maintenance_assignees() to authenticated;

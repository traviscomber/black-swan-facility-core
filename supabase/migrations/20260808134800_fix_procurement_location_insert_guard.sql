create or replace function public.guard_procurement_request_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    if coalesce(auth.role(), '') = 'service_role' then
      return new;
    end if;
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    if new.location_id is null then
      raise exception 'Canonical procurement location is required';
    end if;
    if not public.can_access_operational_scope('procurement', new.location_id) then
      raise exception 'Procurement location is outside your operational scope';
    end if;
    return new;
  end if;

  if new.location_id is distinct from old.location_id
     and new.location_id is not null
     and not public.can_access_operational_scope('procurement', new.location_id) then
    raise exception 'Procurement location is outside your operational scope';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_procurement_request_location() from public, anon, authenticated;
grant execute on function public.guard_procurement_request_location() to service_role;

begin;

-- Stage 6: preserve unreconciled legacy fuel history while requiring every
-- future fuel write to carry a canonical operational location.
create or replace function public.enforce_fuel_consumption_location_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.location_id is null then
    raise exception 'canonical location is required for new fuel consumption';
  end if;

  if tg_op = 'UPDATE'
     and old.location_id is not null
     and new.location_id is null then
    raise exception 'canonical location cannot be removed from fuel consumption';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_fuel_consumption_location_guard() from public, anon, authenticated;

drop trigger if exists fuel_consumption_location_guard on public.fuel_consumption;
create trigger fuel_consumption_location_guard
before insert or update of location_id on public.fuel_consumption
for each row execute function public.enforce_fuel_consumption_location_guard();

-- Canonical location directory for Fuel. The operational scope helper keeps
-- users limited to locations they can act on while admins retain full access.
create or replace function public.get_fuel_location_directory()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id, l.name
  from public.locations l
  where auth.uid() is not null
    and public.can_app_action('fuel.review')
    and public.can_access_operational_scope('fuel', l.id)
  order by l.name;
$$;

revoke all on function public.get_fuel_location_directory() from public, anon;
grant execute on function public.get_fuel_location_directory() to authenticated;

-- Legacy rows with no canonical location remain visible only to actors whose
-- Fuel scope is broad enough to evaluate a NULL location. Canonical rows are
-- always evaluated against their concrete location_id.
drop policy if exists fuel_consumption_select_scoped on public.fuel_consumption;
create policy fuel_consumption_select_scoped
on public.fuel_consumption
for select
to authenticated
using (
  public.can_app_action('fuel.review')
  and (
    (location_id is null and public.can_access_operational_scope('fuel', null))
    or
    (location_id is not null and public.can_access_operational_scope('fuel', location_id))
  )
);

drop policy if exists fuel_consumption_insert_authorized on public.fuel_consumption;
create policy fuel_consumption_insert_authorized
on public.fuel_consumption
for insert
to authenticated
with check (
  public.can_app_action('fuel.review')
  and location_id is not null
  and public.can_access_operational_scope('fuel', location_id)
);

drop policy if exists fuel_consumption_update_authorized on public.fuel_consumption;
create policy fuel_consumption_update_authorized
on public.fuel_consumption
for update
to authenticated
using (
  public.can_app_action('fuel.review')
  and (
    (location_id is null and public.can_access_operational_scope('fuel', null))
    or
    (location_id is not null and public.can_access_operational_scope('fuel', location_id))
  )
)
with check (
  public.can_app_action('fuel.review')
  and (
    (location_id is null and public.can_access_operational_scope('fuel', null))
    or
    (location_id is not null and public.can_access_operational_scope('fuel', location_id))
  )
);

-- review_fuel_consumption is SECURITY DEFINER, so it must perform the same
-- location-scope check itself instead of relying on the caller's RLS policy.
create or replace function public.review_fuel_consumption(
  p_fuel_consumption_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.fuel_consumption
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_previous text;
  v_location_id uuid;
  v_result public.fuel_consumption;
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if not public.can_app_action('fuel.review') then
    raise exception 'insufficient privileges';
  end if;

  if p_decision not in ('verified', 'rejected', 'pending') then
    raise exception 'invalid decision';
  end if;

  if p_decision = 'rejected'
     and nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'rejection notes are required';
  end if;

  select validation_status, location_id
    into v_previous, v_location_id
  from public.fuel_consumption
  where id = p_fuel_consumption_id
  for update;

  if not found then
    raise exception 'fuel record not found';
  end if;

  if not public.can_access_operational_scope('fuel', v_location_id) then
    raise exception 'fuel record is outside operational scope';
  end if;

  update public.fuel_consumption
  set validation_status = p_decision,
      validation_notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_verified = (p_decision = 'verified'),
      verified_by = case when p_decision = 'verified' then v_actor else null end,
      verified_at = case when p_decision = 'verified' then now()::timestamp else null end,
      rejected_by = case when p_decision = 'rejected' then v_actor else null end,
      rejected_at = case when p_decision = 'rejected' then now() else null end,
      updated_at = now()::timestamp
  where id = p_fuel_consumption_id
  returning * into v_result;

  insert into public.fuel_validation_events(
    fuel_consumption_id,
    previous_status,
    new_status,
    notes,
    actor_id
  )
  values (
    p_fuel_consumption_id,
    v_previous,
    p_decision,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_actor
  );

  return v_result;
end;
$$;

commit;

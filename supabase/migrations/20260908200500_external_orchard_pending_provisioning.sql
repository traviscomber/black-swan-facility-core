create schema if not exists app_private;

create table if not exists app_private.external_orchard_pending_access (
  email text primary key,
  location_id uuid not null references public.locations(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

revoke all on schema app_private from public, anon, authenticated;
revoke all on all tables in schema app_private from public, anon, authenticated;

create or replace function public.apply_pending_external_orchard_access()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_pending app_private.external_orchard_pending_access%rowtype;
begin
  if new.email is null then
    return new;
  end if;

  select * into v_pending
  from app_private.external_orchard_pending_access
  where lower(email) = lower(new.email)
  limit 1;

  if not found then
    return new;
  end if;

  insert into public.user_access_profiles(
    user_id,email,role_key,is_active,os_persona_key,os_primary_domain,os_start_path
  ) values (
    new.id,new.email,'operator',true,'external_orchard','orchard','/orchard/getting-started'
  )
  on conflict (user_id) do update set
    email = excluded.email,
    role_key = excluded.role_key,
    is_active = true,
    os_persona_key = excluded.os_persona_key,
    os_primary_domain = excluded.os_primary_domain,
    os_start_path = excluded.os_start_path,
    updated_at = now();

  update public.user_operational_scopes
  set is_active = false
  where user_id = new.id;

  insert into public.user_operational_scopes(
    user_id,department,location_id,is_active,notes
  ) values (
    new.id,'orchard',v_pending.location_id,true,'External Orchard-only access'
  );

  delete from app_private.external_orchard_pending_access
  where lower(email) = lower(new.email);

  return new;
end;
$$;

revoke execute on function public.apply_pending_external_orchard_access() from public, anon, authenticated;

drop trigger if exists trg_apply_pending_external_orchard_access on auth.users;
create trigger trg_apply_pending_external_orchard_access
after insert or update of email on auth.users
for each row execute function public.apply_pending_external_orchard_access();
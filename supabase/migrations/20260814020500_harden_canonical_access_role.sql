-- Black Swan OS Phase 1: canonical authorization role source
--
-- Production audit on 2026-08-13 confirmed every current auth.users row has a
-- corresponding public.user_access_profiles row. This migration removes the
-- legacy JWT app_metadata role fallback so authorization can no longer drift
-- between two independent sources of truth.
--
-- This migration is intentionally not auto-applied by the application. Review
-- and apply through the normal Supabase migration workflow after regression
-- testing.

create or replace function public.current_app_role()
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_profile public.user_access_profiles%rowtype;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return 'service_role';
  end if;

  if auth.uid() is null then
    return 'none';
  end if;

  select *
  into v_profile
  from public.user_access_profiles
  where user_id = auth.uid();

  if not found then
    return 'none';
  end if;

  if not v_profile.is_active then
    return 'disabled';
  end if;

  return v_profile.role_key;
end;
$function$;

comment on function public.current_app_role() is
  'Returns the canonical Black Swan application role from user_access_profiles. JWT app_metadata is not an authorization source.';

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_role() to service_role;

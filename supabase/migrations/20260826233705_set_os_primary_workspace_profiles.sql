alter table public.user_access_profiles
  add column if not exists os_primary_domain text,
  add column if not exists os_start_path text;

alter table public.user_access_profiles
  drop constraint if exists user_access_profiles_os_start_path_check;

alter table public.user_access_profiles
  add constraint user_access_profiles_os_start_path_check
  check (os_start_path is null or (left(os_start_path, 1) = '/' and left(os_start_path, 2) <> '//'));

comment on column public.user_access_profiles.os_primary_domain is
  'UX context for primary operational responsibility. Never grants authorization.';

comment on column public.user_access_profiles.os_start_path is
  'UX landing path after login or OS home navigation. Never grants authorization; target route is still capability/RLS protected.';

update public.user_access_profiles
set os_primary_domain = 'hospitality',
    os_start_path = '/bookings',
    updated_at = now()
where lower(email) = 'santiago@blackswn.org';

update public.user_access_profiles
set os_primary_domain = 'operations',
    os_start_path = '/os',
    updated_at = now()
where lower(email) = 'raimundo@blackswn.org';

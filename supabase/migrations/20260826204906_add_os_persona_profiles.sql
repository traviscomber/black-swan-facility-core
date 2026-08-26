alter table public.user_access_profiles
  add column if not exists os_persona_key text;

alter table public.user_access_profiles
  drop constraint if exists user_access_profiles_os_persona_key_check;

alter table public.user_access_profiles
  add constraint user_access_profiles_os_persona_key_check
  check (os_persona_key is null or os_persona_key in ('executive', 'field_admin', 'general'));

comment on column public.user_access_profiles.os_persona_key is
  'UX-only Black Swan OS persona. Never use for authorization; permissions remain governed by role/capability/scope.';

update public.user_access_profiles
set os_persona_key = 'executive', updated_at = now()
where lower(email) = 'santiago@blackswn.org';

update public.user_access_profiles
set os_persona_key = 'field_admin', updated_at = now()
where lower(email) = 'raimundo@blackswn.org';

-- Give Santiago a focused daily workspace: booking first, finance second.
alter table public.user_access_profiles
  drop constraint if exists user_access_profiles_os_persona_key_check;

alter table public.user_access_profiles
  add constraint user_access_profiles_os_persona_key_check
  check (
    os_persona_key is null
    or os_persona_key in ('executive','field_admin','general','external_orchard','santiago','raimundo')
  );

update public.user_access_profiles
set os_persona_key='santiago',
    os_start_path='/os',
    updated_at=now()
where lower(email)='santiago@blackswn.org'
  and is_active;


update public.user_access_profiles
set os_persona_key='raimundo',
    os_start_path='/os',
    updated_at=now()
where lower(email)='raimundo@blackswn.org'
  and is_active;

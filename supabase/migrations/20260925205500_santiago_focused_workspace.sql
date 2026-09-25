-- Give Santiago a focused daily workspace: booking first, finance second.
update public.user_access_profiles
set os_persona_key='santiago',
    os_start_path='/os',
    updated_at=now()
where lower(email)='santiago@blackswn.org'
  and is_active;

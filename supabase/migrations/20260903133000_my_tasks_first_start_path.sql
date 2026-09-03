alter table public.user_access_profiles
  alter column os_start_path set default '/my-tasks';

update public.user_access_profiles
set os_start_path = '/my-tasks',
    updated_at = now()
where is_active
  and employee_id is not null
  and os_start_path is distinct from '/my-tasks';

alter table public.user_access_profiles
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

create unique index if not exists user_access_profiles_employee_id_uidx
  on public.user_access_profiles(employee_id)
  where employee_id is not null;

comment on column public.user_access_profiles.employee_id is
  'Canonical employee identity for personal OS work queues. This mapping is context only and never grants authorization.';

update public.user_access_profiles uap
set employee_id = e.id,
    updated_at = now()
from public.employees e
where uap.employee_id is null
  and e.is_active = true
  and uap.email is not null
  and e.email is not null
  and lower(uap.email) = lower(e.email);

update public.user_access_profiles uap
set employee_id = e.id,
    updated_at = now()
from public.employees e
where lower(uap.email) = 'santiago@blackswn.org'
  and e.name = 'Santiago Colvin Bongardt'
  and e.is_active = true;

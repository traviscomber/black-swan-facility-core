-- Explicit employee ↔ Asana identity links remove domain/name heuristics and let
-- ordinary Black Swan users read only their own current Asana rows.

create table if not exists public.asana_identity_links (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  asana_user_gid text not null unique,
  asana_email text not null unique,
  is_active boolean not null default true,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asana_identity_links enable row level security;

grant select, insert, update, delete on public.asana_identity_links to authenticated;

create policy asana_identity_links_read
  on public.asana_identity_links
  for select
  to authenticated
  using (
    public.current_app_role() = any (array['admin'::text, 'approver'::text])
    or exists (
      select 1
      from public.user_access_profiles uap
      where uap.user_id = auth.uid()
        and uap.employee_id = asana_identity_links.employee_id
        and uap.is_active = true
    )
  );

create policy asana_identity_links_write
  on public.asana_identity_links
  for all
  to authenticated
  using (public.current_app_role() = any (array['admin'::text, 'approver'::text]))
  with check (public.current_app_role() = any (array['admin'::text, 'approver'::text]));

insert into public.asana_identity_links (employee_id, asana_user_gid, asana_email)
select id, '1218240899966254', 'travis@blackswn.org'
from public.employees
where lower(btrim(name)) = 'juan vial'
  and lower(btrim(email)) = 'juan@n3uralia.com'
on conflict (employee_id) do update set
  asana_user_gid = excluded.asana_user_gid,
  asana_email = excluded.asana_email,
  is_active = true,
  verified_at = now(),
  updated_at = now();

insert into public.asana_identity_links (employee_id, asana_user_gid, asana_email)
select id, '1205952889360086', 'raimundo@blackswn.org'
from public.employees
where lower(btrim(email)) = 'raimundo@blackswn.org'
on conflict (employee_id) do update set
  asana_user_gid = excluded.asana_user_gid,
  asana_email = excluded.asana_email,
  is_active = true,
  verified_at = now(),
  updated_at = now();

insert into public.asana_identity_links (employee_id, asana_user_gid, asana_email)
select id, '1205952888654506', 'tomas@blackswn.org'
from public.employees
where lower(btrim(email)) = 'tomas@blackswn.org'
on conflict (employee_id) do update set
  asana_user_gid = excluded.asana_user_gid,
  asana_email = excluded.asana_email,
  is_active = true,
  verified_at = now(),
  updated_at = now();

insert into public.asana_identity_links (employee_id, asana_user_gid, asana_email)
select id, '1210172160658640', 'antonia@blackswn.org'
from public.employees
where lower(btrim(email)) = 'antonia@blackswn.org'
on conflict (employee_id) do update set
  asana_user_gid = excluded.asana_user_gid,
  asana_email = excluded.asana_email,
  is_active = true,
  verified_at = now(),
  updated_at = now();

create policy asana_current_tasks_self_read
  on public.asana_current_tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_access_profiles uap
      join public.asana_identity_links ail on ail.employee_id = uap.employee_id
      where uap.user_id = auth.uid()
        and uap.is_active = true
        and ail.is_active = true
        and lower(ail.asana_email) = lower(asana_current_tasks.assignee_email)
    )
  );

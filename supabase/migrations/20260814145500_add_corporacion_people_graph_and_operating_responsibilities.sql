-- Black Swan Corporacion: unified People Graph and operational responsibility model.
-- Members are the root. Guests are represented through member invitations, not as a parallel people domain.
-- Named responsibility (e.g. Didi/Carlos) is assigned only after matching canonical employee records.

create table if not exists public.corporacion_operating_responsibilities (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  department_id uuid not null references public.entity_departments(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete restrict,
  responsibility_type text not null,
  scope text not null,
  can_request_purchases boolean not null default false,
  can_manage_costs boolean not null default false,
  effective_from date,
  effective_to date,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporacion_responsibility_type_check check (responsibility_type in ('lead','operator','purchaser','reviewer')),
  constraint corporacion_responsibility_scope_check check (scope in ('orchard','kitchen','orchard_kitchen','events','operations','other')),
  constraint corporacion_responsibility_dates_check check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index if not exists corporacion_operating_responsibilities_scope_idx
  on public.corporacion_operating_responsibilities(legal_entity_id, scope, responsibility_type);

create or replace view public.corporacion_people_graph as
select
  m.id as member_id,
  m.full_name as member_name,
  m.status as membership_status,
  m.email as member_email,
  m.phone as member_phone,
  mp.location_id as member_current_location_id,
  mp.checked_in_at as member_checked_in_at,
  gi.id as invitation_id,
  gi.status as invitation_status,
  gi.valid_from,
  gi.valid_until,
  g.id as guest_id,
  g.name as guest_name,
  g.email as guest_email,
  g.phone as guest_phone,
  gi.event_id,
  public.is_member_on_ground(m.id, now()) as inviting_member_on_ground
from public.members m
left join lateral (
  select p.location_id, p.checked_in_at
  from public.member_presence p
  where p.member_id = m.id and p.status = 'on_ground' and p.checked_out_at is null
  order by p.checked_in_at desc
  limit 1
) mp on true
left join public.guest_invitations gi on gi.inviting_member_id = m.id
left join public.guests g on g.id = gi.guest_id;

alter table public.corporacion_operating_responsibilities enable row level security;

create policy corporacion_responsibilities_view
  on public.corporacion_operating_responsibilities for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));
create policy corporacion_responsibilities_operate
  on public.corporacion_operating_responsibilities for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'operate'))
  with check (public.can_access_legal_entity(legal_entity_id, 'operate'));

comment on view public.corporacion_people_graph is 'Member-rooted People Graph. Guests only appear through invitations from members, including current on-ground presence context.';
comment on table public.corporacion_operating_responsibilities is 'Operational ownership including Orchard & Kitchen leadership/purchasing. Employee IDs are assigned only after canonical employee matching.';

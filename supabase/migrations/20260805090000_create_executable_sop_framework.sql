begin;

create table if not exists public.sop_procedures (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  domain text not null,
  owner_role text,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  review_frequency_days integer check (review_frequency_days is null or review_frequency_days > 0),
  next_review_date date,
  risk_level text not null default 'normal',
  ppe_requirements text[] not null default '{}',
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sop_versions (
  id uuid primary key default gen_random_uuid(),
  sop_procedure_id uuid not null references public.sop_procedures(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','active','superseded')),
  objective text,
  scope text,
  prerequisites text,
  required_materials text[] not null default '{}',
  acceptance_criteria text,
  exception_instructions text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz not null default now(),
  unique (sop_procedure_id, version_number)
);

create unique index if not exists sop_versions_one_active_idx on public.sop_versions(sop_procedure_id) where status = 'active';

create table if not exists public.sop_steps (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.sop_versions(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  title text not null,
  instruction text not null,
  is_required boolean not null default true,
  requires_evidence boolean not null default false,
  evidence_type text,
  requires_approval boolean not null default false,
  expected_minutes integer check (expected_minutes is null or expected_minutes > 0),
  checklist_items jsonb not null default '[]'::jsonb,
  safety_notes text,
  unique (sop_version_id, step_number)
);

create table if not exists public.sop_document_bindings (
  id uuid primary key default gen_random_uuid(),
  sop_procedure_id uuid not null references public.sop_procedures(id) on delete cascade,
  document_type text,
  line_type text,
  resource_type text,
  trigger_event text not null,
  offset_minutes integer not null default 0,
  default_priority text not null default 'medium',
  default_responsible_role text,
  is_active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sop_executions (
  id uuid primary key default gen_random_uuid(),
  execution_number text not null unique default public.next_document_number('sop_execution', 'SOPX', extract(year from now())::integer),
  sop_procedure_id uuid not null references public.sop_procedures(id),
  sop_version_id uuid not null references public.sop_versions(id),
  operational_document_id uuid references public.operational_documents(id) on delete set null,
  operational_document_line_id uuid references public.operational_document_lines(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed','cancelled')),
  assigned_to uuid,
  scheduled_for timestamptz,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  blocked_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sop_execution_steps (
  id uuid primary key default gen_random_uuid(),
  sop_execution_id uuid not null references public.sop_executions(id) on delete cascade,
  sop_step_id uuid not null references public.sop_steps(id),
  step_number integer not null,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed','skipped')),
  result jsonb not null default '{}'::jsonb,
  evidence_urls text[] not null default '{}',
  completed_at timestamptz,
  completed_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  exception_reason text,
  unique (sop_execution_id, sop_step_id)
);

alter table public.tasks add column if not exists sop_execution_id uuid references public.sop_executions(id) on delete set null;
alter table public.tasks add column if not exists operational_document_id uuid references public.operational_documents(id) on delete set null;
alter table public.tasks add column if not exists operational_document_line_id uuid references public.operational_document_lines(id) on delete set null;

create index if not exists sop_procedures_domain_status_idx on public.sop_procedures(domain, status);
create index if not exists sop_steps_version_idx on public.sop_steps(sop_version_id, step_number);
create index if not exists sop_bindings_trigger_idx on public.sop_document_bindings(trigger_event, is_active);
create index if not exists sop_executions_document_idx on public.sop_executions(operational_document_id);
create index if not exists sop_executions_task_idx on public.sop_executions(task_id);
create index if not exists sop_executions_status_due_idx on public.sop_executions(status, due_at);
create index if not exists sop_execution_steps_execution_idx on public.sop_execution_steps(sop_execution_id, step_number);
create index if not exists tasks_operational_document_idx on public.tasks(operational_document_id);
create index if not exists tasks_sop_execution_idx on public.tasks(sop_execution_id);

create or replace function public.instantiate_sop_execution(
  p_sop_procedure_id uuid,
  p_operational_document_id uuid default null,
  p_operational_document_line_id uuid default null,
  p_scheduled_for timestamptz default now(),
  p_due_at timestamptz default null,
  p_assigned_to uuid default null,
  p_priority text default 'medium',
  p_created_by uuid default auth.uid()
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_version_id uuid;
  v_execution_id uuid;
  v_task_id uuid;
  v_title text;
  v_domain text;
begin
  select v.id, p.title, p.domain into v_version_id, v_title, v_domain
  from public.sop_procedures p
  join public.sop_versions v on v.sop_procedure_id = p.id and v.status = 'active'
  where p.id = p_sop_procedure_id and p.status = 'active';
  if v_version_id is null then raise exception 'Active SOP version not found'; end if;

  insert into public.tasks(title, description, priority, status, due_date, created_by, created_at, operational_area, task_category, source_type, source_id, operational_document_id, operational_document_line_id)
  values (v_title, 'Ejecución de procedimiento ' || v_title, coalesce(p_priority,'medium'), 'pending', p_due_at::date, p_created_by, now(), v_domain, 'sop', 'operational_document', coalesce(p_operational_document_line_id,p_operational_document_id), p_operational_document_id, p_operational_document_line_id)
  returning id into v_task_id;

  insert into public.sop_executions(sop_procedure_id, sop_version_id, operational_document_id, operational_document_line_id, task_id, assigned_to, scheduled_for, due_at, created_by)
  values (p_sop_procedure_id, v_version_id, p_operational_document_id, p_operational_document_line_id, v_task_id, p_assigned_to, p_scheduled_for, p_due_at, p_created_by)
  returning id into v_execution_id;

  insert into public.sop_execution_steps(sop_execution_id, sop_step_id, step_number)
  select v_execution_id, s.id, s.step_number from public.sop_steps s where s.sop_version_id = v_version_id order by s.step_number;
  update public.tasks set sop_execution_id = v_execution_id where id = v_task_id;
  if p_assigned_to is not null then insert into public.task_assignments(task_id, employee_id, assigned_at) values (v_task_id, p_assigned_to, now()); end if;
  return v_execution_id;
end;
$$;

revoke all on function public.instantiate_sop_execution(uuid, uuid, uuid, timestamptz, timestamptz, uuid, text, uuid) from public;
grant execute on function public.instantiate_sop_execution(uuid, uuid, uuid, timestamptz, timestamptz, uuid, text, uuid) to authenticated, service_role;

alter table public.sop_procedures enable row level security;
alter table public.sop_versions enable row level security;
alter table public.sop_steps enable row level security;
alter table public.sop_document_bindings enable row level security;
alter table public.sop_executions enable row level security;
alter table public.sop_execution_steps enable row level security;

create policy sop_procedures_read on public.sop_procedures for select to authenticated using (true);
create policy sop_procedures_manage on public.sop_procedures for all to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver'])) with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver']));
create policy sop_versions_read on public.sop_versions for select to authenticated using (true);
create policy sop_versions_manage on public.sop_versions for all to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver'])) with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver']));
create policy sop_steps_read on public.sop_steps for select to authenticated using (true);
create policy sop_steps_manage on public.sop_steps for all to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver'])) with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver']));
create policy sop_bindings_read on public.sop_document_bindings for select to authenticated using (true);
create policy sop_bindings_manage on public.sop_document_bindings for all to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver'])) with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any(array['admin','approver']));

create policy sop_executions_read on public.sop_executions for select to authenticated using (operational_document_id is null or exists (select 1 from public.operational_documents d where d.id = operational_document_id and can_access_operational_scope('booking', d.location_id)));
create policy sop_executions_create on public.sop_executions for insert to authenticated with check (operational_document_id is null or exists (select 1 from public.operational_documents d where d.id = operational_document_id and can_app_action('booking.modify') and can_access_operational_scope('booking', d.location_id)));
create policy sop_executions_update on public.sop_executions for update to authenticated using (operational_document_id is null or exists (select 1 from public.operational_documents d where d.id = operational_document_id and can_app_action('booking.modify') and can_access_operational_scope('booking', d.location_id))) with check (operational_document_id is null or exists (select 1 from public.operational_documents d where d.id = operational_document_id and can_app_action('booking.modify') and can_access_operational_scope('booking', d.location_id)));
create policy sop_executions_delete on public.sop_executions for delete to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = 'admin');
create policy sop_execution_steps_read on public.sop_execution_steps for select to authenticated using (exists (select 1 from public.sop_executions e where e.id = sop_execution_id));
create policy sop_execution_steps_create on public.sop_execution_steps for insert to authenticated with check (exists (select 1 from public.sop_executions e where e.id = sop_execution_id));
create policy sop_execution_steps_update on public.sop_execution_steps for update to authenticated using (exists (select 1 from public.sop_executions e where e.id = sop_execution_id)) with check (exists (select 1 from public.sop_executions e where e.id = sop_execution_id));
create policy sop_execution_steps_delete on public.sop_execution_steps for delete to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = 'admin');

grant select, insert, update, delete on public.sop_procedures, public.sop_versions, public.sop_steps, public.sop_document_bindings, public.sop_executions, public.sop_execution_steps to authenticated;
grant all on public.sop_procedures, public.sop_versions, public.sop_steps, public.sop_document_bindings, public.sop_executions, public.sop_execution_steps to service_role;

commit;

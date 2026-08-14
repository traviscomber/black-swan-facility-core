-- Black Swan Corporacion: Orchard & Kitchen cost/purchasing domain and event service-provider inventory.
-- Additive only. Existing orchard, kitchen, procurement, supplier and event records remain canonical.

with corp as (
  select id from public.legal_entities where code = 'BS_CORPORACION'
)
insert into public.entity_departments (legal_entity_id, code, name)
select id, 'ORCHARD_KITCHEN', 'Orchard & Kitchen'
from corp
on conflict (legal_entity_id, code) do update
set name = excluded.name, is_active = true, updated_at = now();

create table if not exists public.corporacion_operating_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  department_id uuid not null references public.entity_departments(id) on delete restrict,
  cost_domain text not null,
  procurement_request_id uuid references public.procurement_requests(id) on delete set null,
  accounting_document_id uuid references public.accounting_documents(id) on delete set null,
  event_id uuid references public.operational_events(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  amount_clp numeric,
  incurred_on date,
  description text,
  source_type text not null default 'manual',
  status text not null default 'proposed',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  constraint corporacion_operating_cost_domain_check check (cost_domain in ('orchard','kitchen','shared')),
  constraint corporacion_operating_cost_source_check check (source_type in ('manual','procurement','accounting_document','event')),
  constraint corporacion_operating_cost_status_check check (status in ('proposed','reviewed','approved','rejected')),
  constraint corporacion_operating_cost_amount_check check (amount_clp is null or amount_clp >= 0)
);

create index if not exists corporacion_operating_cost_allocations_lookup_idx
  on public.corporacion_operating_cost_allocations(legal_entity_id, department_id, cost_domain, incurred_on desc);

create table if not exists public.event_service_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  service_category text not null,
  service_description text,
  contact_notes text,
  coverage_area text,
  capacity_notes text,
  compliance_status text not null default 'unverified',
  preferred boolean not null default false,
  is_active boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, legal_entity_id, service_category),
  constraint event_service_provider_compliance_check check (compliance_status in ('unverified','pending','approved','restricted','inactive'))
);

create table if not exists public.event_service_provider_engagements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.operational_events(id) on delete cascade,
  provider_profile_id uuid not null references public.event_service_provider_profiles(id) on delete restrict,
  budget_item_id uuid references public.operational_event_budget_items(id) on delete set null,
  procurement_request_id uuid references public.procurement_requests(id) on delete set null,
  scope_of_work text,
  estimated_amount_clp numeric,
  actual_amount_clp numeric,
  status text not null default 'planned',
  responsible_user_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_provider_engagement_status_check check (status in ('planned','requested','quoted','approved','contracted','delivered','cancelled')),
  constraint event_provider_estimated_amount_check check (estimated_amount_clp is null or estimated_amount_clp >= 0),
  constraint event_provider_actual_amount_check check (actual_amount_clp is null or actual_amount_clp >= 0)
);

create index if not exists event_service_provider_profiles_category_idx
  on public.event_service_provider_profiles(legal_entity_id, service_category, is_active);
create index if not exists event_service_provider_engagements_event_idx
  on public.event_service_provider_engagements(event_id, status);

alter table public.corporacion_operating_cost_allocations enable row level security;
alter table public.event_service_provider_profiles enable row level security;
alter table public.event_service_provider_engagements enable row level security;

create policy corporacion_costs_finance_select
  on public.corporacion_operating_cost_allocations for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'));
create policy corporacion_costs_finance_write
  on public.corporacion_operating_cost_allocations for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'finance'))
  with check (public.can_access_legal_entity(legal_entity_id, 'finance'));

create policy event_provider_profiles_accessible
  on public.event_service_provider_profiles for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));
create policy event_provider_profiles_operate
  on public.event_service_provider_profiles for all to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'operate'))
  with check (public.can_access_legal_entity(legal_entity_id, 'operate'));

create policy event_provider_engagements_corporacion_select
  on public.event_service_provider_engagements for select to authenticated
  using (exists (
    select 1 from public.legal_entities le
    where le.code='BS_CORPORACION' and public.can_access_legal_entity(le.id, 'view')
  ));
create policy event_provider_engagements_corporacion_operate
  on public.event_service_provider_engagements for all to authenticated
  using (exists (
    select 1 from public.legal_entities le
    where le.code='BS_CORPORACION' and public.can_access_legal_entity(le.id, 'operate')
  ))
  with check (exists (
    select 1 from public.legal_entities le
    where le.code='BS_CORPORACION' and public.can_access_legal_entity(le.id, 'operate')
  ));

comment on table public.corporacion_operating_cost_allocations is 'Corporacion operating-cost allocation layer for Orchard & Kitchen, including shared costs and purchasing provenance.';
comment on table public.event_service_provider_profiles is 'Inventory of external service providers available for Black Swan events, backed by canonical suppliers.';
comment on table public.event_service_provider_engagements is 'Event-specific engagement history for external service providers, linked to budget and procurement where available.';
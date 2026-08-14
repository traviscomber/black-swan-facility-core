-- Black Swan OS: canonical legal-entity foundation
--
-- This migration is additive. It does not assign existing employees, assets,
-- inventory, suppliers, procurement records, invoices, or payments to a legal
-- entity. Those assignments require canonical source data and explicit review.
--
-- Legal ownership, operating company, physical location, cost center, and
-- responsible department are intentionally modeled as separate dimensions.

create table if not exists public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  legal_name text not null,
  display_name text not null,
  entity_type text not null,
  country_code text not null default 'CL',
  functional_currency text not null default 'CLP',
  is_commercial boolean not null default true,
  is_nonprofit boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_entities_code_format check (code ~ '^[A-Z0-9_]+$'),
  constraint legal_entities_type_check check (entity_type in ('holding','agriculture','company','nonprofit'))
);

insert into public.legal_entities (code, legal_name, display_name, entity_type, is_commercial, is_nonprofit)
values
  ('BLUE_MARBLE', 'Blue Marble Holding', 'Blue Marble Holding', 'holding', false, false),
  ('AGRICOLA', 'Agricola', 'Agricola', 'agriculture', true, false),
  ('BS_INFRA', 'Black Swan Infra SpA', 'Black Swan Infra', 'company', true, false),
  ('BS_CORPORACION', 'Black Swan Corporacion', 'Black Swan Corporacion', 'nonprofit', false, true)
on conflict (code) do update
set legal_name = excluded.legal_name,
    display_name = excluded.display_name,
    entity_type = excluded.entity_type,
    is_commercial = excluded.is_commercial,
    is_nonprofit = excluded.is_nonprofit,
    updated_at = now();

create table if not exists public.entity_departments (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, code)
);

with entity_map as (
  select id, code from public.legal_entities
), department_seed(entity_code, department_code, department_name) as (
  values
    ('BLUE_MARBLE','ACCOUNTING','Accounting'),
    ('BLUE_MARBLE','LEGAL','Legal'),

    ('AGRICOLA','ACCOUNTING','Accounting'),
    ('AGRICOLA','LEGAL','Legal'),
    ('AGRICOLA','HR','HR'),
    ('AGRICOLA','ASSETS','Assets'),
    ('AGRICOLA','CATTLE','Cattle'),
    ('AGRICOLA','VINEYARD','Vineyard'),
    ('AGRICOLA','SALES_MARKETING','Sales & Marketing'),

    ('BS_INFRA','ACCOUNTING_TAX','Accounting & Tax'),
    ('BS_INFRA','LEGAL','Legal'),
    ('BS_INFRA','HR','HR'),
    ('BS_INFRA','ASSETS','Assets'),
    ('BS_INFRA','INVENTORY','Inventory'),
    ('BS_INFRA','PROJECTS','Projects & Construction'),

    ('BS_CORPORACION','ACCOUNTING_DONATIONS','Accounting & Donations'),
    ('BS_CORPORACION','LEGAL','Legal'),
    ('BS_CORPORACION','HR','HR'),
    ('BS_CORPORACION','OPERATIONS','Operations'),
    ('BS_CORPORACION','MAINTENANCE','Maintenance'),
    ('BS_CORPORACION','ASSETS','Assets'),
    ('BS_CORPORACION','MEMBERS_GUESTS','Members & Guest Management'),
    ('BS_CORPORACION','SALES_MARKETING_EDUCATION','Sales, Marketing & Education'),
    ('BS_CORPORACION','EVENTS','Events')
)
insert into public.entity_departments (legal_entity_id, code, name)
select e.id, d.department_code, d.department_name
from department_seed d
join entity_map e on e.code = d.entity_code
on conflict (legal_entity_id, code) do update
set name = excluded.name,
    is_active = true,
    updated_at = now();

create table if not exists public.user_legal_entity_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  access_level text not null default 'view',
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  notes text,
  unique (user_id, legal_entity_id),
  constraint user_legal_entity_access_level_check check (access_level in ('view','operate','finance','admin')),
  constraint user_legal_entity_access_dates_check check (effective_to is null or effective_to >= effective_from)
);

create or replace function public.can_access_legal_entity(p_legal_entity_id uuid, p_minimum_level text default 'view')
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := public.current_app_role();
  v_rank integer;
  v_required integer;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  if v_role = 'admin' then
    return true;
  end if;

  v_required := case p_minimum_level
    when 'view' then 1
    when 'operate' then 2
    when 'finance' then 3
    when 'admin' then 4
    else 999
  end;

  select max(case access_level
      when 'view' then 1
      when 'operate' then 2
      when 'finance' then 3
      when 'admin' then 4
      else 0
    end)
  into v_rank
  from public.user_legal_entity_access
  where user_id = auth.uid()
    and legal_entity_id = p_legal_entity_id
    and is_active
    and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date);

  return coalesce(v_rank, 0) >= v_required;
end;
$function$;

revoke all on function public.can_access_legal_entity(uuid,text) from public;
grant execute on function public.can_access_legal_entity(uuid,text) to authenticated;
grant execute on function public.can_access_legal_entity(uuid,text) to service_role;

create table if not exists public.employee_employments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  department_id uuid references public.entity_departments(id) on delete set null,
  employment_type text,
  job_title text,
  start_date date,
  end_date date,
  is_primary boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_employments_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index if not exists employee_employments_one_primary_active
  on public.employee_employments(employee_id)
  where is_primary and is_active;

create table if not exists public.asset_ownership_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  owner_legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  ownership_type text not null default 'owned',
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  constraint asset_ownership_type_check check (ownership_type in ('owned','leased','managed','custodied')),
  constraint asset_ownership_dates_check check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists asset_ownership_one_current
  on public.asset_ownership_assignments(asset_id)
  where effective_to is null;

create table if not exists public.asset_operational_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  operating_legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  responsible_department_id uuid references public.entity_departments(id) on delete set null,
  maintenance_legal_entity_id uuid references public.legal_entities(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  constraint asset_operational_dates_check check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists asset_operational_one_current
  on public.asset_operational_assignments(asset_id)
  where effective_to is null;

create table if not exists public.inventory_legal_entity_assignments (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.inventory_stock_items(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  department_id uuid references public.entity_departments(id) on delete set null,
  effective_from date not null default current_date,
  effective_to date,
  is_primary boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  constraint inventory_entity_dates_check check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists inventory_entity_one_primary_current
  on public.inventory_legal_entity_assignments(stock_item_id)
  where is_primary and effective_to is null;

create table if not exists public.cost_center_legal_entity_assignments (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers(id) on delete cascade,
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  is_primary boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  constraint cost_center_entity_dates_check check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists cost_center_entity_one_primary_current
  on public.cost_center_legal_entity_assignments(cost_center_id)
  where is_primary and effective_to is null;

create table if not exists public.legal_entity_suppliers (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legal_entity_id, supplier_id)
);

-- Keep new legal-entity data closed by default. Admins receive global access via
-- can_access_legal_entity(); non-admin access requires explicit grants.
alter table public.legal_entities enable row level security;
alter table public.entity_departments enable row level security;
alter table public.user_legal_entity_access enable row level security;
alter table public.employee_employments enable row level security;
alter table public.asset_ownership_assignments enable row level security;
alter table public.asset_operational_assignments enable row level security;
alter table public.inventory_legal_entity_assignments enable row level security;
alter table public.cost_center_legal_entity_assignments enable row level security;
alter table public.legal_entity_suppliers enable row level security;

create policy legal_entities_select_accessible
  on public.legal_entities for select to authenticated
  using (public.can_access_legal_entity(id, 'view'));

create policy entity_departments_select_accessible
  on public.entity_departments for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));

create policy user_legal_entity_access_select_self_or_admin
  on public.user_legal_entity_access for select to authenticated
  using (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy employee_employments_select_accessible
  on public.employee_employments for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));

create policy asset_ownership_select_accessible
  on public.asset_ownership_assignments for select to authenticated
  using (public.can_access_legal_entity(owner_legal_entity_id, 'view'));

create policy asset_operational_select_accessible
  on public.asset_operational_assignments for select to authenticated
  using (public.can_access_legal_entity(operating_legal_entity_id, 'view'));

create policy inventory_entity_select_accessible
  on public.inventory_legal_entity_assignments for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));

create policy cost_center_entity_select_accessible
  on public.cost_center_legal_entity_assignments for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));

create policy legal_entity_suppliers_select_accessible
  on public.legal_entity_suppliers for select to authenticated
  using (public.can_access_legal_entity(legal_entity_id, 'view'));

comment on table public.legal_entities is 'Canonical legal/accounting entities for Black Swan OS. Legal entity is the primary audit boundary.';
comment on table public.employee_employments is 'Employment relationships. A person may move between or hold relationships with multiple legal entities without duplicating the employee record.';
comment on table public.asset_ownership_assignments is 'Legal ownership history for assets. Ownership is distinct from operational use and maintenance responsibility.';
comment on table public.asset_operational_assignments is 'Operational use, responsible department, maintenance entity, and physical location for assets.';
comment on table public.inventory_legal_entity_assignments is 'Legal-entity allocation history for inventory stock items. Existing inventory is intentionally unassigned until canonical allocation is imported.';

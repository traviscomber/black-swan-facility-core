-- Black Swan OS: staging workflow for canonical employee and inventory files.
--
-- Imports are review-first. Source rows are stored verbatim in raw_payload,
-- resolved against canonical legal entities/departments, and only later applied
-- to employee_employments or inventory_legal_entity_assignments by an explicit
-- approved workflow. This migration does not import or reassign existing data.

create table if not exists public.canonical_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  source_name text not null,
  source_file_hash text,
  status text not null default 'uploaded',
  row_count integer,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  constraint canonical_import_type_check check (import_type in ('employee_master','inventory_master')),
  constraint canonical_import_status_check check (status in ('uploaded','parsing','review','approved','applied','rejected')),
  constraint canonical_import_row_count_check check (row_count is null or row_count >= 0)
);

create table if not exists public.employee_master_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.canonical_import_batches(id) on delete cascade,
  row_number integer not null,
  source_key text,
  raw_payload jsonb not null,
  matched_employee_id uuid references public.employees(id) on delete set null,
  legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  department_id uuid references public.entity_departments(id) on delete set null,
  source_company_label text,
  source_department_label text,
  resolution_status text not null default 'unresolved',
  resolution_method text,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number),
  constraint employee_import_row_number_check check (row_number > 0),
  constraint employee_import_resolution_status_check check (resolution_status in ('unresolved','resolved','ambiguous','rejected')),
  constraint employee_import_resolution_method_check check (resolution_method is null or resolution_method in ('canonical_source','exact_match','manual'))
);

create table if not exists public.inventory_master_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.canonical_import_batches(id) on delete cascade,
  row_number integer not null,
  source_key text,
  raw_payload jsonb not null,
  matched_stock_item_id uuid references public.inventory_stock_items(id) on delete set null,
  legal_entity_id uuid references public.legal_entities(id) on delete restrict,
  department_id uuid references public.entity_departments(id) on delete set null,
  source_company_label text,
  source_department_label text,
  resolution_status text not null default 'unresolved',
  resolution_method text,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number),
  constraint inventory_import_row_number_check check (row_number > 0),
  constraint inventory_import_resolution_status_check check (resolution_status in ('unresolved','resolved','ambiguous','rejected')),
  constraint inventory_import_resolution_method_check check (resolution_method is null or resolution_method in ('canonical_source','exact_match','manual'))
);

create index if not exists canonical_import_batches_status_idx
  on public.canonical_import_batches(import_type, status, uploaded_at desc);

create index if not exists employee_master_import_rows_resolution_idx
  on public.employee_master_import_rows(batch_id, resolution_status);

create index if not exists inventory_master_import_rows_resolution_idx
  on public.inventory_master_import_rows(batch_id, resolution_status);

alter table public.canonical_import_batches enable row level security;
alter table public.employee_master_import_rows enable row level security;
alter table public.inventory_master_import_rows enable row level security;

create policy canonical_import_batches_admin_select
  on public.canonical_import_batches for select to authenticated
  using (public.current_app_role() = 'admin');

create policy canonical_import_batches_admin_insert
  on public.canonical_import_batches for insert to authenticated
  with check (public.current_app_role() = 'admin');

create policy canonical_import_batches_admin_update
  on public.canonical_import_batches for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy employee_import_rows_admin_select
  on public.employee_master_import_rows for select to authenticated
  using (public.current_app_role() = 'admin');

create policy employee_import_rows_admin_insert
  on public.employee_master_import_rows for insert to authenticated
  with check (public.current_app_role() = 'admin');

create policy employee_import_rows_admin_update
  on public.employee_master_import_rows for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy inventory_import_rows_admin_select
  on public.inventory_master_import_rows for select to authenticated
  using (public.current_app_role() = 'admin');

create policy inventory_import_rows_admin_insert
  on public.inventory_master_import_rows for insert to authenticated
  with check (public.current_app_role() = 'admin');

create policy inventory_import_rows_admin_update
  on public.inventory_master_import_rows for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

comment on table public.canonical_import_batches is 'Audit trail for canonical employee/inventory source files before operational allocation is applied.';
comment on table public.employee_master_import_rows is 'Review staging for employee-to-legal-entity and department allocation. Raw source rows are preserved.';
comment on table public.inventory_master_import_rows is 'Review staging for inventory-to-legal-entity and department allocation. Raw source rows are preserved.';

create sequence if not exists public.procurement_request_number_seq start 1;

create table if not exists public.procurement_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  title text not null,
  description text,
  business_justification text not null,
  category text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'unidad',
  estimated_budget_clp numeric(14, 2) check (estimated_budget_clp is null or estimated_budget_clp >= 0),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'converted')),
  required_date date,
  region text not null default 'Los Ríos',
  commune text not null default 'Valdivia',
  delivery_location text,
  requested_by uuid default auth.uid(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  procurement_item_id uuid references public.procurement_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procurement_requests_status_idx
  on public.procurement_requests(status);

create index if not exists procurement_requests_required_date_idx
  on public.procurement_requests(required_date);

create index if not exists procurement_requests_commune_idx
  on public.procurement_requests(commune);

create or replace function public.set_procurement_request_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.request_number is null then
    new.request_number := 'PR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.procurement_request_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_procurement_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists procurement_requests_set_number on public.procurement_requests;
create trigger procurement_requests_set_number
before insert on public.procurement_requests
for each row execute function public.set_procurement_request_number();

drop trigger if exists procurement_requests_set_updated_at on public.procurement_requests;
create trigger procurement_requests_set_updated_at
before update on public.procurement_requests
for each row execute function public.set_procurement_requests_updated_at();

alter table public.procurement_requests enable row level security;

drop policy if exists "Authenticated users can view procurement requests" on public.procurement_requests;
create policy "Authenticated users can view procurement requests"
on public.procurement_requests
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create procurement requests" on public.procurement_requests;
create policy "Authenticated users can create procurement requests"
on public.procurement_requests
for insert
to authenticated
with check (requested_by = auth.uid() or requested_by is null);

drop policy if exists "Authenticated users can update procurement requests" on public.procurement_requests;
create policy "Authenticated users can update procurement requests"
on public.procurement_requests
for update
to authenticated
using (true)
with check (true);

comment on table public.procurement_requests is
  'Pre-purchase procurement requests. Additive to the existing procurement_items purchase-order workflow.';
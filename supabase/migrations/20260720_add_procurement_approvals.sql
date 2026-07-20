create table if not exists public.procurement_approval_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.procurement_requests(id) on delete cascade,
  approver_id uuid not null default auth.uid(),
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  request_amount_clp numeric(14, 2),
  approver_limit_clp numeric(14, 2),
  created_at timestamptz not null default now()
);

create index if not exists procurement_approval_events_request_idx
  on public.procurement_approval_events(request_id, created_at desc);

create or replace function public.is_procurement_approver()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select

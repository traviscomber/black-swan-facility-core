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

alter table public.procurement_approval_events enable row level security;

grant select on public.procurement_approval_events to authenticated;
revoke insert, update, delete on public.procurement_approval_events from anon, authenticated;

create or replace function public.is_procurement_approver()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'procurement_role') in ('approver', 'admin'),
    false
  );
$$;

create or replace function public.procurement_approval_limit_clp()
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when auth.jwt() -> 'app_metadata' ->> 'procurement_role' = 'admin' then 999999999999::numeric
    when (auth.jwt() -> 'app_metadata' ->> 'procurement_approval_limit_clp') ~ '^[0-9]+(\.[0-9]+)?$'
      then (auth.jwt() -> 'app_metadata' ->> 'procurement_approval_limit_clp')::numeric
    else 0::numeric
  end;
$$;

create or replace function public.decide_procurement_request(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.procurement_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request public.procurement_requests;
  v_limit numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_procurement_approver() then
    raise exception 'Procurement approver role required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid approval decision';
  end if;

  select *
  into v_request
  from public.procurement_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Procurement request not found';
  end if;

  if v_request.status not in ('submitted', 'under_review') then
    raise exception 'Only submitted or under-review requests can be decided';
  end if;

  v_limit := public.procurement_approval_limit_clp();

  if p_decision = 'approved'
     and coalesce(v_request.estimated_budget_clp, 0) > v_limit then
    raise exception 'Request exceeds approver limit';
  end if;

  update public.procurement_requests
  set
    status = p_decision,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = nullif(trim(p_notes), '')
  where id = p_request_id
  returning * into v_request;

  insert into public.procurement_approval_events (
    request_id,
    approver_id,
    decision,
    notes,
    request_amount_clp,
    approver_limit_clp
  ) values (
    p_request_id,
    auth.uid(),
    p_decision,
    nullif(trim(p_notes), ''),
    v_request.estimated_budget_clp,
    v_limit
  );

  return v_request;
end;
$$;

revoke all on function public.decide_procurement_request(uuid, text, text) from public;
grant execute on function public.decide_procurement_request(uuid, text, text) to authenticated;

drop policy if exists "Authenticated users can view approval events" on public.procurement_approval_events;
create policy "Authenticated users can view approval events"
on public.procurement_approval_events
for select
to authenticated
using (
  approver_id = (select auth.uid())
  or public.is_procurement_approver()
  or exists (
    select 1
    from public.procurement_requests request
    where request.id = request_id
      and request.requested_by = (select auth.uid())
  )
);

comment on table public.procurement_approval_events is
  'Immutable audit trail for human procurement approval decisions.';

comment on function public.decide_procurement_request(uuid, text, text) is
  'Approves or rejects a submitted procurement request after role and CLP-limit checks.';
-- Canonical separation of duties: Raimundo validates expenses; Santiago authorizes and executes payments.

create table if not exists public.finance_expense_validators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.finance_expense_validators enable row level security;
revoke all on public.finance_expense_validators from anon, authenticated;
grant select on public.finance_expense_validators to service_role;

insert into public.finance_expense_validators(user_id,email,is_active)
select user_id,email,true
from public.user_access_profiles
where lower(email)='raimundo@blackswn.org'
on conflict (user_id) do update set email=excluded.email,is_active=true;

create or replace function public.can_finance_approve()
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $function$
  select case
    when public.current_app_role() in ('admin','service_role') then true
    when auth.uid() is null then false
    else exists (
      select 1 from public.finance_expense_validators v
      where v.user_id=auth.uid() and v.is_active
    )
  end;
$function$;

create or replace function public.can_finance_review_ambiguous()
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $function$
  select public.can_finance_approve();
$function$;

revoke all on function public.can_finance_approve() from public, anon;
revoke all on function public.can_finance_review_ambiguous() from public, anon;
grant execute on function public.can_finance_approve() to authenticated;
grant execute on function public.can_finance_review_ambiguous() to authenticated;

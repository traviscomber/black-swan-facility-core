create table if not exists public.ai_agentic_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  granted_at timestamptz not null default now(),
  granted_by uuid null references auth.users(id),
  reason text null,
  updated_at timestamptz not null default now()
);

alter table public.ai_agentic_access enable row level security;

drop policy if exists "Users can read own agentic access" on public.ai_agentic_access;
create policy "Users can read own agentic access"
  on public.ai_agentic_access
  for select
  to authenticated
  using (auth.uid() = user_id);

insert into public.ai_agentic_access (user_id, enabled, reason)
select
  user_id,
  true,
  'Initial FULL_AGENTIC access grant'
from public.user_access_profiles
where user_id is not null
  and is_active = true
  and lower(email) in (
    'santiago@blackswn.org',
    'tomas@blackswn.org',
    'juan@n3uralia.com',
    'raimundo@blackswn.org'
  )
on conflict (user_id) do update
set
  enabled = excluded.enabled,
  reason = excluded.reason,
  updated_at = now();

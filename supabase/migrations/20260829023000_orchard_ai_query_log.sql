create table if not exists public.orchard_ai_queries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  model text not null,
  prompt_version text not null,
  source_counts jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('completed','failed')),
  error_message text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists orchard_ai_queries_created_idx on public.orchard_ai_queries(created_at desc);
create index if not exists orchard_ai_queries_created_by_idx on public.orchard_ai_queries(created_by);

alter table public.orchard_ai_queries enable row level security;
grant select, insert on public.orchard_ai_queries to authenticated;

drop policy if exists "Internal staff can read own orchard_ai_queries" on public.orchard_ai_queries;
create policy "Internal staff can read own orchard_ai_queries" on public.orchard_ai_queries for select to authenticated
using (created_by = auth.uid());

drop policy if exists "Internal staff can insert own orchard_ai_queries" on public.orchard_ai_queries;
create policy "Internal staff can insert own orchard_ai_queries" on public.orchard_ai_queries for insert to authenticated
with check (created_by = auth.uid());
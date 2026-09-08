-- Harden the FULL_AGENTIC access registry to least privilege.
-- The orchestration API only needs authenticated users to read their own row.

revoke all on table public.ai_agentic_access from anon;
revoke insert, update, delete, truncate, references, trigger on table public.ai_agentic_access from authenticated;
grant select on table public.ai_agentic_access to authenticated;

-- Keep service_role available for controlled administration/migrations.
grant select, insert, update, delete on table public.ai_agentic_access to service_role;

alter table public.ai_agentic_access enable row level security;

drop policy if exists "Users can read own agentic access" on public.ai_agentic_access;
create policy "Users can read own agentic access"
  on public.ai_agentic_access
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

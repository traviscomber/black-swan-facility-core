-- Trigger-only helpers must not be callable through PostgREST RPC.
-- PostgreSQL triggers do not require caller EXECUTE privileges on their trigger function.

revoke execute on function public.normalize_orchard_ai_commitment_currency() from public, anon, authenticated;
revoke execute on function public.orchard_lifecycle_trigger() from public, anon, authenticated;

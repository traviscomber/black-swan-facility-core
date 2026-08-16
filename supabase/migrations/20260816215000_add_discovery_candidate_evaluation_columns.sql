alter table public.discovery_opportunities
  add column if not exists evaluation_model text,
  add column if not exists evaluated_at timestamptz,
  add column if not exists evaluation_version text;

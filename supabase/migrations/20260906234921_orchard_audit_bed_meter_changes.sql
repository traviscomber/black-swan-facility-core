-- Audit every persisted change to Orchard planned bed metres through the canonical
-- append-only critical action audit infrastructure.
--
-- The audit table/function existed in production from the July hardening work but
-- the infrastructure itself was not preserved in repository migrations. Keep this
-- migration replay-safe by defining the missing infrastructure idempotently before
-- attaching the Orchard-specific trigger. Existing production objects retain the
-- same effective grants, RLS policy and trigger-function behavior.

begin;

create schema if not exists private_audit;
revoke all on schema private_audit from public, anon, authenticated;

create table if not exists public.critical_action_audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action = any (array['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  category text not null,
  actor_id uuid,
  actor_email text,
  actor_role text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] not null default '{}'::text[],
  occurred_at timestamptz not null default now()
);

create index if not exists critical_action_audit_category_idx
  on public.critical_action_audit_log (category, occurred_at desc);
create index if not exists critical_action_audit_entity_idx
  on public.critical_action_audit_log (entity_type, entity_id);
create index if not exists critical_action_audit_occurred_at_idx
  on public.critical_action_audit_log (occurred_at desc);

alter table public.critical_action_audit_log enable row level security;
revoke all on public.critical_action_audit_log from public, anon, authenticated;
grant select on public.critical_action_audit_log to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'critical_action_audit_log'
      and policyname = 'critical_action_audit_admin_select'
  ) then
    create policy critical_action_audit_admin_select
      on public.critical_action_audit_log
      for select
      to authenticated
      using (
        coalesce((auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = 'admin'
      );
  end if;
end $$;

create or replace function private_audit.capture_critical_action()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  before_row jsonb;
  after_row jsonb;
  record_uuid uuid;
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
    record_uuid := nullif(after_row ->> 'id', '')::uuid;
  elsif tg_op = 'DELETE' then
    before_row := to_jsonb(old);
    record_uuid := nullif(before_row ->> 'id', '')::uuid;
  else
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
    record_uuid := nullif(after_row ->> 'id', '')::uuid;

    select coalesce(array_agg(key order by key), '{}')
      into changed
    from (
      select key
      from jsonb_each(after_row)
      where (before_row -> key) is distinct from (after_row -> key)
    ) changed_keys;

    if cardinality(changed) = 0 then
      return new;
    end if;
  end if;

  insert into public.critical_action_audit_log (
    entity_type,
    entity_id,
    action,
    category,
    actor_id,
    actor_email,
    actor_role,
    old_data,
    new_data,
    changed_fields
  ) values (
    tg_table_name,
    record_uuid,
    tg_op,
    coalesce(tg_argv[0], 'critical'),
    nullif(claims ->> 'sub', '')::uuid,
    nullif(claims ->> 'email', ''),
    nullif(claims -> 'app_metadata' ->> 'procurement_role', ''),
    before_row,
    after_row,
    changed
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private_audit.capture_critical_action() from public, anon, authenticated, service_role;

drop trigger if exists orchard_crop_successions_planned_bed_m_audit
  on public.orchard_crop_successions;

create trigger orchard_crop_successions_planned_bed_m_audit
after update of planned_bed_m on public.orchard_crop_successions
for each row
when (old.planned_bed_m is distinct from new.planned_bed_m)
execute function private_audit.capture_critical_action('orchard_planning');

commit;

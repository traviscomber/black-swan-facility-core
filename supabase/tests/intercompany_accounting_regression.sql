-- Black Swan OS intercompany accounting regression gate.
-- Read-only assertions. Run after intercompany foundation migration.

begin;

do $test$
declare
  v_missing text[];
begin
  select array_agg(required_name order by required_name)
  into v_missing
  from unnest(array[
    'intercompany_rules',
    'intercompany_transactions',
    'intercompany_reconciliations'
  ]) required_name
  where to_regclass('public.' || required_name) is null;

  if v_missing is not null then
    raise exception 'INTERCOMPANY REGRESSION: missing tables %', v_missing;
  end if;
end;
$test$;

-- No commercial rule may be invented by schema migration.
do $test$
begin
  if exists (select 1 from public.intercompany_rules) then
    raise exception 'INTERCOMPANY REGRESSION: rules were seeded without canonical approved terms';
  end if;
end;
$test$;

-- Both sides must be different legal entities.
do $test$
declare
  v_rule_def text;
  v_tx_def text;
begin
  select string_agg(pg_get_constraintdef(c.oid), E'\n')
  into v_rule_def
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='intercompany_rules';

  select string_agg(pg_get_constraintdef(c.oid), E'\n')
  into v_tx_def
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='intercompany_transactions';

  if v_rule_def not ilike '%source_legal_entity_id <> destination_legal_entity_id%'
     or v_tx_def not ilike '%source_legal_entity_id <> destination_legal_entity_id%' then
    raise exception 'INTERCOMPANY REGRESSION: distinct legal-entity constraint missing';
  end if;
end;
$test$;

-- Intercompany visibility requires finance access to BOTH entities.
do $test$
declare
  v_policy text;
begin
  select string_agg(coalesce(qual,'') || ' ' || coalesce(with_check,''), E'\n')
  into v_policy
  from pg_policies
  where schemaname='public'
    and tablename in ('intercompany_rules','intercompany_transactions');

  if v_policy is null
     or v_policy not ilike '%source_legal_entity_id%finance%'
     or v_policy not ilike '%destination_legal_entity_id%finance%' then
    raise exception 'INTERCOMPANY REGRESSION: dual-entity finance access policy missing';
  end if;
end;
$test$;

-- RLS must be enabled on all intercompany tables.
do $test$
declare
  v_table text;
begin
  foreach v_table in array array[
    'intercompany_rules',
    'intercompany_transactions',
    'intercompany_reconciliations'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity
    ) then
      raise exception 'INTERCOMPANY REGRESSION: RLS disabled on %', v_table;
    end if;
  end loop;
end;
$test$;

rollback;
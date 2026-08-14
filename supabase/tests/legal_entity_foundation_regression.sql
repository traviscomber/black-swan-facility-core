-- Black Swan OS legal-entity foundation regression gate.
-- Read-only assertions to run after the legal-entity migrations in a
-- development/preview Supabase database before production promotion.

begin;

do $test$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.legal_entities
  where code in ('BLUE_MARBLE','AGRICOLA','BS_INFRA','BS_CORPORACION');

  if v_count <> 4 then
    raise exception 'ENTITY REGRESSION: expected four canonical legal entities, found %', v_count;
  end if;
end;
$test$;

-- Blue Marble is intentionally minimal: Accounting and Legal only.
do $test$
declare
  v_departments text[];
begin
  select array_agg(d.code order by d.code)
  into v_departments
  from public.entity_departments d
  join public.legal_entities e on e.id=d.legal_entity_id
  where e.code='BLUE_MARBLE' and d.is_active;

  if v_departments is distinct from array['ACCOUNTING','LEGAL']::text[] then
    raise exception 'ENTITY REGRESSION: Blue Marble departments are %, expected ACCOUNTING + LEGAL only', v_departments;
  end if;
end;
$test$;

-- Current confirmed ownership of Maintenance remains with Infra. The data model
-- permits future reassignment without altering asset ownership.
do $test$
begin
  if not exists (
    select 1
    from public.entity_departments d
    join public.legal_entities e on e.id=d.legal_entity_id
    where e.code='BS_INFRA' and d.code='MAINTENANCE' and d.is_active
  ) then
    raise exception 'ENTITY REGRESSION: Maintenance is missing from BS Infra';
  end if;

  if exists (
    select 1
    from public.entity_departments d
    join public.legal_entities e on e.id=d.legal_entity_id
    where e.code='BS_CORPORACION' and d.code='MAINTENANCE' and d.is_active
  ) then
    raise exception 'ENTITY REGRESSION: Maintenance should not yet be assigned to Corporacion';
  end if;
end;
$test$;

-- Do not silently allocate legacy operational records. Santi's canonical source
-- files must drive the first employee/inventory assignments.
do $test$
begin
  if exists (select 1 from public.employee_employments) then
    raise exception 'ENTITY REGRESSION: employee assignments were populated without canonical import';
  end if;

  if exists (select 1 from public.inventory_legal_entity_assignments) then
    raise exception 'ENTITY REGRESSION: inventory assignments were populated without canonical import';
  end if;

  if exists (select 1 from public.asset_ownership_assignments) then
    raise exception 'ENTITY REGRESSION: asset ownership was populated without canonical review';
  end if;
end;
$test$;

-- The access helper must remain fail-closed for anonymous callers.
do $test$
declare
  v_entity_id uuid;
begin
  select id into v_entity_id from public.legal_entities where code='BS_CORPORACION';

  if has_function_privilege('anon', 'public.can_access_legal_entity(uuid,text)', 'EXECUTE') then
    raise exception 'ENTITY REGRESSION: anon can execute can_access_legal_entity';
  end if;
end;
$test$;

rollback;

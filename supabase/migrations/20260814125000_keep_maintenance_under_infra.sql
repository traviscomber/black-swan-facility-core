-- Current confirmed organization keeps Maintenance under Black Swan Infra SpA.
-- The schema keeps maintenance responsibility independent from ownership so
-- this can move to Corporacion later without redesigning asset records.

with infra as (
  select id from public.legal_entities where code = 'BS_INFRA'
)
insert into public.entity_departments (legal_entity_id, code, name)
select id, 'MAINTENANCE', 'Maintenance'
from infra
on conflict (legal_entity_id, code) do update
set name = excluded.name,
    is_active = true,
    updated_at = now();

delete from public.entity_departments d
using public.legal_entities e
where d.legal_entity_id = e.id
  and e.code = 'BS_CORPORACION'
  and d.code = 'MAINTENANCE';

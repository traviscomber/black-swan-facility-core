-- Audit every persisted change to Orchard planned bed metres through the existing
-- append-only critical action audit infrastructure. This preserves the operator
-- decision trail without changing Orchard authorization or write semantics.

begin;

drop trigger if exists orchard_crop_successions_planned_bed_m_audit
  on public.orchard_crop_successions;

create trigger orchard_crop_successions_planned_bed_m_audit
after update of planned_bed_m on public.orchard_crop_successions
for each row
when (old.planned_bed_m is distinct from new.planned_bed_m)
execute function private_audit.capture_critical_action('orchard_planning');

commit;

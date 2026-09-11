update public.booking_import_records bir
set canonical_id = r.id,
    reconciliation_status = 'mapped',
    canonical_table = 'rooms',
    notes = 'Deterministic reconciliation: BedBooking Office Room maps to the unique remaining 1-person Ed Office inventory counterpart after exact Office Room 2 mapping.',
    updated_at = now()
from public.rooms r
join public.locations l on l.id = r.location_id
where bir.source_system='bedbooking'
  and bir.entity_type='room'
  and bir.external_ref='Office Room'
  and l.name='Ed Office'
  and r.room_number='Oficina';

update public.booking_import_records bir
set canonical_id = r.id,
    reconciliation_status = 'mapped',
    canonical_table = 'rooms',
    notes = 'Deterministic reconciliation by PH2 property prefix plus ordinal 1 to canonical Prairy House 2 / Room1.',
    updated_at = now()
from public.rooms r
join public.locations l on l.id = r.location_id
where bir.source_system='bedbooking'
  and bir.entity_type='room'
  and bir.external_ref='PH2- Prairie House 1'
  and l.name='Prairy House 2'
  and r.room_number='Room1';

update public.booking_import_records bir
set canonical_id = r.id,
    reconciliation_status = 'mapped',
    canonical_table = 'rooms',
    notes = 'Deterministic reconciliation by PH2 property prefix plus ordinal 2 to canonical Prairy House 2 / Room2.',
    updated_at = now()
from public.rooms r
join public.locations l on l.id = r.location_id
where bir.source_system='bedbooking'
  and bir.entity_type='room'
  and bir.external_ref='PH2- Prairie House 2'
  and l.name='Prairy House 2'
  and r.room_number='Room2';

update public.booking_import_records
set reconciliation_status='partial',
    notes='BedBooking reports 41 rooms. All 29 currently observed room labels are reconciled to unique canonical Black Swan rooms; 12 BedBooking room labels remain unobserved because the source calendar is virtualized and are not fabricated.',
    updated_at=now()
where source_system='bedbooking'
  and entity_type='rooms_snapshot'
  and external_ref='calendar-rooms-2026-09-10';
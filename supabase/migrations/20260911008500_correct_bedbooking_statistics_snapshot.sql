insert into public.booking_import_records(source_system,entity_type,external_ref,observed_at,source_period,payload,reconciliation_status,canonical_table,notes)
values('bedbooking','statistics_snapshot','overview-2026-08-11_2026-09-11','2026-09-11T00:25:00-03','2026-08-11/2026-09-11',jsonb_build_object(
  'period','11 Aug - 11 Sep 2026',
  'rooms_filter','All (41)',
  'reservations',0,
  'total_revenue',0,
  'currency','USD',
  'payments_received',0,
  'payments_expected',0,
  'occupancy_percent',0,
  'occupied_nights_percent',0,
  'revpar',0,
  'adr',0,
  'origin_reservations_count',0,
  'origin_revenue',0
),'observed',null,'Authenticated BedBooking statistics snapshot for the selected 1-month period. Zero values apply only to this selected period, not lifetime performance.')
on conflict(source_system,entity_type,external_ref) do update set observed_at=excluded.observed_at,source_period=excluded.source_period,payload=excluded.payload,reconciliation_status=excluded.reconciliation_status,notes=excluded.notes,updated_at=now();

update public.booking_import_records
set notes=concat_ws(' ',notes,'Superseded by corrected authenticated snapshot overview-2026-08-11_2026-09-11; prior rooms_filter All (0) was not trusted as current.'),
    updated_at=now()
where source_system='bedbooking'
  and entity_type='statistics_snapshot'
  and external_ref='overview-2026-08-10_2026-09-10';
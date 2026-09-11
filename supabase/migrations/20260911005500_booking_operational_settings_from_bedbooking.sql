alter table public.booking_settings add column if not exists check_in_time time;
alter table public.booking_settings add column if not exists check_out_time time;
alter table public.booking_settings add column if not exists free_cancellation_days_before integer;
alter table public.booking_settings add column if not exists paid_cancellation_days_before integer;
alter table public.booking_settings add column if not exists source_date_format text;
alter table public.booking_settings add column if not exists source_time_format text;
alter table public.booking_settings add column if not exists towels_enabled boolean;
alter table public.booking_settings add column if not exists towels_every_days integer;
alter table public.booking_settings add column if not exists towels_after_checkout boolean;
alter table public.booking_settings add column if not exists bedding_enabled boolean;
alter table public.booking_settings add column if not exists bedding_every_days integer;
alter table public.booking_settings add column if not exists bedding_after_checkout boolean;
alter table public.booking_settings add column if not exists cleaning_enabled boolean;

create table if not exists public.booking_external_payment_methods (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_ref text not null,
  label text not null,
  enabled boolean,
  configuration jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique(source_system, external_ref)
);
alter table public.booking_external_payment_methods enable row level security;

update public.booking_settings set
  check_in_time='14:00',
  check_out_time='10:00',
  free_cancellation_days_before=0,
  paid_cancellation_days_before=0,
  source_date_format='yyyy-MM-dd',
  source_time_format='GG:mm',
  towels_enabled=true,
  towels_every_days=3,
  towels_after_checkout=true,
  bedding_enabled=true,
  bedding_every_days=5,
  bedding_after_checkout=true,
  cleaning_enabled=true,
  updated_at=now()
where id='default';

insert into public.booking_external_payment_methods(source_system,external_ref,label,enabled,configuration,observed_at) values
('bedbooking','payment-on-place','Payment on place',true,'{}','2026-09-11T00:03:00-03'),
('bedbooking','bank-transfer','Bank transfer',true,'{"wait_days":3,"bank_account_present":false,"swift_present":false}'::jsonb,'2026-09-11T00:03:00-03')
on conflict(source_system,external_ref) do update set label=excluded.label,enabled=excluded.enabled,configuration=excluded.configuration,observed_at=excluded.observed_at;

insert into public.booking_import_records(source_system,entity_type,external_ref,observed_at,source_period,payload,reconciliation_status,canonical_table,notes) values
('bedbooking','settings_snapshot','general-2026-09-11','2026-09-11T00:03:00-03','2026-09',jsonb_build_object(
  'cancel_booking',jsonb_build_object('free_to_days_before',0,'paid_from_days_before',0),
  'check_in_from','14:00',
  'check_out_to','10:00',
  'prepayment_form','Down payment',
  'board','FB - full board',
  'towels',jsonb_build_object('enabled',true,'every_days',3,'after_checkout',true),
  'bedding',jsonb_build_object('enabled',true,'every_days',5,'after_checkout',true),
  'cleaning_enabled',true,
  'date_format','yyyy-MM-dd',
  'hour_format','GG:mm',
  'visible_booking_status_labels',jsonb_build_array('200 usd Fam & Friends','160 usd Ed''s invitation','550 usd Full Price','csnceled','Volunteer')
),'mapped','booking_settings','Operational settings observed in BedBooking. Status labels preserved verbatim because their semantics are not yet verified.'),
('bedbooking','payment_methods_snapshot','payment-methods-2026-09-11','2026-09-11T00:03:00-03','2026-09',jsonb_build_object('raw_text','Payment methods | Offline payment | Payment on place YES | Bank transfer YES | Time of waiting for the bank transfer 3 days | Bank account for booking payments [empty] | SWIFT (BIC) [empty] | Stripe YES | Przelewy24 visible | Dotpay YES | PayPal setup visible'),'partial','booking_external_payment_methods','Payment on place and bank transfer mapped; online-provider enabled states require exact control-state verification before canonical activation.')
on conflict(source_system,entity_type,external_ref) do update set payload=excluded.payload,reconciliation_status=excluded.reconciliation_status,canonical_table=excluded.canonical_table,notes=excluded.notes,updated_at=now();

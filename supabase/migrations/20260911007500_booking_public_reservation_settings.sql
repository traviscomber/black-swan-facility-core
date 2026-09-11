create table if not exists public.booking_public_reservation_settings (
  id text primary key default 'default',
  public_booking_enabled boolean not null default false,
  availability_inquiries_enabled boolean not null default true,
  children_selector_enabled boolean not null default true,
  dining_options_enabled boolean not null default true,
  availability_calendar_enabled boolean not null default true,
  hide_provider_branding boolean not null default true,
  language text not null default 'en',
  accent_color text,
  public_booking_url text,
  source_system text,
  source_observed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.booking_public_reservation_settings enable row level security;

drop policy if exists booking_public_reservation_settings_read on public.booking_public_reservation_settings;
create policy booking_public_reservation_settings_read on public.booking_public_reservation_settings
for select to authenticated using (public.can_booking_action('booking.modify'));

drop policy if exists booking_public_reservation_settings_manage on public.booking_public_reservation_settings;
create policy booking_public_reservation_settings_manage on public.booking_public_reservation_settings
for all to authenticated
using (public.can_booking_action('booking.modify'))
with check (public.can_booking_action('booking.modify'));

insert into public.booking_public_reservation_settings(
  id,public_booking_enabled,availability_inquiries_enabled,children_selector_enabled,dining_options_enabled,
  availability_calendar_enabled,hide_provider_branding,language,accent_color,public_booking_url,source_system,source_observed_at,updated_at
) values (
  'default',false,true,true,true,true,true,'en','#00a541','black-swan.bed-booking.com','bedbooking','2026-09-11T00:20:00-03',now()
)
on conflict(id) do update set
  public_booking_enabled=excluded.public_booking_enabled,
  availability_inquiries_enabled=excluded.availability_inquiries_enabled,
  children_selector_enabled=excluded.children_selector_enabled,
  dining_options_enabled=excluded.dining_options_enabled,
  availability_calendar_enabled=excluded.availability_calendar_enabled,
  hide_provider_branding=excluded.hide_provider_branding,
  language=excluded.language,
  accent_color=excluded.accent_color,
  public_booking_url=excluded.public_booking_url,
  source_system=excluded.source_system,
  source_observed_at=excluded.source_observed_at,
  updated_at=now();

insert into public.booking_import_records(source_system,entity_type,external_ref,observed_at,source_period,payload,reconciliation_status,canonical_table,notes)
values
('bedbooking','reservation_system_snapshot','widgets-2026-09-11','2026-09-11T00:20:00-03','2026-09',jsonb_build_object(
  'configuration_url','black-swan.bed-booking.com',
  'logo','No logo',
  'color','#00a541',
  'language','English (EN / EN-US)',
  'block_online_booking',true,
  'allow_availability_inquiries',true,
  'hide_bedbooking_link',true,
  'children_selector',true,
  'dining_options',true,
  'availability_calendar',true,
  'placement','Floating',
  'widget_type_options',jsonb_build_array('Search form','All rooms','One room')
),'mapped','booking_public_reservation_settings','Provider-specific embed identifiers/code intentionally retained outside canonical native settings.'),
('bedbooking','rental_license_snapshot','widgets-license-2026-09-11','2026-09-11T00:21:00-03','2026-09',jsonb_build_object('label','Rental license number','verified_value',null),'observed',null,'No rental license value was visible; no value inferred.')
on conflict(source_system,entity_type,external_ref) do update set payload=excluded.payload,reconciliation_status=excluded.reconciliation_status,canonical_table=excluded.canonical_table,notes=excluded.notes,updated_at=now();
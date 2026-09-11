drop policy if exists booking_import_records_authorized_select on public.booking_import_records;
create policy booking_import_records_authorized_select on public.booking_import_records
for select to authenticated
using (public.can_booking_action('booking.modify') or public.can_app_action('finance.record_payment'));

drop policy if exists booking_external_financial_documents_authorized_select on public.booking_external_financial_documents;
create policy booking_external_financial_documents_authorized_select on public.booking_external_financial_documents
for select to authenticated
using (public.can_app_action('finance.record_payment'));

drop policy if exists booking_external_tax_rates_authorized_select on public.booking_external_tax_rates;
create policy booking_external_tax_rates_authorized_select on public.booking_external_tax_rates
for select to authenticated
using (public.can_app_action('finance.record_payment') or public.can_booking_action('booking.modify'));

drop policy if exists booking_external_payment_methods_authorized_select on public.booking_external_payment_methods;
create policy booking_external_payment_methods_authorized_select on public.booking_external_payment_methods
for select to authenticated
using (public.can_app_action('finance.record_payment') or public.can_booking_action('booking.modify'));

-- Enforce non-negative, integer CLP amounts across the booking domain.

begin;

alter table public.rooms
  drop constraint if exists rooms_rate_per_night_clp,
  add constraint rooms_rate_per_night_clp
    check (rate_per_night is not null and rate_per_night >= 0 and rate_per_night = trunc(rate_per_night));

alter table public.booking_extras
  drop constraint if exists booking_extras_price_clp,
  drop constraint if exists booking_extras_tax_rate_range,
  add constraint booking_extras_price_clp
    check (price >= 0 and price = trunc(price)),
  add constraint booking_extras_tax_rate_range
    check (tax_rate >= 0 and tax_rate <= 100);

alter table public.reservation_extras
  drop constraint if exists reservation_extras_quantity_positive,
  drop constraint if exists reservation_extras_unit_price_clp,
  drop constraint if exists reservation_extras_tax_rate_range,
  drop constraint if exists reservation_extras_total_clp,
  add constraint reservation_extras_quantity_positive
    check (quantity > 0),
  add constraint reservation_extras_unit_price_clp
    check (unit_price >= 0 and unit_price = trunc(unit_price)),
  add constraint reservation_extras_tax_rate_range
    check (tax_rate >= 0 and tax_rate <= 100),
  add constraint reservation_extras_total_clp
    check (total_amount is null or (total_amount >= 0 and total_amount = trunc(total_amount)));

alter table public.payments
  drop constraint if exists payments_amount_clp,
  add constraint payments_amount_clp
    check (amount > 0 and amount = trunc(amount));

alter table public.invoices
  drop constraint if exists invoices_subtotal_clp,
  drop constraint if exists invoices_discount_amount_clp,
  drop constraint if exists invoices_tax_amount_clp,
  drop constraint if exists invoices_additional_fees_clp,
  drop constraint if exists invoices_total_amount_clp,
  drop constraint if exists invoices_amount_paid_clp,
  add constraint invoices_subtotal_clp
    check (subtotal >= 0 and subtotal = trunc(subtotal)),
  add constraint invoices_discount_amount_clp
    check (discount_amount >= 0 and discount_amount = trunc(discount_amount)),
  add constraint invoices_tax_amount_clp
    check (tax_amount >= 0 and tax_amount = trunc(tax_amount)),
  add constraint invoices_additional_fees_clp
    check (additional_fees >= 0 and additional_fees = trunc(additional_fees)),
  add constraint invoices_total_amount_clp
    check (total_amount >= 0 and total_amount = trunc(total_amount)),
  add constraint invoices_amount_paid_clp
    check (amount_paid >= 0 and amount_paid <= total_amount and amount_paid = trunc(amount_paid));

alter table public.booking_settings
  drop constraint if exists booking_settings_service_fee_clp,
  add constraint booking_settings_service_fee_clp
    check (service_fee >= 0 and service_fee = trunc(service_fee));

commit;

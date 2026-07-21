-- Create reservation invoices atomically.
-- reservation_extras.total_amount is already a generated column and remains authoritative.

begin;

alter table public.reservations
  drop constraint if exists reservations_total_amount_clp,
  add constraint reservations_total_amount_clp
    check (
      total_amount is null
      or (total_amount >= 0 and total_amount = trunc(total_amount))
    );

create or replace function public.create_reservation_invoice(
  p_reservation_id uuid,
  p_due_date date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set
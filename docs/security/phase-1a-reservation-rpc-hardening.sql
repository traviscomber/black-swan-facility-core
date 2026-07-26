-- REVIEW-ONLY DRAFT. NOT APPLIED TO PRODUCTION.
-- Verified against production on 2026-07-26.
-- Purpose: remove anonymous execution of the SECURITY DEFINER reservation RPC.
-- Apply only through an authorized Supabase migration after testing all callers.

begin;

revoke execute on function public.create_reservation_atomic(
  uuid, text, text, text, date, date, integer, numeric, text, text, date
) from public;

revoke execute on function public.create_reservation_atomic(
  uuid, text, text, text, date, date, integer, numeric, text, text, date
) from anon;

grant execute on function public.create_reservation_atomic(
  uuid, text, text, text, date, date, integer, numeric, text, text, date
) to authenticated;

commit;

-- Required verification before production application:
-- 1. anon EXECUTE must be false.
-- 2. public EXECUTE must be false.
-- 3. authenticated EXECUTE must remain true.
-- 4. POST /api/bookings/reservations must create a valid non-conflicting reservation in a test environment.
-- 5. POST /api/bookings/revenue/auto-fill-gap must use the same RPC successfully.
-- 6. Conflicting dates must still return a conflict and create no reservation.
-- 7. No production reservation or invoice data may be inserted during verification.

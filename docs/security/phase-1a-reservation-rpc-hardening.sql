-- REVIEW-ONLY DRAFT. NOT APPLIED TO PRODUCTION.
-- Verified against production on 2026-07-26.
-- Purpose: remove anonymous execution of SECURITY DEFINER reservation RPCs.
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

revoke execute on function public.execute_bulk_update(jsonb, text, uuid) from public;
revoke execute on function public.execute_bulk_update(jsonb, text, uuid) from anon;
grant execute on function public.execute_bulk_update(jsonb, text, uuid) to authenticated;

commit;

-- Required verification before production application:
-- 1. anon and public EXECUTE must be false for both functions.
-- 2. authenticated EXECUTE must remain true until application callers are migrated.
-- 3. POST /api/bookings/reservations must create a valid non-conflicting reservation in a test environment.
-- 4. POST /api/bookings/revenue/auto-fill-gap must use create_reservation_atomic successfully.
-- 5. POST /api/bookings/bulk/status must reject non-admin users at the application route.
-- 6. Conflicting dates must still return a conflict and create no reservation.
-- 7. No production reservation, invoice, or bulk-operation data may be inserted during verification.
-- 8. A later migration must add an admin app_metadata check inside execute_bulk_update before direct authenticated execution is considered safe.

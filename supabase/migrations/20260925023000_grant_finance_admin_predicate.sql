-- Raimundo's approval queue calls can_finance_admin() only to decide whether
-- EUR valuation controls should be shown. Authenticated users must be able to
-- execute the predicate; the function itself still returns true only for finance admins.

revoke all on function public.can_finance_admin() from public, anon;
grant execute on function public.can_finance_admin() to authenticated, service_role;

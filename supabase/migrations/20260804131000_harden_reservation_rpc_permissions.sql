-- Preserve the existing reservation logic behind role-checked wrappers.
ALTER FUNCTION public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date)
  RENAME TO create_reservation_atomic_internal;

ALTER FUNCTION public.create_reservation_invoice(uuid, date, text)
  RENAME TO create_reservation_invoice_internal;

REVOKE ALL ON FUNCTION public.create_reservation_atomic_internal(uuid, text, text, text, date, date, integer, numeric, text, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_reservation_invoice_internal(uuid, date, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_reservation_invoice(
  p_reservation_id uuid,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
BEGIN
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' AND v_role NOT IN ('admin', 'approver') THEN
    RAISE EXCEPTION 'Insufficient permissions to create invoices';
  END IF;

  RETURN public.create_reservation_invoice_internal(p_reservation_id, p_due_date, p_notes);
END;
$$;

CREATE FUNCTION public.create_reservation_atomic(
  p_bed_id uuid DEFAULT NULL,
  p_guest_name text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_check_in date DEFAULT NULL,
  p_check_out date DEFAULT NULL,
  p_num_guests integer DEFAULT 1,
  p_total_amount numeric DEFAULT 0,
  p_status text DEFAULT 'confirmed',
  p_special_requests text DEFAULT NULL,
  p_invoice_due_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'procurement_role', '');
BEGIN
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' AND v_role NOT IN ('admin', 'approver') THEN
    RAISE EXCEPTION 'Insufficient permissions to create reservations';
  END IF;

  RETURN public.create_reservation_atomic_internal(
    p_bed_id,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_check_in,
    p_check_out,
    p_num_guests,
    p_total_amount,
    p_status,
    p_special_requests,
    p_invoice_due_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_reservation_invoice(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(uuid, text, text, text, date, date, integer, numeric, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reservation_invoice(uuid, date, text) TO authenticated, service_role;

-- Trigger functions are not public RPC endpoints.
REVOKE ALL ON FUNCTION public.check_reservation_conflict() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_reservation_not_blocked() FROM PUBLIC, anon, authenticated;

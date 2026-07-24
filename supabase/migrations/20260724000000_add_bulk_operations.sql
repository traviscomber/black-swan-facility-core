-- Bulk operations tracking table
CREATE TABLE IF NOT EXISTS bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  operation_type TEXT NOT NULL,
  reservation_count INT NOT NULL,
  days_delta INT DEFAULT 0,
  days_extend INT DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- RPC: Check conflicts for bulk update
CREATE OR REPLACE FUNCTION check_bulk_conflicts(p_updates JSONB[])
RETURNS TABLE (reservation_id UUID, reason TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    SELECT
      (u->>'id')::UUID as res_id,
      (u->>'check_in')::DATE as new_check_in,
      (u->>'check_out')::DATE as new_check_out,
      (u->>'bed_id')::UUID as bed_id
    FROM unnest(p_updates) u
  ),
  conflicts AS (
    SELECT DISTINCT u.res_id, 'Double-booking: ' || r.guest_name as reason
    FROM updates u
    JOIN reservations r ON r.bed_id = u.bed_id
    WHERE r.id != u.res_id
      AND r.status NOT IN ('cancelled', 'void', 'voided')
      AND u.new_check_in < r.check_out::DATE
      AND u.new_check_out > r.check_in::DATE
  )
  SELECT * FROM conflicts;
END;
$$ LANGUAGE plpgsql;

-- RPC: Execute bulk update atomically
CREATE OR REPLACE FUNCTION execute_bulk_update(p_updates JSONB[], p_operation_id UUID)
RETURNS TABLE (success BOOLEAN, updated_count INT) AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- Update all reservations atomically
  UPDATE reservations r
  SET
    check_in = (u->>'check_in')::DATE,
    check_out = (u->>'check_out')::DATE,
    bulk_operation_id = p_operation_id,
    updated_at = now()
  FROM (
    SELECT (u->>'id')::UUID as id, u
    FROM unnest(p_updates) u
  ) AS t(id, u)
  WHERE r.id = t.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log operation
  INSERT INTO bulk_operations (operation_type, reservation_count, status)
  VALUES ('bulk_move_extend', v_count, 'completed');

  RETURN QUERY SELECT true, v_count;
END;
$$ LANGUAGE plpgsql;

-- Add bulk_operation_id column if not exists
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS bulk_operation_id UUID REFERENCES bulk_operations(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_reservations_bulk_operation_id ON reservations(bulk_operation_id);

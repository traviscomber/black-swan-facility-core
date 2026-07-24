-- =============================================================================
-- Phase B Fix: Correct execute_bulk_update and restore_bulk_operation_state
-- Root cause: execute_bulk_update referenced reservations.updated_at which
-- does not exist in the schema, causing all bulk move/extend/status ops to fail.
-- restore_bulk_operation_state had an incorrect JSONB traversal for snapshots.
-- =============================================================================

-- Fix 1: Add reservation_ids + status columns if missing
ALTER TABLE IF EXISTS public.bulk_operations
  ADD COLUMN IF NOT EXISTS reservation_ids UUID[] DEFAULT '{}';

ALTER TABLE IF EXISTS public.bulk_operations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Fix 2: Drop and recreate execute_bulk_update without referencing updated_at
-- Preserve exact signature: (p_updates jsonb, p_operation_type text, p_operation_id uuid)
DROP FUNCTION IF EXISTS public.execute_bulk_update(jsonb, text, uuid);

CREATE FUNCTION public.execute_bulk_update(
  p_updates        JSONB,
  p_operation_type TEXT    DEFAULT 'move',
  p_operation_id   UUID    DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count        INT := 0;
  v_res_ids      UUID[];
  v_prev_state   JSONB;
  upd            JSONB;
BEGIN
  -- Collect reservation IDs and snapshot previous state for undo
  SELECT ARRAY(SELECT (u->>'id')::UUID FROM jsonb_array_elements(p_updates) u)
  INTO v_res_ids;

  SELECT jsonb_build_object(
    'reservations',
    jsonb_object_agg(
      id::TEXT,
      jsonb_build_object('check_in', check_in, 'check_out', check_out, 'status', status)
    )
  )
  INTO v_prev_state
  FROM public.reservations
  WHERE id = ANY(v_res_ids);

  -- Apply updates: check_in/check_out dates and optional status
  FOR upd IN SELECT * FROM jsonb_array_elements(p_updates) LOOP
    UPDATE public.reservations
    SET
      check_in  = COALESCE((upd->>'check_in')::DATE,  check_in),
      check_out = COALESCE((upd->>'check_out')::DATE, check_out),
      status    = COALESCE(upd->>'status',             status)
    WHERE id = (upd->>'id')::UUID;
    v_count := v_count + 1;
  END LOOP;

  -- Log operation with previous state for undo support
  -- bulk_operations schema: id, operation_type, reservation_ids, previous_state, applied_state, status
  INSERT INTO public.bulk_operations (
    id, operation_type, reservation_ids,
    previous_state, applied_state, status
  ) VALUES (
    p_operation_id,
    p_operation_type,
    v_res_ids,
    v_prev_state,
    jsonb_build_object('updates', p_updates),
    'completed'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'operation_id', p_operation_id, 'updated_count', v_count);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.execute_bulk_update(JSONB, TEXT, UUID) TO authenticated;

-- Fix 3: Drop and recreate restore_bulk_operation_state with correct JSONB traversal
DROP FUNCTION IF EXISTS public.restore_bulk_operation_state(uuid);

CREATE FUNCTION public.restore_bulk_operation_state(p_operation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_op         public.bulk_operations%ROWTYPE;
  v_res        JSONB;
  v_key        TEXT;
  v_count      INT := 0;
BEGIN
  SELECT * INTO v_op FROM public.bulk_operations WHERE id = p_operation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Operación no encontrada');
  END IF;

  IF v_op.previous_state IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin estado anterior para restaurar');
  END IF;

  -- Restore each reservation using snapshotted state
  FOR v_key IN SELECT jsonb_object_keys(v_op.previous_state->'reservations') LOOP
    v_res := v_op.previous_state->'reservations'->v_key;
    UPDATE public.reservations
    SET
      check_in  = (v_res->>'check_in')::DATE,
      check_out = (v_res->>'check_out')::DATE,
      status    = v_res->>'status'
    WHERE id = v_key::UUID;
    v_count := v_count + 1;
  END LOOP;

  -- Mark operation as undone
  UPDATE public.bulk_operations SET status = 'undone' WHERE id = p_operation_id;

  RETURN jsonb_build_object('success', true, 'restored_count', v_count);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.restore_bulk_operation_state(UUID) TO authenticated;

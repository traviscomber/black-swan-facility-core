-- Enhanced bulk operations table with audit trail
ALTER TABLE IF EXISTS public.bulk_operations ADD COLUMN IF NOT EXISTS previous_state JSONB DEFAULT NULL;
ALTER TABLE IF EXISTS public.bulk_operations ADD COLUMN IF NOT EXISTS operation_details JSONB DEFAULT NULL;
ALTER TABLE IF EXISTS public.bulk_operations ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS public.bulk_operations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bulk_operations_reservation_ids ON public.bulk_operations USING GIN (reservation_ids);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_at ON public.bulk_operations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_user_id ON public.bulk_operations (user_id);

-- RPC function to restore bulk operation state
CREATE OR REPLACE FUNCTION public.restore_bulk_operation_state(p_operation_id UUID)
RETURNS TABLE(success BOOLEAN, restored_count INT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_previous_state JSONB;
  v_reservation_ids TEXT[];
BEGIN
  SELECT previous_state, reservation_ids INTO v_previous_state, v_reservation_ids
  FROM public.bulk_operations
  WHERE id = p_operation_id;

  IF v_previous_state IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Restore each reservation to its previous state
  UPDATE public.reservations r
  SET 
    check_in = (v_previous_state -> 'reservations'::text ->> r.id::text)::TIMESTAMP::DATE,
    check_out = (v_previous_state -> 'reservations'::text ->> r.id::text)::TIMESTAMP::DATE,
    status = 'pending'
  WHERE id = ANY(v_reservation_ids::UUID[]);

  RETURN QUERY SELECT true, ARRAY_LENGTH(v_reservation_ids, 1);
END $$;

GRANT EXECUTE ON FUNCTION public.restore_bulk_operation_state TO authenticated;

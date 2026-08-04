CREATE UNIQUE INDEX IF NOT EXISTS housekeeping_tasks_one_turnover_per_reservation
ON public.housekeeping_tasks (reservation_id)
WHERE reservation_id IS NOT NULL AND task_type = 'turnover';

CREATE OR REPLACE FUNCTION public.create_checkout_housekeeping_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('checked_out', 'checked-out')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.room_id IS NOT NULL THEN
    INSERT INTO public.housekeeping_tasks (
      reservation_id,
      room_id,
      task_type,
      status,
      priority,
      notes
    )
    VALUES (
      NEW.id,
      NEW.room_id,
      'turnover',
      'pending',
      'high',
      format('Limpieza automática posterior al check-out de %s, reserva %s.', NEW.guest_name, NEW.id)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_housekeeping_task() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reservations_create_checkout_housekeeping_task ON public.reservations;
CREATE TRIGGER reservations_create_checkout_housekeeping_task
AFTER UPDATE OF status ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.create_checkout_housekeeping_task();

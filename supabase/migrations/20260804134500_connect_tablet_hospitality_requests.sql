-- Allow property-level hospitality requests while preserving room-level requests.
-- Add traceable links to reservations and the originating tablet device.

ALTER TABLE public.hospitality_requests
  ALTER COLUMN room_id DROP NOT NULL;

ALTER TABLE public.hospitality_requests
  ADD COLUMN IF NOT EXISTS reservation_id uuid
  REFERENCES public.reservations(id)
  ON DELETE SET NULL;

ALTER TABLE public.hospitality_requests
  ADD COLUMN IF NOT EXISTS tablet_device_id text;

CREATE INDEX IF NOT EXISTS hospitality_requests_reservation_id_idx
  ON public.hospitality_requests(reservation_id);

CREATE INDEX IF NOT EXISTS hospitality_requests_tablet_device_id_idx
  ON public.hospitality_requests(tablet_device_id);

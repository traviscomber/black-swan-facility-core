-- Keep booking quote availability resilient to invalid historical date ranges.

begin;

create or replace function public.calculate_booking_quote(
  p_check_in date,
  p_check_out date,
  p_guests integer default 1,
  p_room_id uuid default null,
  p_extras jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n
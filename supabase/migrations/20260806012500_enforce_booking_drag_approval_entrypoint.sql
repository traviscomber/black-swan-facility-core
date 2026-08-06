revoke execute on function public.move_booking_reservation(uuid, uuid, date, date) from public, anon, authenticated;
revoke execute on function public.resize_booking_reservation(uuid, date, date) from public, anon, authenticated;

grant execute on function public.move_booking_reservation(uuid, uuid, date, date) to service_role;
grant execute on function public.resize_booking_reservation(uuid, date, date) to service_role;

comment on function public.move_booking_reservation(uuid, uuid, date, date) is
  'Internal booking mutation. Use apply_or_queue_booking_drag from authenticated clients.';
comment on function public.resize_booking_reservation(uuid, date, date) is
  'Internal booking mutation. Use apply_or_queue_booking_drag from authenticated clients.';

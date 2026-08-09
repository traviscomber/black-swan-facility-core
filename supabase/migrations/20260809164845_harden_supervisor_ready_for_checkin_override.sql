revoke all on function public.supervisor_mark_reservation_ready(uuid, text) from public;
revoke all on function public.supervisor_mark_reservation_ready(uuid, text) from anon;
grant execute on function public.supervisor_mark_reservation_ready(uuid, text) to authenticated;
grant execute on function public.supervisor_mark_reservation_ready(uuid, text) to service_role;

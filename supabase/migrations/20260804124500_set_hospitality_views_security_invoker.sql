-- Ensure hospitality views respect the querying user's permissions and RLS.
ALTER VIEW public.units SET (security_invoker = true);
ALTER VIEW public.room_state_matrix SET (security_invoker = true);

-- PostgreSQL grants EXECUTE to PUBLIC on newly created functions by default.
-- These helpers are internal authorization/trigger functions and must not be
-- exposed to anonymous callers.

revoke all on function public.can_access_operational_task_scope(text, uuid) from public;
revoke all on function public.can_access_operational_task(uuid) from public;
revoke all on function public.guard_operational_task_scope_write() from public;
revoke all on function public.guard_operational_task_child_scope_write() from public;

-- RLS expressions execute the authorization helpers as authenticated users.
grant execute on function public.can_access_operational_task_scope(text, uuid) to authenticated, service_role;
grant execute on function public.can_access_operational_task(uuid) to authenticated, service_role;

-- Trigger functions do not need direct authenticated API execution.
grant execute on function public.guard_operational_task_scope_write() to service_role;
grant execute on function public.guard_operational_task_child_scope_write() to service_role;

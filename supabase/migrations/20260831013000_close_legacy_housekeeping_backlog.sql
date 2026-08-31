-- Historical housekeeping tasks from the August test/seed operating window are no longer actionable.
-- Preserve the records for auditability, but remove them from active operational health signals.
update public.housekeeping_tasks
set status = 'cancelled',
    resolution_notes = case
      when coalesce(trim(resolution_notes), '') = '' then
        'Legacy housekeeping data closed during production cleanup; historical task, no current operational action required.'
      else
        resolution_notes || E'\nLegacy housekeeping data closed during production cleanup; historical task, no current operational action required.'
    end,
    updated_at = now()
where coalesce(due_at, scheduled_for) < timestamp with time zone '2026-08-15 00:00:00+00'
  and lower(status) in ('pending', 'in_progress');

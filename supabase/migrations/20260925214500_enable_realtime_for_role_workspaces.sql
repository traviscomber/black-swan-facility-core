-- Enable live workspace signals for booking, hospitality, cattle and vineyard.
-- finance_documents is already published; these operational tables were not.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'reservations',
    'hospitality_requests',
    'housekeeping_tasks',
    'rooms',
    'cattle_animals',
    'cattle_health_alerts',
    'vineyard_plots',
    'vineyard_pest_logs'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

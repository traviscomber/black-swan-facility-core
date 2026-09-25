-- Keep Raimundo's daily field round live when canonical tasks change.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$$;

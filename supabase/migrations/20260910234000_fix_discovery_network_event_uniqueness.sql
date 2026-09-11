do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.discovery_networks'::regclass
      and conname = 'discovery_networks_event_id_key'
  ) then
    alter table public.discovery_networks
      add constraint discovery_networks_event_id_key unique (event_id);
  end if;
end
$$;

create or replace function public.sync_inventory_asset_maintenance_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset_id uuid := case when tg_op = 'DELETE' then old.asset_id else new.asset_id end;
  v_old_state text := case when tg_op = 'INSERT' then null else coalesce(old.estado_extendido, old.status, 'draft') end;
  v_new_state text := case when tg_op = 'DELETE' then null else coalesce(new.estado_extendido, new.status, 'draft') end;
  v_has_active boolean;
begin
  if v_asset_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op <> 'DELETE' and v_new_state in ('in_progress','blocked') then
    update public.assets
       set status = 'maintenance', updated_at = now()
     where id = v_asset_id and coalesce(status, 'active') <> 'deprecated';
  elsif (tg_op = 'DELETE' and v_old_state in ('in_progress','blocked'))
     or (tg_op = 'UPDATE' and v_old_state in ('in_progress','blocked') and v_new_state not in ('in_progress','blocked')) then
    select exists (
      select 1
      from public.maintenance_tasks mt
      where mt.asset_id = v_asset_id
        and (tg_op = 'DELETE' or mt.id <> new.id)
        and coalesce(mt.estado_extendido, mt.status, '') in ('in_progress','blocked')
    ) into v_has_active;

    if not v_has_active then
      update public.assets
         set status = 'active', updated_at = now()
       where id = v_asset_id and status = 'maintenance';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_inventory_asset_maintenance_status() from public, anon, authenticated;

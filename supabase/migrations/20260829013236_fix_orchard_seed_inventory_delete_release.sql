create or replace function public.orchard_sync_nursery_seed_inventory()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  if tg_op = 'INSERT' then
    if new.seed_lot_id is not null and new.seeds_sown > 0 then
      update public.orchard_seed_lots
      set quantity_seeds = quantity_seeds - new.seeds_sown,
          updated_at = now()
      where id = new.seed_lot_id
        and quantity_seeds >= new.seeds_sown;
      get diagnostics affected = row_count;
      if affected <> 1 then
        raise exception 'Insufficient seed inventory for nursery batch';
      end if;

      insert into public.orchard_seed_inventory_movements (
        seed_lot_id, nursery_batch_id, movement_type, quantity_delta, occurred_on, reason
      ) values (
        new.seed_lot_id, new.id, 'nursery_sow', -new.seeds_sown, new.sow_date, 'Seeds committed to nursery batch'
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and (
    old.seed_lot_id is distinct from new.seed_lot_id or
    old.seeds_sown is distinct from new.seeds_sown
  ) then
    if old.seed_lot_id is not null and old.seeds_sown > 0 then
      update public.orchard_seed_lots
      set quantity_seeds = quantity_seeds + old.seeds_sown,
          updated_at = now()
      where id = old.seed_lot_id;

      insert into public.orchard_seed_inventory_movements (
        seed_lot_id, nursery_batch_id, movement_type, quantity_delta, occurred_on, reason
      ) values (
        old.seed_lot_id, old.id, 'nursery_release', old.seeds_sown, current_date, 'Previous nursery seed commitment released'
      );
    end if;

    if new.seed_lot_id is not null and new.seeds_sown > 0 then
      update public.orchard_seed_lots
      set quantity_seeds = quantity_seeds - new.seeds_sown,
          updated_at = now()
      where id = new.seed_lot_id
        and quantity_seeds >= new.seeds_sown;
      get diagnostics affected = row_count;
      if affected <> 1 then
        raise exception 'Insufficient seed inventory for nursery batch';
      end if;

      insert into public.orchard_seed_inventory_movements (
        seed_lot_id, nursery_batch_id, movement_type, quantity_delta, occurred_on, reason
      ) values (
        new.seed_lot_id, new.id, 'nursery_adjustment', -new.seeds_sown, current_date, 'Nursery seed commitment adjusted'
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.seed_lot_id is not null and old.seeds_sown > 0 then
      update public.orchard_seed_lots
      set quantity_seeds = quantity_seeds + old.seeds_sown,
          updated_at = now()
      where id = old.seed_lot_id;

      insert into public.orchard_seed_inventory_movements (
        seed_lot_id, nursery_batch_id, movement_type, quantity_delta, occurred_on, reason
      ) values (
        old.seed_lot_id, null, 'nursery_release', old.seeds_sown, current_date, 'Nursery batch ' || old.id::text || ' deleted; seed commitment released'
      );
    end if;
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.orchard_sync_nursery_seed_inventory() from public, anon, authenticated;
create table if not exists public.orchard_seed_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  seed_lot_id uuid not null references public.orchard_seed_lots(id) on delete cascade,
  nursery_batch_id uuid references public.orchard_nursery_batches(id) on delete set null,
  movement_type text not null check (movement_type in ('opening_balance','receipt','adjustment','nursery_sow','nursery_adjustment','nursery_release','write_off','return')),
  quantity_delta integer not null check (quantity_delta <> 0),
  occurred_on date not null default current_date,
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists orchard_seed_inventory_movements_lot_date_idx
  on public.orchard_seed_inventory_movements(seed_lot_id, occurred_on desc, created_at desc);
create index if not exists orchard_seed_inventory_movements_batch_idx
  on public.orchard_seed_inventory_movements(nursery_batch_id);

alter table public.orchard_seed_inventory_movements enable row level security;
grant select, insert on public.orchard_seed_inventory_movements to authenticated;

drop policy if exists "Internal staff can view orchard seed movements" on public.orchard_seed_inventory_movements;
create policy "Internal staff can view orchard seed movements"
on public.orchard_seed_inventory_movements for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));

drop policy if exists "Internal staff can add orchard seed movements" on public.orchard_seed_inventory_movements;
create policy "Internal staff can add orchard seed movements"
on public.orchard_seed_inventory_movements for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'procurement_role') = any (array['admin', 'approver']));

create or replace function public.orchard_seed_lot_opening_balance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.quantity_seeds > 0 then
    insert into public.orchard_seed_inventory_movements (
      seed_lot_id, movement_type, quantity_delta, occurred_on, reason
    ) values (
      new.id, 'opening_balance', new.quantity_seeds, coalesce(new.received_date, current_date), 'Seed lot opening balance'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.orchard_seed_lot_opening_balance() from public, anon, authenticated;

drop trigger if exists orchard_seed_lot_opening_balance_trigger on public.orchard_seed_lots;
create trigger orchard_seed_lot_opening_balance_trigger
after insert on public.orchard_seed_lots
for each row execute function public.orchard_seed_lot_opening_balance();

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
        old.seed_lot_id, old.id, 'nursery_release', old.seeds_sown, current_date, 'Nursery batch deleted; seed commitment released'
      );
    end if;
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.orchard_sync_nursery_seed_inventory() from public, anon, authenticated;

drop trigger if exists orchard_nursery_seed_inventory_trigger on public.orchard_nursery_batches;
create trigger orchard_nursery_seed_inventory_trigger
after insert or update of seed_lot_id, seeds_sown or delete on public.orchard_nursery_batches
for each row execute function public.orchard_sync_nursery_seed_inventory();

insert into public.orchard_seed_inventory_movements (
  seed_lot_id, movement_type, quantity_delta, occurred_on, reason, created_by
)
select id, 'opening_balance', quantity_seeds, coalesce(received_date, current_date), 'Seed lot opening balance (migration)', created_by
from public.orchard_seed_lots
where quantity_seeds > 0
  and not exists (
    select 1 from public.orchard_seed_inventory_movements m
    where m.seed_lot_id = orchard_seed_lots.id and m.movement_type = 'opening_balance'
  );
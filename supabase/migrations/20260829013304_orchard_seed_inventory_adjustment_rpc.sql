create or replace function public.orchard_adjust_seed_inventory(
  p_seed_lot_id uuid,
  p_quantity_delta integer,
  p_reason text,
  p_movement_type text default 'adjustment',
  p_occurred_on date default current_date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_quantity_delta = 0 then
    raise exception 'Seed inventory adjustment cannot be zero';
  end if;

  if p_movement_type not in ('receipt','adjustment','write_off','return') then
    raise exception 'Unsupported seed inventory movement type';
  end if;

  if p_movement_type in ('receipt','return') and p_quantity_delta < 0 then
    raise exception 'Receipt and return movements must increase inventory';
  end if;

  if p_movement_type = 'write_off' and p_quantity_delta > 0 then
    raise exception 'Write-off movements must decrease inventory';
  end if;

  update public.orchard_seed_lots
  set quantity_seeds = quantity_seeds + p_quantity_delta,
      updated_at = now()
  where id = p_seed_lot_id
    and quantity_seeds + p_quantity_delta >= 0
  returning quantity_seeds into new_balance;

  if new_balance is null then
    raise exception 'Seed inventory adjustment would create negative stock or seed lot is unavailable';
  end if;

  insert into public.orchard_seed_inventory_movements (
    seed_lot_id, movement_type, quantity_delta, occurred_on, reason
  ) values (
    p_seed_lot_id, p_movement_type, p_quantity_delta, coalesce(p_occurred_on, current_date), nullif(trim(p_reason), '')
  );

  return new_balance;
end;
$$;

revoke all on function public.orchard_adjust_seed_inventory(uuid, integer, text, text, date) from public, anon;
grant execute on function public.orchard_adjust_seed_inventory(uuid, integer, text, text, date) to authenticated;
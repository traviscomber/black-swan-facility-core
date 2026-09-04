begin;

-- Stage 6: close the remaining location-scope gap across the downstream
-- Procurement receiving chain. The canonical request layer intentionally
-- remains nullable for unreconciled legacy requests, but no purchase order,
-- receipt or inventory intake may proceed without a canonical location.
do $$
begin
  if exists (select 1 from public.procurement_purchase_orders where location_id is null) then
    raise exception 'Cannot enforce procurement purchase-order location scope while NULL locations exist';
  end if;
  if exists (select 1 from public.procurement_receipts where location_id is null) then
    raise exception 'Cannot enforce procurement receipt location scope while NULL locations exist';
  end if;
  if exists (select 1 from public.procurement_inventory_intake where location_id is null) then
    raise exception 'Cannot enforce procurement inventory-intake location scope while NULL locations exist';
  end if;
end
$$;

alter table public.procurement_purchase_orders
  alter column location_id set not null;

alter table public.procurement_receipts
  alter column location_id set not null;

alter table public.procurement_inventory_intake
  alter column location_id set not null;

-- Purchase orders: Procurement managers/approvers and Inventory processors
-- may only see rows inside their effective operational scope.
drop policy if exists procurement_purchase_orders_read_scoped
  on public.procurement_purchase_orders;
create policy procurement_purchase_orders_read_scoped
  on public.procurement_purchase_orders
  for select
  to authenticated
  using (
    (
      (
        public.internal_can_action('procurement.manage')
        or public.internal_can_action('procurement.approve')
      )
      and public.can_access_operational_scope('procurement', location_id, null)
    )
    or
    (
      public.internal_can_action('inventory.process')
      and public.can_access_operational_scope('inventory', location_id, null)
    )
  );

drop policy if exists procurement_purchase_orders_write_scoped
  on public.procurement_purchase_orders;
create policy procurement_purchase_orders_write_scoped
  on public.procurement_purchase_orders
  for all
  to authenticated
  using (
    (
      public.internal_can_action('procurement.manage')
      or public.internal_can_action('procurement.approve')
    )
    and public.can_access_operational_scope('procurement', location_id, null)
  )
  with check (
    (
      public.internal_can_action('procurement.manage')
      or public.internal_can_action('procurement.approve')
    )
    and public.can_access_operational_scope('procurement', location_id, null)
  );

-- Receipts: Procurement and Inventory each evaluate the concrete row location
-- in their own department scope. This replaces the previous NULL-scope check.
drop policy if exists procurement_receipts_read_scoped
  on public.procurement_receipts;
create policy procurement_receipts_read_scoped
  on public.procurement_receipts
  for select
  to authenticated
  using (
    (
      public.internal_can_action('procurement.manage')
      and public.can_access_operational_scope('procurement', location_id, null)
    )
    or
    (
      public.internal_can_action('inventory.process')
      and public.can_access_operational_scope('inventory', location_id, null)
    )
  );

drop policy if exists procurement_receipts_write_scoped
  on public.procurement_receipts;
create policy procurement_receipts_write_scoped
  on public.procurement_receipts
  for all
  to authenticated
  using (
    public.internal_can_action('procurement.manage')
    and public.can_access_operational_scope('procurement', location_id, null)
  )
  with check (
    public.internal_can_action('procurement.manage')
    and public.can_access_operational_scope('procurement', location_id, null)
  );

commit;

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

-- Purchase orders keep their existing authorization model and add the missing
-- row-level Procurement location boundary.
drop policy if exists procurement_purchase_orders_read_authorized
  on public.procurement_purchase_orders;
create policy procurement_purchase_orders_read_authorized
  on public.procurement_purchase_orders
  for select
  to authenticated
  using (
    public.can_app_action('procurement.operate')
    and public.can_access_operational_scope('procurement', location_id)
  );

drop policy if exists procurement_purchase_orders_create
  on public.procurement_purchase_orders;
create policy procurement_purchase_orders_create
  on public.procurement_purchase_orders
  for insert
  to authenticated
  with check (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin', 'approver'])
    and public.can_access_operational_scope('procurement', location_id)
  );

drop policy if exists procurement_purchase_orders_update
  on public.procurement_purchase_orders;
create policy procurement_purchase_orders_update
  on public.procurement_purchase_orders
  for update
  to authenticated
  using (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin', 'approver'])
    and public.can_access_operational_scope('procurement', location_id)
  )
  with check (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'procurement_role'), '') = any (array['admin', 'approver'])
    and public.can_access_operational_scope('procurement', location_id)
  );

-- Receipts replace the previous NULL-scope read and permission-only writes
-- with the concrete location attached to each row.
drop policy if exists procurement_receipts_select_scoped
  on public.procurement_receipts;
create policy procurement_receipts_select_scoped
  on public.procurement_receipts
  for select
  to authenticated
  using (
    public.can_app_action('procurement.operate')
    and public.can_access_operational_scope('procurement', location_id)
  );

drop policy if exists procurement_receipts_insert_authorized
  on public.procurement_receipts;
create policy procurement_receipts_insert_authorized
  on public.procurement_receipts
  for insert
  to authenticated
  with check (
    public.can_app_action('procurement.operate')
    and public.can_access_operational_scope('procurement', location_id)
  );

drop policy if exists procurement_receipts_update_authorized
  on public.procurement_receipts;
create policy procurement_receipts_update_authorized
  on public.procurement_receipts
  for update
  to authenticated
  using (
    public.can_app_action('procurement.operate')
    and public.can_access_operational_scope('procurement', location_id)
  )
  with check (
    public.can_app_action('procurement.operate')
    and public.can_access_operational_scope('procurement', location_id)
  );

-- Intake already had a scoped read policy but allowed NULL locations and its
-- insert/update policies were permission-only. Keep the same action contract
-- while failing closed on the canonical location.
drop policy if exists procurement_inventory_intake_select_scoped
  on public.procurement_inventory_intake;
create policy procurement_inventory_intake_select_scoped
  on public.procurement_inventory_intake
  for select
  to authenticated
  using (
    public.can_app_action('inventory.process')
    and public.can_access_operational_scope('inventory', location_id)
  );

drop policy if exists procurement_inventory_intake_insert_authorized
  on public.procurement_inventory_intake;
create policy procurement_inventory_intake_insert_authorized
  on public.procurement_inventory_intake
  for insert
  to authenticated
  with check (
    public.can_app_action('inventory.process')
    and public.can_access_operational_scope('inventory', location_id)
  );

drop policy if exists procurement_inventory_intake_update_authorized
  on public.procurement_inventory_intake;
create policy procurement_inventory_intake_update_authorized
  on public.procurement_inventory_intake
  for update
  to authenticated
  using (
    public.can_app_action('inventory.process')
    and public.can_access_operational_scope('inventory', location_id)
  )
  with check (
    public.can_app_action('inventory.process')
    and public.can_access_operational_scope('inventory', location_id)
  );

commit;

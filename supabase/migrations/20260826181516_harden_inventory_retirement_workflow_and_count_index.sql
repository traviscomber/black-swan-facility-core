create index if not exists idx_inventory_stock_items_last_counted_by
  on public.inventory_stock_items(last_counted_by)
  where last_counted_by is not null;

drop policy if exists asset_retirement_insert_inventory on public.asset_retirement_requests;
drop policy if exists asset_retirement_update_inventory on public.asset_retirement_requests;
drop policy if exists asset_retirement_read_authorized on public.asset_retirement_requests;
drop policy if exists asset_retirement_select_inventory on public.asset_retirement_requests;

create policy asset_retirement_select_inventory_scoped
on public.asset_retirement_requests
for select
to authenticated
using (
  public.can_app_action('inventory.process')
  and exists (
    select 1
    from public.assets a
    left join public.warehouse_locations wl on wl.id = a.warehouse_location_id
    left join public.warehouses w on w.id = wl.warehouse_id
    where a.id = asset_retirement_requests.asset_id
      and (
        a.warehouse_location_id is null
        or public.can_access_operational_scope('inventory', w.location_id)
      )
  )
);

comment on table public.asset_retirement_requests is
  'Inventory retirement workflow. Authenticated clients may read scoped requests, but writes must go through request/review/execute inventory retirement RPCs.';

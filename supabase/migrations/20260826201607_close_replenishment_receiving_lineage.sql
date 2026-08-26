create or replace function public.post_procurement_receipt(
  p_purchase_order_id uuid,
  p_received_quantity numeric,
  p_rejected_quantity numeric default 0,
  p_condition text default 'accepted',
  p_discrepancy_reason text default null,
  p_delivery_document text default null,
  p_evidence_url text default null,
  p_notes text default null,
  p_inventory_intake_required boolean default false,
  p_intake_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_po public.procurement_purchase_orders%rowtype;
  v_request public.procurement_requests%rowtype;
  v_receipt_id uuid;
  v_item_id uuid;
  v_total_received numeric;
  v_next_status text;
  v_is_replenishment boolean := false;
  v_intake_required boolean;
  v_intake_type text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('procurement.manage') then raise exception 'Procurement permission required'; end if;
  if p_received_quantity < 0 or p_rejected_quantity < 0 then raise exception 'Invalid quantities'; end if;
  if p_received_quantity + p_rejected_quantity <= 0 then raise exception 'A receipt must include a quantity'; end if;
  if p_condition not in ('accepted','partial_damage','damaged','incorrect') then raise exception 'Invalid condition'; end if;

  select * into v_po
  from public.procurement_purchase_orders
  where id=p_purchase_order_id
  for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_access_operational_scope('procurement',v_po.location_id) then raise exception 'Procurement scope required for this location'; end if;
  if v_po.status not in ('issued','acknowledged','confirmed','partially_received') then raise exception 'Purchase order is not receivable'; end if;

  select * into v_request
  from public.procurement_requests
  where id=v_po.request_id;
  if not found then raise exception 'Purchase request not found'; end if;

  select exists(
    select 1
    from public.inventory_replenishment_needs n
    where n.procurement_request_id=v_request.id
      and n.status in ('requested','approved','ordered','receiving')
  ) into v_is_replenishment;

  v_intake_required := p_inventory_intake_required or v_is_replenishment;
  v_intake_type := case when v_is_replenishment then 'consumable' else p_intake_type end;

  if p_inventory_intake_required and not v_is_replenishment and not public.can_app_action('inventory.process') then
    raise exception 'Inventory permission required to create a manual intake';
  end if;
  if v_intake_required and v_intake_type not in ('asset','consumable') then raise exception 'Intake type is required'; end if;

  select coalesce(sum(ri.received_quantity + ri.rejected_quantity),0)
    into v_total_received
  from public.procurement_receipt_items ri
  join public.procurement_receipts r on r.id=ri.receipt_id
  where r.purchase_order_id=p_purchase_order_id and r.status='posted';
  if v_total_received + p_received_quantity + p_rejected_quantity > v_request.quantity then raise exception 'Receipt exceeds ordered quantity'; end if;

  insert into public.procurement_receipts(purchase_order_id,receipt_number,status,received_by,delivery_document,evidence_url,notes,location_id)
  values(p_purchase_order_id,'REC-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS-MS'),'posted',v_user,nullif(trim(p_delivery_document),''),nullif(trim(p_evidence_url),''),nullif(trim(p_notes),''),v_po.location_id)
  returning id into v_receipt_id;

  insert into public.procurement_receipt_items(receipt_id,request_id,ordered_quantity,received_quantity,rejected_quantity,condition,discrepancy_reason,inventory_intake_required,intake_type)
  values(v_receipt_id,v_request.id,v_request.quantity,p_received_quantity,p_rejected_quantity,p_condition,nullif(trim(p_discrepancy_reason),''),v_intake_required,case when v_intake_required then v_intake_type else null end)
  returning id into v_item_id;

  if v_intake_required and p_received_quantity > 0 then
    insert into public.procurement_inventory_intake(receipt_item_id,intake_type,status,location_id,notes)
    values(v_item_id,v_intake_type,'pending',v_po.location_id,
      case when v_is_replenishment then 'Ingreso obligatorio generado por reposición de Inventario.' else 'Ingreso generado desde recepción de compra.' end);
  end if;

  v_total_received := v_total_received + p_received_quantity + p_rejected_quantity;
  v_next_status := case when v_total_received >= v_request.quantity then 'received' else 'partially_received' end;
  update public.procurement_purchase_orders set status=v_next_status,updated_at=now() where id=p_purchase_order_id;

  insert into public.procurement_audit_log(request_id,entity_type,entity_id,action,actor_type,actor_id,metadata)
  values(v_request.id,'purchase_order',p_purchase_order_id,'receipt_posted','user',v_user,
    jsonb_build_object('receipt_id',v_receipt_id,'received_quantity',p_received_quantity,'rejected_quantity',p_rejected_quantity,'condition',p_condition,'inventory_intake_required',v_intake_required,'intake_type',v_intake_type,'replenishment',v_is_replenishment));
  return v_receipt_id;
end;
$function$;
revoke all on function public.post_procurement_receipt(uuid,numeric,numeric,text,text,text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.post_procurement_receipt(uuid,numeric,numeric,text,text,text,text,text,boolean,text) to authenticated,service_role;

create or replace function public.process_procurement_inventory_intake(
  p_intake_id uuid,
  p_warehouse_location_id uuid,
  p_asset_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_asset_class text default 'equipment',
  p_minimum_stock numeric default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_intake_type text;
  v_intake_status text;
  v_receipt_item_id uuid;
  v_scope_location_id uuid;
  v_target_scope_location_id uuid;
  v_received numeric;
  v_request_id uuid;
  v_title text;
  v_category text;
  v_unit text;
  v_quantity numeric;
  v_description text;
  v_order_id uuid;
  v_order_number text;
  v_order_total numeric;
  v_asset_id uuid;
  v_stock_id uuid;
  v_replenishment_stock_id uuid;
  v_replenishment_location_id uuid;
  v_count integer;
  v_unit_cost numeric;
  v_code text;
  v_balance_before numeric := 0;
  v_balance_after numeric;
  i integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.can_app_action('inventory.process') then raise exception 'Inventory permission required'; end if;

  select intake_type,status,receipt_item_id,location_id
    into v_intake_type,v_intake_status,v_receipt_item_id,v_scope_location_id
  from public.procurement_inventory_intake
  where id=p_intake_id
  for update;
  if not found then raise exception 'Inventory intake not found'; end if;
  if not public.can_access_operational_scope('inventory',v_scope_location_id) then raise exception 'Inventory scope required for intake location'; end if;
  if v_intake_status<>'pending' then raise exception 'Inventory intake already processed or cancelled'; end if;
  if p_warehouse_location_id is null then raise exception 'Warehouse location is required'; end if;

  select w.location_id into v_target_scope_location_id
  from public.warehouse_locations wl
  join public.warehouses w on w.id=wl.warehouse_id
  where wl.id=p_warehouse_location_id and wl.is_active=true and w.is_active=true;
  if not found then raise exception 'Active destination warehouse location not found'; end if;
  if not public.can_access_operational_scope('inventory',v_target_scope_location_id) then raise exception 'Inventory scope required for destination location'; end if;

  select ri.received_quantity,r.id,r.title,r.category,r.unit,r.quantity,r.description
    into v_received,v_request_id,v_title,v_category,v_unit,v_quantity,v_description
  from public.procurement_receipt_items ri
  join public.procurement_requests r on r.id=ri.request_id
  where ri.id=v_receipt_item_id;

  select po.id,po.order_number,po.total
    into v_order_id,v_order_number,v_order_total
  from public.procurement_receipt_items ri
  join public.procurement_receipts pr on pr.id=ri.receipt_id
  join public.procurement_purchase_orders po on po.id=pr.purchase_order_id
  where ri.id=v_receipt_item_id;

  if v_received<=0 then raise exception 'Nothing accepted for inventory'; end if;
  v_unit_cost:=case when v_quantity>0 then round(v_order_total/v_quantity,2) else null end;

  select n.stock_item_id,si.warehouse_location_id
    into v_replenishment_stock_id,v_replenishment_location_id
  from public.inventory_replenishment_needs n
  join public.inventory_stock_items si on si.id=n.stock_item_id
  where n.procurement_request_id=v_request_id
    and n.status in ('requested','approved','ordered','receiving')
  order by n.created_at desc
  limit 1;

  if v_replenishment_stock_id is not null and v_intake_type <> 'consumable' then
    raise exception 'Replenishment intake must be consumable';
  end if;

  if v_intake_type='asset' then
    if p_asset_category_id is null or p_cost_center_id is null then raise exception 'Asset category and cost center are required'; end if;
    if p_asset_class not in ('equipment','infrastructure','tool','vehicle','other') then raise exception 'Invalid asset class'; end if;
    if v_received<>trunc(v_received) then raise exception 'Asset quantity must be a whole number'; end if;
    v_count:=v_received::integer;
    if v_count>100 then raise exception 'Maximum 100 assets per intake'; end if;

    for i in 1..v_count loop
      v_code:='FC-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      insert into public.assets(name,type,asset_code,category_id,cost_center_id,purchase_date,purchase_price,status,warehouse_location_id,asset_class,description,notes,created_by)
      values(v_title,lower(coalesce(v_category,'equipment')),v_code,p_asset_category_id,p_cost_center_id,current_date,v_unit_cost,'active',p_warehouse_location_id,p_asset_class,v_description,concat_ws(E'\n','Creado desde recepción de compra '||coalesce(v_order_number,v_order_id::text),p_notes),v_user)
      returning id into v_asset_id;
      insert into public.inventory_movements(asset_id,movement_type,to_location_id,notes,moved_by)
      values(v_asset_id,'receipt',p_warehouse_location_id,'Ingreso desde recepción de compra',v_user);
      insert into public.asset_logs(asset_id,log_type,description,created_by)
      values(v_asset_id,'procurement_receipt','Activo creado desde recepción de compra',v_user);
      insert into public.procurement_intake_assets(intake_id,asset_id) values(p_intake_id,v_asset_id);
    end loop;

    update public.procurement_inventory_intake
    set status='processed',warehouse_location_id=p_warehouse_location_id,asset_category_id=p_asset_category_id,cost_center_id=p_cost_center_id,linked_asset_id=v_asset_id,processed_quantity=v_received,reconciliation_status='matched',processed_by=v_user,processed_at=now(),notes=p_notes,updated_at=now()
    where id=p_intake_id;
    return jsonb_build_object('type','asset','created',v_count,'last_asset_id',v_asset_id);

  elsif v_intake_type='consumable' then
    if v_replenishment_stock_id is not null and p_warehouse_location_id <> v_replenishment_location_id then
      raise exception 'Replenishment intake must return to the originating stock location';
    end if;
    if public.inventory_location_count_locked(p_warehouse_location_id) then raise exception 'Destination location is frozen by an active inventory count'; end if;

    if v_replenishment_stock_id is not null then
      select id,quantity_on_hand into v_stock_id,v_balance_before
      from public.inventory_stock_items
      where id=v_replenishment_stock_id and is_active=true
      for update;
      if not found then raise exception 'Originating replenishment stock item not found or inactive'; end if;

      update public.inventory_stock_items
      set quantity_on_hand=quantity_on_hand+v_received,
          unit_cost=coalesce(v_unit_cost,unit_cost),
          cost_center_id=coalesce(p_cost_center_id,cost_center_id),
          updated_at=now()
      where id=v_stock_id
      returning quantity_on_hand into v_balance_after;
    else
      select id,quantity_on_hand into v_stock_id,v_balance_before
      from public.inventory_stock_items
      where name=v_title and warehouse_location_id=p_warehouse_location_id and unit=v_unit
      for update;

      if v_stock_id is null then
        v_code:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
        v_balance_before:=0;
        insert into public.inventory_stock_items(item_code,name,category,unit,warehouse_location_id,cost_center_id,quantity_on_hand,minimum_stock,unit_cost,source_request_id,created_by)
        values(v_code,v_title,v_category,v_unit,p_warehouse_location_id,p_cost_center_id,v_received,greatest(coalesce(p_minimum_stock,0),0),v_unit_cost,v_request_id,v_user)
        returning id,quantity_on_hand into v_stock_id,v_balance_after;
      else
        update public.inventory_stock_items
        set quantity_on_hand=quantity_on_hand+v_received,unit_cost=coalesce(v_unit_cost,unit_cost),cost_center_id=coalesce(p_cost_center_id,cost_center_id),updated_at=now()
        where id=v_stock_id
        returning quantity_on_hand into v_balance_after;
      end if;
    end if;

    insert into public.inventory_stock_movements(stock_item_id,movement_type,quantity,unit_cost,balance_before,balance_after,to_location_id,procurement_intake_id,notes,moved_by,moved_at)
    values(v_stock_id,'receipt',v_received,v_unit_cost,v_balance_before,v_balance_after,p_warehouse_location_id,p_intake_id,
      coalesce(p_notes,case when v_replenishment_stock_id is not null then 'Reposición recibida desde compra vinculada' else 'Ingreso desde recepción de compra' end),v_user,now());

    update public.procurement_inventory_intake
    set status='processed',warehouse_location_id=p_warehouse_location_id,cost_center_id=coalesce(p_cost_center_id,cost_center_id),linked_stock_item_id=v_stock_id,processed_quantity=v_received,reconciliation_status='matched',processed_by=v_user,processed_at=now(),notes=p_notes,updated_at=now()
    where id=p_intake_id;
    return jsonb_build_object('type','consumable','stock_item_id',v_stock_id,'quantity_added',v_received,'balance_before',v_balance_before,'balance_after',v_balance_after,'replenishment_lineage',v_replenishment_stock_id is not null);
  end if;

  raise exception 'Unsupported intake type';
end;
$function$;
revoke all on function public.process_procurement_inventory_intake(uuid,uuid,uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.process_procurement_inventory_intake(uuid,uuid,uuid,uuid,text,numeric,text) to authenticated,service_role;

create or replace function public.sync_inventory_replenishment_from_intake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id uuid;
  v_need public.inventory_replenishment_needs%rowtype;
  v_stock public.inventory_stock_items%rowtype;
  v_order_status text;
  v_pending_intakes integer;
begin
  if new.status <> 'processed' or old.status is not distinct from new.status or new.intake_type <> 'consumable' then return new; end if;

  select ri.request_id into v_request_id
  from public.procurement_receipt_items ri
  where ri.id=new.receipt_item_id;

  select * into v_need
  from public.inventory_replenishment_needs
  where procurement_request_id=v_request_id
    and status in ('requested','approved','ordered','receiving')
  order by created_at desc limit 1
  for update;
  if not found then return new; end if;

  if new.linked_stock_item_id is distinct from v_need.stock_item_id then
    update public.procurement_inventory_intake
    set reconciliation_status='exception',updated_at=now(),notes=concat_ws(E'\n',notes,'Reposición procesada contra un SKU distinto al origen; requiere revisión.')
    where id=new.id;
    update public.inventory_replenishment_needs
    set status='receiving',receiving_at=coalesce(receiving_at,now()),last_event_at=now(),updated_at=now(),resolution_reason='Inventory intake SKU mismatch requires review.'
    where id=v_need.id;
    return new;
  end if;

  select * into v_stock from public.inventory_stock_items where id=v_need.stock_item_id;

  select po.status into v_order_status
  from public.procurement_purchase_orders po
  where po.request_id=v_request_id and po.status <> 'cancelled'
  order by po.created_at desc limit 1;

  select count(*) into v_pending_intakes
  from public.procurement_inventory_intake pi
  join public.procurement_receipt_items ri on ri.id=pi.receipt_item_id
  where ri.request_id=v_request_id and pi.intake_type='consumable' and pi.status='pending';

  if v_stock.quantity_on_hand > v_stock.minimum_stock then
    update public.inventory_replenishment_needs
    set status='fulfilled',fulfilled_at=now(),last_event_at=now(),updated_at=now(),resolution_reason='Stock recovered above minimum after linked procurement intake.'
    where id=v_need.id;
    return new;
  end if;

  if v_order_status='received' and v_pending_intakes=0 then
    update public.inventory_replenishment_needs
    set status='fulfilled',fulfilled_at=now(),last_event_at=now(),updated_at=now(),resolution_reason='Purchase cycle closed but stock remains at or below minimum; a new replenishment need will be opened.'
    where id=v_need.id;
    perform public.refresh_inventory_replenishment_need(v_need.stock_item_id);
    return new;
  end if;

  update public.inventory_replenishment_needs
  set status='receiving',receiving_at=coalesce(receiving_at,now()),last_event_at=now(),updated_at=now(),resolution_reason=null
  where id=v_need.id;
  return new;
end;
$function$;
revoke all on function public.sync_inventory_replenishment_from_intake() from public,anon,authenticated;

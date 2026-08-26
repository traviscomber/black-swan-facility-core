export interface WarehouseInfo {
  id: string
  code: string
  name: string
}

export interface WarehouseLocationInfo {
  id: string
  code: string
  name: string
  warehouse?: WarehouseInfo | null
}

export interface InventoryMetadataOption {
  id: string
  name: string
  code?: string | null
  color?: string | null
}

export interface InventoryAsset {
  id: string
  asset_code: string
  name: string
  description?: string | null
  category_id?: string | null
  cost_center_id?: string | null
  warehouse_location_id?: string | null
  asset_class?: string | null
  category?: { name: string; color?: string | null } | null
  cost_center?: { name: string; code?: string | null } | null
  warehouse_location?: WarehouseLocationInfo | null
  serial_number?: string | null
  brand?: string | null
  model?: string | null
  purchase_date?: string | null
  purchase_price?: number | null
  status: string
  location?: string | null
  assigned_to?: string | null
  notes?: string | null
  photo_url?: string | null
  qr_code_url?: string | null
  type?: string | null
  created_at?: string | null
}

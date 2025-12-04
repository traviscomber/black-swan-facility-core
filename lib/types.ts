// TypeScript types for Black Swan Facility Core

export interface Asset {
  id: string
  name: string
  type: string
  location: string | null
  description: string | null
  is_critical: boolean
  qr_code_url: string | null
  photo_url: string | null
  manual_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

export interface AssetLog {
  id: string
  asset_id: string
  log_type: string | null
  description: string | null
  photo_url: string | null
  created_by: string | null
  created_at: string
}

export interface Employee {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

export interface MaintenanceTask {
  id: string
  asset_id: string | null
  title: string
  description: string | null
  frequency: string | null
  next_run: string | null
  last_completed: string | null
  assigned_to: string | null
  status: string
  created_at: string
}

export interface Issue {
  id: string
  asset_id: string | null
  reported_by: string | null
  description: string | null
  status: string
  photo_url: string | null
  created_at: string
}

export interface Utility {
  id: string
  category: string | null
  status: string | null
  notes: string | null
  last_update: string
}

export interface Checklist {
  id: string
  title: string | null
  description: string | null
  frequency: string | null
  assigned_to: string | null
  created_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  item: string | null
  is_completed: boolean
  completed_at: string | null
}

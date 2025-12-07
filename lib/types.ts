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

export interface AIAgent {
  id: string
  name: string
  type: "maintenance" | "issue_resolution" | "documentation" | "communication" | "execution"
  description: string | null
  status: "active" | "paused" | "disabled"
  config: Record<string, any>
  last_run: string | null
  created_at: string
}

export interface AIAgentExecution {
  id: string
  agent_id: string
  status: "running" | "completed" | "failed"
  input_data: Record<string, any> | null
  output_data: Record<string, any> | null
  error_message: string | null
  duration_ms: number | null
  created_at: string
  completed_at: string | null
}

export interface AIAgentMemory {
  id: string
  agent_id: string
  memory_type: "short_term" | "long_term" | "context"
  content: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  expires_at: string | null
}

export interface AIAutomationRule {
  id: string
  name: string
  agent_id: string | null
  trigger_type: "schedule" | "event" | "threshold"
  trigger_config: Record<string, any>
  action_type: string
  action_config: Record<string, any>
  is_active: boolean
  last_triggered: string | null
  created_at: string
}

export interface AIOperationLog {
  id: string
  agent_id: string | null
  execution_id: string | null
  log_level: "debug" | "info" | "warn" | "error"
  message: string
  metadata: Record<string, any>
  created_at: string
}

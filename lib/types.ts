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
  infrastructure_id: string | null
  issue_type_id: string | null
  reported_by: string | null
  description: string | null
  status: string
  severity: string
  photo_url: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

export interface IssueType {
  id: string
  name: string
  category: string
  description: string | null
  severity: string
  is_active: boolean
  is_custom: boolean
  created_at: string
  updated_at: string
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

export interface Room {
  id: string
  room_number: string
  room_type: string
  capacity: number
  status: "clean" | "occupied" | "dirty" | "maintenance"
  location: string | null
  amenities: string[] | null
  rate_per_night: number | null
  notes: string | null
  created_at: string
}

export interface Reservation {
  id: string
  room_id: string | null
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: "confirmed" | "checked-in" | "checked-out" | "cancelled"
  num_guests: number
  special_requests: string | null
  total_amount: number | null
  created_at: string
}

export interface HousekeepingTask {
  id: string
  room_id: string | null
  task_type: string
  status: "pending" | "in-progress" | "completed"
  assigned_to: string | null
  priority: "low" | "normal" | "high" | "urgent"
  notes: string | null
  completed_at: string | null
  created_at: string
}

export interface GuestRequest {
  id: string
  reservation_id: string | null
  request_type: string
  description: string
  status: "open" | "in-progress" | "resolved"
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
}

export interface AISession {
  id: string
  agent_id: string | null
  title: string
  status: "active" | "completed" | "failed"
  context_summary: Record<string, any>
  metadata: Record<string, any>
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface AIEvent {
  id: string
  session_id: string
  event_type: string
  event_data: Record<string, any>
  context_snapshot: Record<string, any> | null
  created_at: string
}

export interface AIContext {
  id: string
  session_id: string
  context_type: string
  context_data: Record<string, any>
  priority: number
  is_compacted: boolean
  expires_at: string | null
  created_at: string
}

export interface AIArtifact {
  id: string
  session_id: string | null
  artifact_type: "document" | "image" | "log" | "manual" | "video" | "other"
  title: string
  content: string | null
  file_url: string | null
  metadata: Record<string, any>
  tags: string[] | null
  created_at: string
}

export interface AIMemory {
  id: string
  agent_id: string
  memory_type: "episodic" | "semantic" | "procedural"
  content: string
  embedding: number[] | null
  metadata: Record<string, any>
  relevance_score: number
  access_count: number
  last_accessed: string | null
  created_at: string
}

export interface AIAgentHandoff {
  id: string
  session_id: string
  from_agent_id: string
  to_agent_id: string
  handoff_reason: string
  context_snapshot: Record<string, any>
  status: "pending" | "accepted" | "completed" | "rejected"
  completed_at: string | null
  created_at: string
}

export interface AIContextCompaction {
  id: string
  session_id: string
  compacted_count: number
  original_size_kb: number | null
  compacted_size_kb: number | null
  compression_ratio: number | null
  compaction_strategy: string | null
  created_at: string
}

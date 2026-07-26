import type { OperationalArea } from "@/lib/operational-task-templates"

export type TaskSourceType = "hospitality_request" | "housekeeping_task" | "maintenance_task" | "cattle_area" | "issue"

export type OperationalTaskPrefill = {
  template?: string
  area?: OperationalArea
  title?: string
  description?: string
  category?: string
  priority?: "baja" | "media" | "alta" | "urgente"
  dueDate?: string
  locationId?: string
  sourceType: TaskSourceType
  sourceId: string
  sourceLabel: string
  sourcePath: string
}

export function buildOperationalTaskHref(prefill: OperationalTaskPrefill) {
  const params = new URLSearchParams({ new: "1" })
  for (const [key, value] of Object.entries(prefill)) {
    if (value) params.set(key, value)
  }
  return `/tasks?${params.toString()}`
}

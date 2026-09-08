import type { SupabaseClient } from "@supabase/supabase-js"
import { hasCapability, normalizeCapabilitySnapshot } from "@/lib/access/capabilities"
import type { CentralAIMode } from "@/lib/ai/central-router"

const TIMEZONE = "America/Santiago"
const ROW_LIMIT = 5
const TEXT_LIMIT = 240

type CanonicalSource =
  | "reservation_operational_exceptions"
  | "finance_approval_queue"
  | "maintenance_tasks"
  | "procurement_requests"
  | "tasks"
  | "issues"

type CanonicalItem = {
  domain: "hospitality" | "finance" | "maintenance" | "procurement" | "tasks" | "issues"
  title: string
  status?: string
  priority?: string
  due?: string
  detail?: string
  amount?: number
  currency?: string
}

export type CentralAICanonicalContext = {
  observedAt: string
  timezone: typeof TIMEZONE
  canonicalSources: CanonicalSource[]
  unavailableSources: CanonicalSource[]
  attention: CanonicalItem[]
  recentChanges: Partial<Record<"tasks" | "issues" | "maintenance" | "procurement", number>>
}

function text(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value.trim().slice(0, TEXT_LIMIT)
}

function date(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined
  return value.trim().slice(0, 10)
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : []
}

function todayInSantiago() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function last24HoursIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function buildCentralAICanonicalContext(
  supabase: SupabaseClient,
  mode: CentralAIMode,
): Promise<CentralAICanonicalContext | null> {
  if (mode === "DIRECT") return null

  const observedAt = new Date().toISOString()
  const { data: routeAccessData, error: routeAccessError } = await supabase.rpc("get_current_route_access")

  if (routeAccessError || !routeAccessData || typeof routeAccessData !== "object") {
    return {
      observedAt,
      timezone: TIMEZONE,
      canonicalSources: [],
      unavailableSources: [
        "reservation_operational_exceptions",
        "finance_approval_queue",
        "maintenance_tasks",
        "procurement_requests",
        "tasks",
        "issues",
      ],
      attention: [],
      recentChanges: {},
    }
  }

  const capabilities = normalizeCapabilitySnapshot(routeAccessData)
  const canViewBookings = hasCapability(capabilities, "booking", "view")
  const canViewOperations = hasCapability(capabilities, "operations", "view")
  const canViewMaintenance = hasCapability(capabilities, "maintenance", "view")
  const canViewProcurement = hasCapability(capabilities, "procurement", "view")
  const canViewFinance = hasCapability(capabilities, "finance", "view")
  const canApproveResult = canViewFinance ? await supabase.rpc("can_finance_approve") : { data: false, error: null }
  const canApproveFinance = canViewFinance && !canApproveResult.error && Boolean(canApproveResult.data)

  const today = todayInSantiago()
  const since = last24HoursIso()
  const canonicalSources: CanonicalSource[] = []
  const unavailableSources: CanonicalSource[] = []
  const attention: CanonicalItem[] = []
  const recentChanges: CentralAICanonicalContext["recentChanges"] = {}

  async function collect(
    source: CanonicalSource,
    enabled: boolean,
    query: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
    map: (row: Record<string, unknown>) => CanonicalItem,
  ) {
    if (!enabled) return
    const result = await query()
    if (result.error) {
      unavailableSources.push(source)
      return
    }
    canonicalSources.push(source)
    attention.push(...rows(result.data).slice(0, ROW_LIMIT).map(map))
  }

  await Promise.all([
    collect(
      "reservation_operational_exceptions",
      canViewBookings,
      () =>
        supabase
          .from("reservation_operational_exceptions")
          .select("title,detail,priority,exception_state,blocks_check_in,blocks_check_out")
          .in("exception_state", ["open", "overdue"])
          .or("blocks_check_in.eq.true,blocks_check_out.eq.true")
          .limit(ROW_LIMIT),
      (row) => ({
        domain: "hospitality",
        title: text(row.title, "Hospitality exception"),
        status: text(row.exception_state) || undefined,
        priority: text(row.priority) || undefined,
        detail: text(row.detail) || undefined,
      }),
    ),
    collect(
      "finance_approval_queue",
      canApproveFinance,
      () =>
        supabase
          .from("finance_approval_queue")
          .select("description,cost_center_name,total_amount,currency,due_date,approval_status")
          .eq("approval_status", "ready")
          .limit(ROW_LIMIT),
      (row) => ({
        domain: "finance",
        title: text(row.description, text(row.cost_center_name, "Finance approval")),
        status: text(row.approval_status) || undefined,
        due: date(row.due_date),
        amount: number(row.total_amount),
        currency: text(row.currency) || undefined,
      }),
    ),
    collect(
      "maintenance_tasks",
      canViewMaintenance,
      () =>
        supabase
          .from("maintenance_tasks")
          .select("title,prioridad,fecha_objetivo,status,bloqueado")
          .eq("bloqueado", true)
          .not("status", "in", "(completada,completed,cancelada,cancelled,canceled)")
          .limit(ROW_LIMIT),
      (row) => ({
        domain: "maintenance",
        title: text(row.title, "Blocked maintenance"),
        status: text(row.status) || undefined,
        priority: text(row.prioridad) || undefined,
        due: date(row.fecha_objetivo),
      }),
    ),
    collect(
      "procurement_requests",
      canViewProcurement,
      () =>
        supabase
          .from("procurement_requests")
          .select("request_number,title,priority,status,required_date")
          .in("status", ["submitted", "under_review"])
          .limit(ROW_LIMIT),
      (row) => ({
        domain: "procurement",
        title: text(row.title, text(row.request_number, "Procurement request")),
        status: text(row.status) || undefined,
        priority: text(row.priority) || undefined,
        due: date(row.required_date),
      }),
    ),
    collect(
      "tasks",
      canViewOperations,
      () =>
        supabase
          .from("tasks")
          .select("title,status,priority,due_date")
          .lte("due_date", today)
          .not("status", "in", "(completada,completed,cancelled,canceled)")
          .limit(ROW_LIMIT),
      (row) => ({
        domain: "tasks",
        title: text(row.title, "Operational task"),
        status: text(row.status) || undefined,
        priority: text(row.priority) || undefined,
        due: date(row.due_date),
      }),
    ),
    collect(
      "issues",
      canViewMaintenance,
      () =>
        supabase
          .from("issues")
          .select("title,status,priority,severity,created_at")
          .not("status", "in", "(resolved,closed,cancelled,canceled)")
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
      (row) => ({
        domain: "issues",
        title: text(row.title, "Open issue"),
        status: text(row.status) || undefined,
        priority: text(row.severity, text(row.priority)) || undefined,
        detail: date(row.created_at) ? `created ${date(row.created_at)}` : undefined,
      }),
    ),
  ])

  async function countRecent(
    key: keyof CentralAICanonicalContext["recentChanges"],
    enabled: boolean,
    source: CanonicalSource,
    query: () => PromiseLike<{ count: number | null; error: { message?: string } | null }>,
  ) {
    if (!enabled || unavailableSources.includes(source)) return
    const result = await query()
    if (result.error) {
      if (!unavailableSources.includes(source)) unavailableSources.push(source)
      return
    }
    recentChanges[key] = result.count ?? 0
  }

  await Promise.all([
    countRecent("tasks", canViewOperations, "tasks", () =>
      supabase.from("tasks").select("id", { count: "exact", head: true }).gte("updated_at", since),
    ),
    countRecent("issues", canViewMaintenance, "issues", () =>
      supabase.from("issues").select("id", { count: "exact", head: true }).gte("created_at", since),
    ),
    countRecent("maintenance", canViewMaintenance, "maintenance_tasks", () =>
      supabase.from("maintenance_tasks").select("id", { count: "exact", head: true }).gte("created_at", since),
    ),
    countRecent("procurement", canViewProcurement, "procurement_requests", () =>
      supabase.from("procurement_requests").select("id", { count: "exact", head: true }).gte("updated_at", since),
    ),
  ])

  return {
    observedAt,
    timezone: TIMEZONE,
    canonicalSources: [...new Set(canonicalSources)],
    unavailableSources: [...new Set(unavailableSources)],
    attention: attention.slice(0, 20),
    recentChanges,
  }
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, RefreshCw, Search, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type Employee = { id: string; name: string; role: string | null }
type GuestRequest = {
  id: string
  guest_name: string
  request_type: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  description: string | null
  created_at: string
  rooms: { room_number: string | null } | null
  locations: { name: string | null } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignada",
  in_progress: "En curso",
  blocked: "Bloqueada",
  completed: "Completada",
  resolved: "Resuelta",
  cancelled: "Cancelada",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  normal: "Normal",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
  critical: "Crítica",
}

const CATEGORY_LABELS: Record<string, string> = {
  blankets: "Mantas",
  towels: "Toallas",
  cleaning: "Limpieza",
  maintenance: "Mantenimiento",
  amenities: "Comodidades",
  activities: "Actividades",
  food: "Comida y bebida",
  other: "Otra solicitud",
  guest_supplies: "Suministros para huéspedes",
  hospitality: "Hospitalidad",
  lodging: "Hospedaje",
  transport: "Transporte",
  food_beverage: "Comida y bebida",
}

function isOpen(status: string) {
  return !["completed", "resolved", "cancelled"].includes(status)
}

function formatCreated(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function GuestRequestsInbox() {
  const supabase = useMemo(() => createClient(), [])
  const [requests, setRequests] = useState<GuestRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [showClosed, setShowClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [requestsResult, employeesResult] = await Promise.all([
      supabase
        .from("hospitality_requests")
        .select("id,guest_name,request_type,category,priority,status,assigned_to,description,created_at,rooms(room_number),locations(name)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id,name,role").eq("is_active", true).order("name"),
    ])

    const firstError = requestsResult.error || employeesResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setRequests((requestsResult.data ?? []) as unknown as GuestRequest[])
    setEmployees((employeesResult.data ?? []) as Employee[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("guest-requests-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return requests
      .filter((request) => showClosed || isOpen(request.status))
      .filter((request) => {
        if (!needle) return true
        return [
          request.guest_name,
          request.request_type,
          request.category,
          request.locations?.name,
          request.rooms?.room_number,
          request.status,
        ].some((value) => value?.toLowerCase().includes(needle))
      })
      .sort((a, b) => {
        const openDelta = Number(isOpen(b.status)) - Number(isOpen(a.status))
        if (openDelta !== 0) return openDelta
        const unassignedDelta = Number(!b.assigned_to) - Number(!a.assigned_to)
        if (unassignedDelta !== 0) return unassignedDelta
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [query, requests, showClosed])

  const openCount = requests.filter((request) => isOpen(request.status)).length
  const unassignedCount = requests.filter((request) => isOpen(request.status) && !request.assigned_to).length
  const inProgressCount = requests.filter((request) => request.status === "in_progress").length

  async function assign(request: GuestRequest, employeeId: string) {
    setSavingId(request.id)
    const { error: updateError } = await supabase
      .from("hospitality_requests")
      .update({ assigned_to: employeeId || null, status: employeeId && request.status === "pending" ? "assigned" : request.status })
      .eq("id", request.id)
    setSavingId(null)
    if (updateError) return toast.error(updateError.message)
    toast.success(employeeId ? "Solicitud asignada" : "Responsable removido")
    await load()
  }

  async function transition(request: GuestRequest, status: "in_progress" | "completed") {
    if (!request.assigned_to) return toast.warning("Asigna un responsable antes de continuar.")
    setSavingId(request.id)
    const updates: Record<string, unknown> = { status }
    if (status === "completed") updates.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from("hospitality_requests").update(updates).eq("id", request.id)
    setSavingId(null)
    if (updateError) return toast.error(updateError.message)
    toast.success(status === "completed" ? "Solicitud completada" : "Solicitud iniciada")
    await load()
  }

  return (
    <section className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Hospitalidad</p>
            <h1 className="bs-heading mt-2 text-2xl">Solicitudes de huéspedes</h1>
            <p className="mt-2 text-sm text-muted-foreground">Bandeja operativa de solicitudes enviadas desde tablets y portal de huéspedes.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3 mt-5">
          <Metric label="Abiertas" value={openCount} />
          <Metric label="Sin responsable" value={unassignedCount} warning={unassignedCount > 0} />
          <Metric label="En curso" value={inProgressCount} />
        </div>

        <div className="mt-5 flex flex-col gap-3 border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar huésped, solicitud, ubicación o habitación" className="pl-10" />
          </div>
          <Button variant={showClosed ? "secondary" : "outline"} onClick={() => setShowClosed((value) => !value)}>
            {showClosed ? "Ocultar cerradas" : "Ver historial"}
          </Button>
        </div>

        {error && <div className="mt-4 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {loading && <div className="mt-4 border border-border bg-card p-8 text-center text-sm text-muted-foreground">Cargando solicitudes…</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="mt-4 border border-border bg-card p-8 text-center text-sm text-muted-foreground">No hay solicitudes en esta vista.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="mt-4 overflow-hidden border border-border bg-card">
            <div className="hidden grid-cols-[1.2fr_1.5fr_1.2fr_.8fr_1.2fr_auto] gap-4 border-b border-border bg-secondary/60 px-4 py-3 text-xs uppercase tracking-[0.08em] text-muted-foreground lg:grid">
              <span>Huésped</span><span>Solicitud</span><span>Ubicación</span><span>Estado</span><span>Responsable</span><span>Acción</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((request) => {
                const assignee = employees.find((employee) => employee.id === request.assigned_to)
                return (
                  <article key={request.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.2fr_1.5fr_1.2fr_.8fr_1.2fr_auto] lg:items-center">
                    <div>
                      <p className="font-medium">{request.guest_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatCreated(request.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{request.request_type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABELS[request.category] ?? request.category.replaceAll("_", " ")} · {PRIORITY_LABELS[request.priority] ?? request.priority}</p>
                    </div>
                    <div className="text-sm">
                      <p>{request.locations?.name ?? "Sin ubicación"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{request.rooms?.room_number ? `Hab. ${request.rooms.room_number}` : "Sin habitación"}</p>
                    </div>
                    <div><Badge variant={request.status === "blocked" ? "destructive" : "outline"}>{STATUS_LABELS[request.status] ?? request.status}</Badge></div>
                    <div>
                      <select
                        aria-label={`Responsable de ${request.request_type}`}
                        value={request.assigned_to ?? ""}
                        onChange={(event) => void assign(request, event.target.value)}
                        disabled={savingId === request.id || !isOpen(request.status)}
                        className="h-10 w-full border border-border bg-background px-3 text-sm"
                      >
                        <option value="">Sin responsable</option>
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</option>)}
                      </select>
                      {assignee && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><UserRoundCheck className="h-3.5 w-3.5 text-primary" />{assignee.name}</p>}
                    </div>
                    <div className="flex gap-2 lg:justify-end">
                      {isOpen(request.status) && request.status !== "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => void transition(request, "in_progress")} disabled={savingId === request.id || !request.assigned_to}>
                          <Clock3 className="h-4 w-4" /> Iniciar
                        </Button>
                      )}
                      {isOpen(request.status) && (
                        <Button size="sm" onClick={() => void transition(request, "completed")} disabled={savingId === request.id || !request.assigned_to}>
                          <CheckCircle2 className="h-4 w-4" /> Completar
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={warning ? "mt-1 text-2xl font-medium text-amber-500" : "mt-1 text-2xl font-medium"}>{value}</p>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, RefreshCw, Search, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"
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

const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: {
    eyebrow: "Hospitality", title: "Guest requests", description: "Operational inbox for requests sent from guest tablets and the guest portal.", refresh: "Refresh",
    open: "Open", unassigned: "Unassigned", inProgress: "In progress", search: "Search guest, request, location or room", hideClosed: "Hide closed", history: "View history",
    loading: "Loading requests…", empty: "No requests in this view.", guest: "Guest", request: "Request", location: "Location", status: "Status", assignee: "Assignee", action: "Action",
    noLocation: "No location", noRoom: "No room", roomPrefix: "Room", assigneeFor: "Assignee for", start: "Start", complete: "Complete",
    assignedToast: "Request assigned", removedToast: "Assignee removed", assignFirst: "Assign an owner before continuing.", completedToast: "Request completed", startedToast: "Request started",
    statusLabels: { pending: "Pending", assigned: "Assigned", in_progress: "In progress", blocked: "Blocked", completed: "Completed", resolved: "Resolved", cancelled: "Cancelled" },
    priorityLabels: { low: "Low", normal: "Normal", medium: "Medium", high: "High", urgent: "Urgent", critical: "Critical" },
    categoryLabels: { blankets: "Blankets", towels: "Towels", cleaning: "Cleaning", maintenance: "Maintenance", amenities: "Amenities", activities: "Activities", food: "Food & beverage", other: "Other request", guest_supplies: "Guest supplies", hospitality: "Hospitality", lodging: "Lodging", transport: "Transport", food_beverage: "Food & beverage" },
  },
  es: {
    eyebrow: "Hospitalidad", title: "Solicitudes de huéspedes", description: "Bandeja operativa de solicitudes enviadas desde tablets y portal de huéspedes.", refresh: "Actualizar",
    open: "Abiertas", unassigned: "Sin responsable", inProgress: "En curso", search: "Buscar huésped, solicitud, ubicación o habitación", hideClosed: "Ocultar cerradas", history: "Ver historial",
    loading: "Cargando solicitudes…", empty: "No hay solicitudes en esta vista.", guest: "Huésped", request: "Solicitud", location: "Ubicación", status: "Estado", assignee: "Responsable", action: "Acción",
    noLocation: "Sin ubicación", noRoom: "Sin habitación", roomPrefix: "Hab.", assigneeFor: "Responsable de", start: "Iniciar", complete: "Completar",
    assignedToast: "Solicitud asignada", removedToast: "Responsable removido", assignFirst: "Asigna un responsable antes de continuar.", completedToast: "Solicitud completada", startedToast: "Solicitud iniciada",
    statusLabels: { pending: "Pendiente", assigned: "Asignada", in_progress: "En curso", blocked: "Bloqueada", completed: "Completada", resolved: "Resuelta", cancelled: "Cancelada" },
    priorityLabels: { low: "Baja", normal: "Normal", medium: "Media", high: "Alta", urgent: "Urgente", critical: "Crítica" },
    categoryLabels: { blankets: "Mantas", towels: "Toallas", cleaning: "Limpieza", maintenance: "Mantenimiento", amenities: "Comodidades", activities: "Actividades", food: "Comida y bebida", other: "Otra solicitud", guest_supplies: "Suministros para huéspedes", hospitality: "Hospitalidad", lodging: "Hospedaje", transport: "Transporte", food_beverage: "Comida y bebida" },
  },
  de: {
    eyebrow: "Gästebetrieb", title: "Gästeanfragen", description: "Operativer Eingang für Anfragen von Gäste-Tablets und dem Gästeportal.", refresh: "Aktualisieren",
    open: "Offen", unassigned: "Ohne Verantwortliche", inProgress: "In Bearbeitung", search: "Gast, Anfrage, Ort oder Zimmer suchen", hideClosed: "Geschlossene ausblenden", history: "Verlauf anzeigen",
    loading: "Anfragen werden geladen…", empty: "Keine Anfragen in dieser Ansicht.", guest: "Gast", request: "Anfrage", location: "Ort", status: "Status", assignee: "Verantwortliche", action: "Aktion",
    noLocation: "Kein Ort", noRoom: "Kein Zimmer", roomPrefix: "Zimmer", assigneeFor: "Verantwortliche für", start: "Starten", complete: "Abschließen",
    assignedToast: "Anfrage zugewiesen", removedToast: "Verantwortliche entfernt", assignFirst: "Weise vor dem Fortfahren eine verantwortliche Person zu.", completedToast: "Anfrage abgeschlossen", startedToast: "Anfrage gestartet",
    statusLabels: { pending: "Ausstehend", assigned: "Zugewiesen", in_progress: "In Bearbeitung", blocked: "Blockiert", completed: "Abgeschlossen", resolved: "Gelöst", cancelled: "Storniert" },
    priorityLabels: { low: "Niedrig", normal: "Normal", medium: "Mittel", high: "Hoch", urgent: "Dringend", critical: "Kritisch" },
    categoryLabels: { blankets: "Decken", towels: "Handtücher", cleaning: "Reinigung", maintenance: "Instandhaltung", amenities: "Ausstattung", activities: "Aktivitäten", food: "Speisen & Getränke", other: "Andere Anfrage", guest_supplies: "Gästeartikel", hospitality: "Gästebetrieb", lodging: "Unterkunft", transport: "Transport", food_beverage: "Speisen & Getränke" },
  },
} as const

function isOpen(status: string) {
  return !["completed", "resolved", "cancelled"].includes(status)
}

function formatCreated(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

export function GuestRequestsInbox() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const locale = LOCALES[language]
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
      supabase.from("hospitality_requests").select("id,guest_name,request_type,category,priority,status,assigned_to,description,created_at,rooms(room_number),locations(name)").order("created_at", { ascending: false }),
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
    const channel = supabase.channel("guest-requests-inbox").on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load()).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale)
    return requests
      .filter((request) => showClosed || isOpen(request.status))
      .filter((request) => {
        if (!needle) return true
        return [request.guest_name, request.request_type, request.category, request.locations?.name, request.rooms?.room_number, request.status]
          .some((value) => value?.toLocaleLowerCase(locale).includes(needle))
      })
      .sort((a, b) => {
        const openDelta = Number(isOpen(b.status)) - Number(isOpen(a.status))
        if (openDelta !== 0) return openDelta
        const unassignedDelta = Number(!b.assigned_to) - Number(!a.assigned_to)
        if (unassignedDelta !== 0) return unassignedDelta
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [locale, query, requests, showClosed])

  const openCount = requests.filter((request) => isOpen(request.status)).length
  const unassignedCount = requests.filter((request) => isOpen(request.status) && !request.assigned_to).length
  const inProgressCount = requests.filter((request) => request.status === "in_progress").length

  async function assign(request: GuestRequest, employeeId: string) {
    setSavingId(request.id)
    const { error: updateError } = await supabase.from("hospitality_requests").update({ assigned_to: employeeId || null, status: employeeId && request.status === "pending" ? "assigned" : request.status }).eq("id", request.id)
    setSavingId(null)
    if (updateError) return toast.error(updateError.message)
    toast.success(employeeId ? copy.assignedToast : copy.removedToast)
    await load()
  }

  async function transition(request: GuestRequest, status: "in_progress" | "completed") {
    if (!request.assigned_to) return toast.warning(copy.assignFirst)
    setSavingId(request.id)
    const updates: Record<string, unknown> = { status }
    if (status === "completed") updates.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from("hospitality_requests").update(updates).eq("id", request.id)
    setSavingId(null)
    if (updateError) return toast.error(updateError.message)
    toast.success(status === "completed" ? copy.completedToast : copy.startedToast)
    await load()
  }

  return (
    <section className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
            <h1 className="bs-heading mt-2 text-2xl">{copy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />{copy.refresh}</Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3">
          <Metric label={copy.open} value={openCount} />
          <Metric label={copy.unassigned} value={unassignedCount} warning={unassignedCount > 0} />
          <Metric label={copy.inProgress} value={inProgressCount} />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="pl-10" /></div>
          <Button variant={showClosed ? "secondary" : "outline"} onClick={() => setShowClosed((value) => !value)}>{showClosed ? copy.hideClosed : copy.history}</Button>
        </div>

        {error && <div className="mt-4 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {loading && <div className="mt-4 border-y py-8 text-center text-sm text-muted-foreground">{copy.loading}</div>}
        {!loading && !error && filtered.length === 0 && <div className="mt-4 border-y py-8 text-center text-sm text-muted-foreground">{copy.empty}</div>}

        {!loading && !error && filtered.length > 0 && (
          <div className="mt-4 overflow-hidden border-y">
            <div className="hidden grid-cols-[1.2fr_1.5fr_1.2fr_.8fr_1.2fr_auto] gap-4 border-b bg-secondary/40 px-4 py-3 text-xs uppercase tracking-[0.08em] text-muted-foreground lg:grid">
              <span>{copy.guest}</span><span>{copy.request}</span><span>{copy.location}</span><span>{copy.status}</span><span>{copy.assignee}</span><span>{copy.action}</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((request) => {
                const assignee = employees.find((employee) => employee.id === request.assigned_to)
                const category = copy.categoryLabels[request.category as keyof typeof copy.categoryLabels] ?? request.category.replaceAll("_", " ")
                const priority = copy.priorityLabels[request.priority as keyof typeof copy.priorityLabels] ?? request.priority
                const statusLabel = copy.statusLabels[request.status as keyof typeof copy.statusLabels] ?? request.status
                return (
                  <article key={request.id} className="grid gap-4 px-1 py-4 lg:grid-cols-[1.2fr_1.5fr_1.2fr_.8fr_1.2fr_auto] lg:items-center lg:px-4">
                    <div><p className="font-medium">{request.guest_name}</p><p className="mt-1 text-xs text-muted-foreground">{formatCreated(request.created_at, locale)}</p></div>
                    <div><p className="text-sm font-medium">{request.request_type}</p><p className="mt-1 text-xs text-muted-foreground">{category} · {priority}</p></div>
                    <div className="text-sm"><p>{request.locations?.name ?? copy.noLocation}</p><p className="mt-1 text-xs text-muted-foreground">{request.rooms?.room_number ? `${copy.roomPrefix} ${request.rooms.room_number}` : copy.noRoom}</p></div>
                    <div><Badge variant={request.status === "blocked" ? "destructive" : "outline"}>{statusLabel}</Badge></div>
                    <div>
                      <select aria-label={`${copy.assigneeFor} ${request.request_type}`} value={request.assigned_to ?? ""} onChange={(event) => void assign(request, event.target.value)} disabled={savingId === request.id || !isOpen(request.status)} className="h-10 w-full border border-border bg-background px-3 text-sm">
                        <option value="">{copy.unassigned}</option>
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</option>)}
                      </select>
                      {assignee && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><UserRoundCheck className="h-3.5 w-3.5 text-primary" />{assignee.name}</p>}
                    </div>
                    <div className="flex gap-2 lg:justify-end">
                      {isOpen(request.status) && request.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => void transition(request, "in_progress")} disabled={savingId === request.id || !request.assigned_to}><Clock3 className="h-4 w-4" />{copy.start}</Button>}
                      {isOpen(request.status) && <Button size="sm" onClick={() => void transition(request, "completed")} disabled={savingId === request.id || !request.assigned_to}><CheckCircle2 className="h-4 w-4" />{copy.complete}</Button>}
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
  return <div><p className={warning ? "text-xs text-amber-200" : "text-xs text-muted-foreground"}>{label}</p><p className={warning ? "mt-1 text-2xl font-medium text-amber-300" : "mt-1 text-2xl font-medium"}>{value}</p></div>
}

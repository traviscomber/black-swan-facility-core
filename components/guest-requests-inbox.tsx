"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"

type Employee = { id: string; name: string; role: string | null }
type GuestRequest = { id: string; guest_name: string; request_type: string; category: string; priority: string; status: string; assigned_to: string | null; description: string | null; created_at: string; rooms: { room_number: string | null } | null; locations: { name: string | null } | null }
const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: { title: "Guest requests", description: "Operational inbox for requests sent from guest tablets and the guest portal.", refresh: "Refresh", open: "Open", unassigned: "Unassigned", inProgress: "In progress", search: "Search guest, request, location or room", hideClosed: "Hide closed", history: "View history", loading: "Loading requests…", empty: "No requests in this view.", guest: "Guest", request: "Request", location: "Location", status: "Status", assignee: "Assignee", action: "Action", noLocation: "No location", noRoom: "No room", roomPrefix: "Room", assigneeFor: "Assignee for", start: "Start", complete: "Complete", assignedToast: "Request assigned", removedToast: "Assignee removed", assignFirst: "Assign an owner before continuing.", completedToast: "Request completed", startedToast: "Request started", statusLabels: { pending: "Pending", assigned: "Assigned", in_progress: "In progress", blocked: "Blocked", completed: "Completed", resolved: "Resolved", cancelled: "Cancelled" }, priorityLabels: { low: "Low", normal: "Normal", medium: "Medium", high: "High", urgent: "Urgent", critical: "Critical" }, categoryLabels: { blankets: "Blankets", towels: "Towels", cleaning: "Cleaning", maintenance: "Maintenance", amenities: "Amenities", activities: "Activities", food: "Food & beverage", other: "Other request", guest_supplies: "Guest supplies", hospitality: "Hospitality", lodging: "Lodging", transport: "Transport", food_beverage: "Food & beverage" } },
  es: { title: "Solicitudes de huéspedes", description: "Bandeja operativa de solicitudes enviadas desde tablets y portal de huéspedes.", refresh: "Actualizar", open: "Abiertas", unassigned: "Sin responsable", inProgress: "En curso", search: "Buscar huésped, solicitud, ubicación o habitación", hideClosed: "Ocultar cerradas", history: "Ver historial", loading: "Cargando solicitudes…", empty: "No hay solicitudes en esta vista.", guest: "Huésped", request: "Solicitud", location: "Ubicación", status: "Estado", assignee: "Responsable", action: "Acción", noLocation: "Sin ubicación", noRoom: "Sin habitación", roomPrefix: "Hab.", assigneeFor: "Responsable de", start: "Iniciar", complete: "Completar", assignedToast: "Solicitud asignada", removedToast: "Responsable removido", assignFirst: "Asigna un responsable antes de continuar.", completedToast: "Solicitud completada", startedToast: "Solicitud iniciada", statusLabels: { pending: "Pendiente", assigned: "Asignada", in_progress: "En curso", blocked: "Bloqueada", completed: "Completada", resolved: "Resuelta", cancelled: "Cancelada" }, priorityLabels: { low: "Baja", normal: "Normal", medium: "Media", high: "Alta", urgent: "Urgente", critical: "Crítica" }, categoryLabels: { blankets: "Mantas", towels: "Toallas", cleaning: "Limpieza", maintenance: "Mantenimiento", amenities: "Comodidades", activities: "Actividades", food: "Comida y bebida", other: "Otra solicitud", guest_supplies: "Suministros para huéspedes", hospitality: "Hospitalidad", lodging: "Hospedaje", transport: "Transporte", food_beverage: "Comida y bebida" } },
  de: { title: "Gästeanfragen", description: "Operativer Eingang für Anfragen von Gäste-Tablets und dem Gästeportal.", refresh: "Aktualisieren", open: "Offen", unassigned: "Ohne Verantwortliche", inProgress: "In Bearbeitung", search: "Gast, Anfrage, Ort oder Zimmer suchen", hideClosed: "Geschlossene ausblenden", history: "Verlauf anzeigen", loading: "Anfragen werden geladen…", empty: "Keine Anfragen in dieser Ansicht.", guest: "Gast", request: "Anfrage", location: "Ort", status: "Status", assignee: "Verantwortliche", action: "Aktion", noLocation: "Kein Ort", noRoom: "Kein Zimmer", roomPrefix: "Zimmer", assigneeFor: "Verantwortliche für", start: "Starten", complete: "Abschließen", assignedToast: "Anfrage zugewiesen", removedToast: "Verantwortliche entfernt", assignFirst: "Weise vor dem Fortfahren eine verantwortliche Person zu.", completedToast: "Anfrage abgeschlossen", startedToast: "Anfrage gestartet", statusLabels: { pending: "Ausstehend", assigned: "Zugewiesen", in_progress: "In Bearbeitung", blocked: "Blockiert", completed: "Abgeschlossen", resolved: "Gelöst", cancelled: "Storniert" }, priorityLabels: { low: "Niedrig", normal: "Normal", medium: "Mittel", high: "Hoch", urgent: "Dringend", critical: "Kritisch" }, categoryLabels: { blankets: "Decken", towels: "Handtücher", cleaning: "Reinigung", maintenance: "Instandhaltung", amenities: "Ausstattung", activities: "Aktivitäten", food: "Speisen & Getränke", other: "Andere Anfrage", guest_supplies: "Gästeartikel", hospitality: "Gästebetrieb", lodging: "Unterkunft", transport: "Transport", food_beverage: "Speisen & Getränke" } },
} as const

function isOpen(status: string) { return !["completed", "resolved", "cancelled"].includes(status) }
function formatCreated(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) }

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
    setLoading(true); setError(null)
    const [requestsResult, employeesResult] = await Promise.all([
      supabase.from("hospitality_requests").select("id,guest_name,request_type,category,priority,status,assigned_to,description,created_at,rooms(room_number),locations(name)").order("created_at", { ascending: false }),
      supabase.from("employees").select("id,name,role").eq("is_active", true).order("name"),
    ])
    const firstError = requestsResult.error || employeesResult.error
    if (firstError) { setError(firstError.message); setLoading(false); return }
    setRequests((requestsResult.data ?? []) as unknown as GuestRequest[])
    setEmployees((employeesResult.data ?? []) as Employee[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load(); const channel = supabase.channel("guest-requests-inbox").on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel) } }, [load, supabase])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale)
    return requests.filter((request) => showClosed || isOpen(request.status)).filter((request) => !needle || [request.guest_name, request.request_type, request.category, request.locations?.name, request.rooms?.room_number, request.status].some((value) => value?.toLocaleLowerCase(locale).includes(needle))).sort((a, b) => {
      const openDelta = Number(isOpen(b.status)) - Number(isOpen(a.status)); if (openDelta !== 0) return openDelta
      const unassignedDelta = Number(!b.assigned_to) - Number(!a.assigned_to); if (unassignedDelta !== 0) return unassignedDelta
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
    toast.success(employeeId ? copy.assignedToast : copy.removedToast); await load()
  }
  async function transition(request: GuestRequest, status: "in_progress" | "completed") {
    if (!request.assigned_to) return toast.warning(copy.assignFirst)
    setSavingId(request.id)
    const updates: Record<string, unknown> = { status }; if (status === "completed") updates.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from("hospitality_requests").update(updates).eq("id", request.id)
    setSavingId(null)
    if (updateError) return toast.error(updateError.message)
    toast.success(status === "completed" ? copy.completedToast : copy.startedToast); await load()
  }

  return <section className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5"><div><h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.description}</p></div><Button variant="outline" className="h-8 rounded-[4px] border-white/10 bg-[#111314] px-3 text-xs" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{copy.refresh}</Button></header>
    <div className="flex min-h-[40px] flex-col gap-2 border-b border-white/10 bg-[#151718] px-4 py-1.5 md:flex-row md:items-center md:px-5"><div className="relative w-full md:max-w-md"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className="h-8 rounded-[4px] border-white/10 bg-[#111314] pl-8 text-xs" /></div><Button variant={showClosed ? "secondary" : "outline"} className="h-8 rounded-[4px] px-3 text-xs" onClick={() => setShowClosed((value) => !value)}>{showClosed ? copy.hideClosed : copy.history}</Button><div className="ml-auto flex items-center gap-4 text-[11px] text-muted-foreground"><span>{copy.open}: <b className="text-foreground">{openCount}</b></span><span>{copy.unassigned}: <b className={unassignedCount ? "text-amber-300" : "text-foreground"}>{unassignedCount}</b></span><span>{copy.inProgress}: <b className="text-foreground">{inProgressCount}</b></span></div></div>
    {error && <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-xs"><thead className="bg-[#17191a] text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-2.5">{copy.guest}</th><th className="px-4 py-2.5">{copy.request}</th><th className="px-4 py-2.5">{copy.location}</th><th className="px-4 py-2.5">{copy.status}</th><th className="px-4 py-2.5">{copy.assignee}</th><th className="px-4 py-2.5 text-right">{copy.action}</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{copy.loading}</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{copy.empty}</td></tr> : filtered.map((request) => {
      const category = copy.categoryLabels[request.category as keyof typeof copy.categoryLabels] ?? request.category.replaceAll("_", " ")
      const priority = copy.priorityLabels[request.priority as keyof typeof copy.priorityLabels] ?? request.priority
      const statusLabel = copy.statusLabels[request.status as keyof typeof copy.statusLabels] ?? request.status
      return <tr key={request.id} className="bg-[#111213] hover:bg-white/[0.025]"><td className="px-4 py-2.5"><div className="font-medium">{request.guest_name}</div><div className="text-[11px] text-muted-foreground">{formatCreated(request.created_at, locale)}</div></td><td className="px-4 py-2.5"><div>{request.request_type}</div><div className="text-[11px] text-muted-foreground">{category} · {priority}</div></td><td className="px-4 py-2.5"><div>{request.locations?.name ?? copy.noLocation}</div><div className="text-[11px] text-muted-foreground">{request.rooms?.room_number ? `${copy.roomPrefix} ${request.rooms.room_number}` : copy.noRoom}</div></td><td className="px-4 py-2.5"><Badge variant={request.status === "blocked" ? "destructive" : "outline"} className="h-5 rounded-[3px] px-1.5 text-[10px]">{statusLabel}</Badge></td><td className="px-4 py-2.5"><select aria-label={`${copy.assigneeFor} ${request.request_type}`} value={request.assigned_to ?? ""} onChange={(event) => void assign(request, event.target.value)} disabled={savingId === request.id || !isOpen(request.status)} className="h-7 w-full max-w-[220px] rounded-[3px] border border-white/10 bg-[#111314] px-2 text-[11px]"><option value="">{copy.unassigned}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</option>)}</select></td><td className="px-4 py-2.5"><div className="flex justify-end gap-1">{isOpen(request.status) && request.status !== "in_progress" && <Button size="sm" variant="outline" className="h-7 rounded-[3px] px-2 text-[11px]" onClick={() => void transition(request, "in_progress")} disabled={savingId === request.id || !request.assigned_to}><Clock3 className="mr-1 h-3 w-3" />{copy.start}</Button>}{isOpen(request.status) && <Button size="sm" className="h-7 rounded-[3px] bg-emerald-600 px-2 text-[11px] hover:bg-emerald-500" onClick={() => void transition(request, "completed")} disabled={savingId === request.id || !request.assigned_to}><CheckCircle2 className="mr-1 h-3 w-3" />{copy.complete}</Button>}</div></td></tr>
    })}</tbody></table></div>
  </section>
}

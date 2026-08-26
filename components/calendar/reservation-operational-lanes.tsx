"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { BedDouble, CalendarDays, CircleDollarSign, ConciergeBell, LogIn, LogOut, Sparkles, TriangleAlert, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { CalendarEvent } from "@/components/calendar/timeline-row"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

export type CalendarLayerKey = "milestones" | "housekeeping" | "hospitality" | "services" | "activities" | "payments" | "maintenance" | "issues"

type LaneItem = { id: string; label: string; status: string; startsOn: string; endsOn: string; critical?: boolean }
type Lane = { key: CalendarLayerKey; label: string; Icon: typeof BedDouble; className: string; items: LaneItem[] }
type ActivityBookingRow = { id: string; status: string | null; transport_required: boolean | null; activity: { title?: string | null; start_date?: string | null; end_date?: string | null } | Array<{ title?: string | null; start_date?: string | null; end_date?: string | null }> | null }

const copy = {
  en: {
    milestones: "Milestones", services: "Services", activities: "Activities", payments: "Payments", maintenance: "Maintenance", issues: "Issues",
    service: "Service", activity: "Activity", transport: "transport", issue: "Issue", loading: "Loading related operations…", enableLayer: "Enable at least one operational layer.", noEvents: "No events",
    statuses: { pending: "Pending", confirmed: "Confirmed", assigned: "Assigned", in_progress: "In progress", completed: "Completed", closed: "Closed", paid: "Paid", verified: "Verified", approved: "Approved", cancelled: "Cancelled", no_show: "No-show" },
  },
  es: {
    milestones: "Hitos", services: "Servicios", activities: "Actividades", payments: "Pagos", maintenance: "Mantenimiento", issues: "Incidencias",
    service: "Servicio", activity: "Actividad", transport: "transporte", issue: "Incidencia", loading: "Cargando operación relacionada…", enableLayer: "Activa al menos una capa operacional.", noEvents: "Sin eventos",
    statuses: { pending: "Pendiente", confirmed: "Confirmada", assigned: "Asignada", in_progress: "En curso", completed: "Completada", closed: "Cerrada", paid: "Pagado", verified: "Verificado", approved: "Aprobado", cancelled: "Cancelada", no_show: "No presentado" },
  },
  de: {
    milestones: "Meilensteine", services: "Services", activities: "Aktivitäten", payments: "Zahlungen", maintenance: "Wartung", issues: "Vorfälle",
    service: "Service", activity: "Aktivität", transport: "Transport", issue: "Vorfall", loading: "Verknüpfte Vorgänge werden geladen…", enableLayer: "Aktiviere mindestens eine betriebliche Ebene.", noEvents: "Keine Ereignisse",
    statuses: { pending: "Ausstehend", confirmed: "Bestätigt", assigned: "Zugewiesen", in_progress: "In Bearbeitung", completed: "Abgeschlossen", closed: "Geschlossen", paid: "Bezahlt", verified: "Verifiziert", approved: "Freigegeben", cancelled: "Storniert", no_show: "Nicht erschienen" },
  },
} satisfies Record<Language, {
  milestones: string; services: string; activities: string; payments: string; maintenance: string; issues: string
  service: string; activity: string; transport: string; issue: string; loading: string; enableLayer: string; noEvents: string
  statuses: Record<string, string>
}>

function dateOnly(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  try { return format(parseISO(value), "yyyy-MM-dd") } catch { return fallback }
}

function nextDay(value: string) {
  const date = parseISO(value)
  date.setDate(date.getDate() + 1)
  return format(date, "yyyy-MM-dd")
}

function openStatus(status: string | null | undefined) {
  return !["completed", "complete", "closed", "cancelled", "canceled", "rejected", "paid", "verified", "approved"].includes((status ?? "").toLowerCase())
}

export function ReservationOperationalLanes({ reservation, timelineWidth, geometryForDates, activeLayers }: {
  reservation: CalendarEvent
  timelineWidth: number
  geometryForDates: (startsOn: string, endsOn: string) => { left: number; width: number }
  activeLayers: Set<CalendarLayerKey>
}) {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const [lanes, setLanes] = useState<Lane[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [housekeepingResult, hospitalityResult, extrasResult, activitiesResult, paymentsResult, maintenanceResult, issuesResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("id, task_type, status, priority, scheduled_for, due_at, service_date, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("hospitality_requests").select("id, request_type, description, status, priority, promised_at, due_at, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("reservation_extras").select("id, name, service_status, scheduled_start, scheduled_end, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("reservation_activity_bookings").select("id, status, transport_required, activity:activities(title,start_date,end_date)").eq("reservation_id", reservation.event_id),
      supabase.from("payments").select("id, amount, payment_status, paid_at, created_at").eq("reservation_id", reservation.event_id).is("reversed_at", null),
      supabase.from("maintenance_tasks").select("id, title, status, prioridad, bloqueado, scheduled_start, scheduled_end, fecha_objetivo, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("issues").select("id, title, description, status, priority, severity, created_at, resolved_at").eq("related_item_type", "reservation").eq("related_item_id", reservation.event_id),
    ])

    const housekeeping: LaneItem[] = (housekeepingResult.data ?? []).map((item) => {
      const start = dateOnly(item.scheduled_for ?? item.service_date ?? item.created_at, reservation.starts_on)
      return { id: item.id, label: item.task_type || "Housekeeping", status: item.status, startsOn: start, endsOn: nextDay(start), critical: openStatus(item.status) && ["critical", "urgent", "high"].includes((item.priority ?? "").toLowerCase()) }
    })
    const hospitality: LaneItem[] = (hospitalityResult.data ?? []).map((item) => {
      const start = dateOnly(item.promised_at ?? item.created_at, reservation.starts_on)
      const end = dateOnly(item.due_at, nextDay(start))
      return { id: item.id, label: item.request_type || item.description || "Hospitality", status: item.status, startsOn: start, endsOn: end <= start ? nextDay(start) : end, critical: openStatus(item.status) && ["critical", "urgent", "high"].includes((item.priority ?? "").toLowerCase()) }
    })
    const services: LaneItem[] = (extrasResult.data ?? []).map((item) => {
      const start = dateOnly(item.scheduled_start ?? item.created_at, reservation.starts_on)
      const end = dateOnly(item.scheduled_end, nextDay(start))
      return { id: item.id, label: item.name || c.service, status: item.service_status || "pending", startsOn: start, endsOn: end <= start ? nextDay(start) : end }
    })
    const activities: LaneItem[] = ((activitiesResult.data ?? []) as ActivityBookingRow[]).map((item) => {
      const activity = Array.isArray(item.activity) ? item.activity[0] : item.activity
      const start = dateOnly(activity?.start_date, reservation.starts_on)
      const end = dateOnly(activity?.end_date, nextDay(start))
      return { id: item.id, label: `${activity?.title || c.activity}${item.transport_required ? ` · ${c.transport}` : ""}`, status: item.status || "confirmed", startsOn: start, endsOn: end <= start ? nextDay(start) : nextDay(end), critical: item.status === "no_show" }
    })
    const payments: LaneItem[] = (paymentsResult.data ?? []).map((item) => {
      const start = dateOnly(item.paid_at ?? item.created_at, reservation.starts_on)
      return { id: item.id, label: new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(item.amount ?? 0)), status: item.payment_status || "pending", startsOn: start, endsOn: nextDay(start), critical: openStatus(item.payment_status) }
    })
    const maintenance: LaneItem[] = (maintenanceResult.data ?? []).map((item) => {
      const start = dateOnly(item.scheduled_start ?? item.fecha_objetivo ?? item.created_at, reservation.starts_on)
      const end = dateOnly(item.scheduled_end, nextDay(start))
      return { id: item.id, label: item.title || c.maintenance, status: item.status || "pending", startsOn: start, endsOn: end <= start ? nextDay(start) : end, critical: Boolean(item.bloqueado) || (openStatus(item.status) && ["critical", "urgent", "high"].includes((item.prioridad ?? "").toLowerCase())) }
    })
    const issues: LaneItem[] = (issuesResult.data ?? []).map((item) => {
      const start = dateOnly(item.created_at, reservation.starts_on)
      const end = dateOnly(item.resolved_at, nextDay(start))
      return { id: item.id, label: item.title || item.description || c.issue, status: item.status, startsOn: start, endsOn: end <= start ? nextDay(start) : end, critical: openStatus(item.status) && ["critical", "urgent", "high"].includes(((item.severity || item.priority) ?? "").toLowerCase()) }
    })

    const milestones: LaneItem[] = [
      { id: `${reservation.event_id}-arrival`, label: "Check-in", status: reservation.status, startsOn: reservation.starts_on, endsOn: nextDay(reservation.starts_on) },
      { id: `${reservation.event_id}-departure`, label: "Check-out", status: reservation.status, startsOn: reservation.ends_on, endsOn: nextDay(reservation.ends_on) },
    ]

    setLanes([
      { key: "milestones", label: c.milestones, Icon: LogIn, className: "bg-slate-700 text-white", items: milestones },
      { key: "housekeeping", label: "Housekeeping", Icon: BedDouble, className: "bg-amber-500 text-white", items: housekeeping },
      { key: "hospitality", label: "Hospitality", Icon: ConciergeBell, className: "bg-sky-600 text-white", items: hospitality },
      { key: "services", label: c.services, Icon: Sparkles, className: "bg-violet-600 text-white", items: services },
      { key: "activities", label: c.activities, Icon: CalendarDays, className: "bg-cyan-700 text-white", items: activities },
      { key: "payments", label: c.payments, Icon: CircleDollarSign, className: "bg-orange-500 text-white", items: payments },
      { key: "maintenance", label: c.maintenance, Icon: Wrench, className: "bg-zinc-700 text-white", items: maintenance },
      { key: "issues", label: c.issues, Icon: TriangleAlert, className: "bg-red-600 text-white", items: issues },
    ])
    setLoading(false)
  }, [c, reservation, supabase])

  useEffect(() => { void load() }, [load])
  const visibleLanes = lanes.filter((lane) => activeLayers.has(lane.key))
  const statusLabels: Record<string, string> = c.statuses

  return (
    <div className="border-t bg-muted/10">
      {loading ? <div className="px-3 py-3 text-xs text-muted-foreground">{c.loading}</div> : visibleLanes.length === 0 ? <div className="px-3 py-3 text-xs text-muted-foreground">{c.enableLayer}</div> : visibleLanes.map(({ key, label, Icon, className, items }) => (
        <div key={key} className="flex min-h-8 border-b last:border-b-0">
          <div className="sticky left-0 z-20 flex w-[272px] shrink-0 items-center gap-2 border-r bg-background px-4 text-[11px] font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span>{label}</span><span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span></div>
          <div className="relative min-h-8" style={{ width: timelineWidth }}>
            {items.length === 0 ? <span className="absolute left-3 top-2 text-[10px] text-muted-foreground">{c.noEvents}</span> : items.map((item, index) => {
              const geometry = geometryForDates(item.startsOn, item.endsOn)
              const status = statusLabels[item.status?.replaceAll("-", "_")] ?? item.status
              return <div key={item.id} title={`${item.label} · ${status}`} className={`absolute h-5 overflow-hidden rounded-sm border border-black/10 px-1.5 text-[10px] font-semibold leading-5 ${item.critical ? "bg-red-600 text-white" : className}`} style={{ left: geometry.left, width: Math.max(22, geometry.width), top: 5 + (index % 2) * 2 }}><span className="truncate">{item.label}</span></div>
            })}
            {key === "milestones" && <LogOut className="sr-only" />}
          </div>
        </div>
      ))}
    </div>
  )
}

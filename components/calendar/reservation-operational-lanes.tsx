"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { BedDouble, CalendarDays, ChevronUp, CircleDollarSign, ConciergeBell, LogIn, LogOut, Sparkles, TriangleAlert, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { CalendarEvent } from "@/components/calendar/timeline-row"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

export type CalendarLayerKey = "milestones" | "housekeeping" | "hospitality" | "services" | "activities" | "payments" | "maintenance" | "issues"

type LaneItem = {
  id: string
  label: string
  status: string
  startsOn: string
  endsOn: string
  critical?: boolean
  marker?: "checkin" | "checkout"
  minuteOfDay?: number
  phase?: "pre" | "post"
}
type Lane = { key: CalendarLayerKey; label: string; Icon: typeof BedDouble; className: string; items: LaneItem[] }
type ActivityBookingRow = { id: string; status: string | null; transport_required: boolean | null; activity: { title?: string | null; start_date?: string | null; end_date?: string | null } | Array<{ title?: string | null; start_date?: string | null; end_date?: string | null }> | null }

const TIMELINE_DAY_WIDTH = 46

const copy = {
  en: {
    milestones: "Milestones", services: "Services", activities: "Activities", payments: "Payments", maintenance: "Maintenance", issues: "Issues",
    service: "Service", activity: "Activity", transport: "transport", issue: "Issue", loading: "Loading related operations…", enableLayer: "Enable at least one operational layer.", noEvents: "No events", collapse: "Hide operation",
    statuses: { pending: "Pending", confirmed: "Confirmed", assigned: "Assigned", in_progress: "In progress", completed: "Completed", closed: "Closed", paid: "Paid", verified: "Verified", approved: "Approved", cancelled: "Cancelled", no_show: "No-show" },
  },
  es: {
    milestones: "Hitos", services: "Servicios", activities: "Actividades", payments: "Pagos", maintenance: "Mantenimiento", issues: "Incidencias",
    service: "Servicio", activity: "Actividad", transport: "transporte", issue: "Incidencia", loading: "Cargando operación relacionada…", enableLayer: "Activa al menos una capa operacional.", noEvents: "Sin eventos", collapse: "Ocultar operación",
    statuses: { pending: "Pendiente", confirmed: "Confirmada", assigned: "Asignada", in_progress: "En curso", completed: "Completada", closed: "Cerrada", paid: "Pagado", verified: "Verificado", approved: "Aprobado", cancelled: "Cancelada", no_show: "No presentado" },
  },
  de: {
    milestones: "Meilensteine", services: "Services", activities: "Aktivitäten", payments: "Zahlungen", maintenance: "Wartung", issues: "Vorfälle",
    service: "Service", activity: "Aktivität", transport: "Transport", issue: "Vorfall", loading: "Verknüpfte Vorgänge werden geladen…", enableLayer: "Aktiviere mindestens eine betriebliche Ebene.", noEvents: "Keine Ereignisse", collapse: "Betrieb ausblenden",
    statuses: { pending: "Ausstehend", confirmed: "Bestätigt", assigned: "Zugewiesen", in_progress: "In Bearbeitung", completed: "Abgeschlossen", closed: "Geschlossen", paid: "Bezahlt", verified: "Verifiziert", approved: "Freigegeben", cancelled: "Storniert", no_show: "Nicht erschienen" },
  },
} satisfies Record<Language, {
  milestones: string; services: string; activities: string; payments: string; maintenance: string; issues: string
  service: string; activity: string; transport: string; issue: string; loading: string; enableLayer: string; noEvents: string; collapse: string
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

function isCriticalPriority(value: string | null | undefined) {
  return ["critical", "urgent"].includes((value ?? "").toLowerCase())
}

function clockMinutes(value: string | null | undefined, fallback = 0) {
  if (!value) return fallback
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/) ?? value.match(/^(\d{2}):(\d{2})/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return Math.max(0, Math.min(1439, hours * 60 + minutes))
}

function housekeepingLabel(taskType: string | null | undefined) {
  const labels: Record<string, string> = {
    pre_arrival_preparation: "Room prep",
    pre_arrival_inspection: "Pre-arrival check",
    post_checkout_cleaning: "Cleaning",
    post_checkout_laundry: "Laundry",
    post_checkout_damage_review: "Damage check",
    post_checkout_restock: "Restock",
    room_release: "Room release",
  }
  return labels[taskType ?? ""] ?? taskType ?? "Housekeeping"
}

export function ReservationOperationalLanes({ reservation, timelineWidth, geometryForDates, activeLayers, onCollapse }: {
  reservation: CalendarEvent
  timelineWidth: number
  geometryForDates: (startsOn: string, endsOn: string) => { left: number; width: number }
  activeLayers: Set<CalendarLayerKey>
  onCollapse?: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const [lanes, setLanes] = useState<Lane[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [housekeepingResult, hospitalityResult, extrasResult, activitiesResult, paymentsResult, maintenanceResult, issuesResult, settingsResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("id, task_type, status, priority, scheduled_for, due_at, service_date, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("hospitality_requests").select("id, request_type, description, status, priority, promised_at, due_at, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("reservation_extras").select("id, name, service_status, scheduled_start, scheduled_end, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("reservation_activity_bookings").select("id, status, transport_required, activity:activities(title,start_date,end_date)").eq("reservation_id", reservation.event_id),
      supabase.from("payments").select("id, amount, payment_status, paid_at, created_at").eq("reservation_id", reservation.event_id).is("reversed_at", null),
      supabase.from("maintenance_tasks").select("id, title, status, prioridad, bloqueado, scheduled_start, scheduled_end, fecha_objetivo, created_at").eq("reservation_id", reservation.event_id),
      supabase.from("issues").select("id, title, description, status, priority, severity, created_at, resolved_at").eq("related_item_type", "reservation").eq("related_item_id", reservation.event_id),
      supabase.from("booking_settings").select("check_in_time, check_out_time").eq("id", "default").maybeSingle(),
    ])

    const checkInMinute = clockMinutes(settingsResult.data?.check_in_time, 14 * 60)
    const checkOutMinute = clockMinutes(settingsResult.data?.check_out_time, 10 * 60)

    const housekeeping: LaneItem[] = (housekeepingResult.data ?? []).map((item) => {
      const source = item.scheduled_for ?? item.service_date ?? item.created_at
      const start = dateOnly(source, reservation.starts_on)
      const taskType = item.task_type ?? ""
      const phase = taskType.startsWith("pre_arrival_") ? "pre" : (taskType.startsWith("post_checkout_") || taskType === "room_release" ? "post" : undefined)
      return {
        id: item.id,
        label: housekeepingLabel(item.task_type),
        status: item.status,
        startsOn: start,
        endsOn: nextDay(start),
        minuteOfDay: clockMinutes(item.scheduled_for, phase === "pre" ? checkInMinute : checkOutMinute),
        phase,
        critical: openStatus(item.status) && isCriticalPriority(item.priority),
      }
    })
    const hospitality: LaneItem[] = (hospitalityResult.data ?? []).map((item) => {
      const start = dateOnly(item.promised_at ?? item.created_at, reservation.starts_on)
      const end = dateOnly(item.due_at, nextDay(start))
      return { id: item.id, label: item.request_type || item.description || "Hospitality", status: item.status, startsOn: start, endsOn: end <= start ? nextDay(start) : end, critical: openStatus(item.status) && isCriticalPriority(item.priority) }
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
      return { id: item.id, label: item.title || c.maintenance, status: item.status || "pending", startsOn: start, endsOn: end <= start ? nextDay(start) : end, critical: Boolean(item.bloqueado) || (openStatus(item.status) && isCriticalPriority(item.prioridad)) }
    })
    const issues: LaneItem[] = (issuesResult.data ?? []).map((item) => {
      const start = dateOnly(item.created_at, reservation.starts_on)
      const end = dateOnly(item.resolved_at, nextDay(start))
      return { id: item.id, label: item.title || item.description || c.issue, status: item.status, startsOn: start, endsOn: end <= start ? nextDay(start) : end, critical: openStatus(item.status) && isCriticalPriority(item.severity || item.priority) }
    })

    const milestones: LaneItem[] = [
      { id: `${reservation.event_id}-arrival`, label: "Check-in", status: reservation.status, startsOn: reservation.starts_on, endsOn: nextDay(reservation.starts_on), marker: "checkin", minuteOfDay: checkInMinute },
      { id: `${reservation.event_id}-departure`, label: "Check-out", status: reservation.status, startsOn: reservation.ends_on, endsOn: nextDay(reservation.ends_on), marker: "checkout", minuteOfDay: checkOutMinute },
    ]

    setLanes([
      { key: "milestones", label: c.milestones, Icon: LogIn, className: "bg-slate-700 text-white", items: milestones },
      { key: "housekeeping", label: "Housekeeping", Icon: BedDouble, className: "bg-amber-600/80 text-amber-50", items: housekeeping },
      { key: "hospitality", label: "Hospitality", Icon: ConciergeBell, className: "bg-sky-700/80 text-sky-50", items: hospitality },
      { key: "services", label: c.services, Icon: Sparkles, className: "bg-violet-700/80 text-violet-50", items: services },
      { key: "activities", label: c.activities, Icon: CalendarDays, className: "bg-cyan-800/80 text-cyan-50", items: activities },
      { key: "payments", label: c.payments, Icon: CircleDollarSign, className: "bg-orange-700/80 text-orange-50", items: payments },
      { key: "maintenance", label: c.maintenance, Icon: Wrench, className: "bg-zinc-700 text-white", items: maintenance },
      { key: "issues", label: c.issues, Icon: TriangleAlert, className: "bg-red-700/85 text-red-50", items: issues },
    ])
    setLoading(false)
  }, [c, reservation, supabase])

  useEffect(() => { void load() }, [load])
  const visibleLanes = lanes.filter((lane) => activeLayers.has(lane.key))
  const statusLabels: Record<string, string> = c.statuses

  return (
    <div className="border-t bg-muted/10">
      {onCollapse && (
        <div className="flex min-h-8 border-b bg-background/95">
          <button type="button" onClick={onCollapse} className="sticky left-0 z-30 flex w-[176px] shrink-0 items-center gap-2 border-r px-3 text-[11px] font-medium text-foreground/80 transition hover:bg-muted/40 hover:text-foreground" aria-label={c.collapse}>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>{c.collapse}</span>
          </button>
          <button type="button" onClick={onCollapse} className="min-h-8 flex-1 truncate px-3 text-left text-[10px] text-muted-foreground transition hover:bg-muted/20 hover:text-foreground" style={{ width: timelineWidth }}>
            {reservation.guest_name ?? reservation.label}
          </button>
        </div>
      )}
      {loading ? <div className="px-3 py-3 text-xs text-muted-foreground">{c.loading}</div> : visibleLanes.length === 0 ? <div className="px-3 py-3 text-xs text-muted-foreground">{c.enableLayer}</div> : visibleLanes.map(({ key, label, Icon, className, items }) => (
        <div key={key} className="flex min-h-8 border-b last:border-b-0">
          <div className="sticky left-0 z-20 flex w-[176px] shrink-0 items-center gap-2 border-r bg-background px-3 text-[11px] font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span>{label}</span><span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span></div>
          <div className="relative min-h-8" style={{ width: timelineWidth, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${TIMELINE_DAY_WIDTH - 1}px, rgba(255,255,255,.045) ${TIMELINE_DAY_WIDTH - 1}px, rgba(255,255,255,.045) ${TIMELINE_DAY_WIDTH}px)` }}>
            {items.length === 0 ? <span className="absolute left-3 top-2 text-[10px] text-muted-foreground">{c.noEvents}</span> : items.map((item, index) => {
              const geometry = geometryForDates(item.startsOn, item.endsOn)
              const status = statusLabels[item.status?.replaceAll("-", "_")] ?? item.status
              const timedLeft = geometry.left + ((item.minuteOfDay ?? 0) / 1440) * TIMELINE_DAY_WIDTH
              if (key === "milestones" && item.marker) {
                const isCheckIn = item.marker === "checkin"
                return <div key={item.id} title={`${item.label} · ${item.startsOn}`} className="absolute inset-y-0 z-10" style={{ left: Math.max(0, timedLeft - 1), width: 58 }}>
                  <span className={`absolute left-0 top-1 bottom-1 w-px ${isCheckIn ? "bg-emerald-300/90" : "bg-amber-300/90"}`} />
                  <span className={`absolute left-1.5 top-1 whitespace-nowrap text-[9px] font-semibold tracking-[.01em] ${isCheckIn ? "text-emerald-200" : "text-amber-200"}`}>{item.label}</span>
                </div>
              }
              const isTimedHousekeeping = key === "housekeeping" && typeof item.minuteOfDay === "number" && item.phase
              const eventWidth = isTimedHousekeeping ? 34 : Math.max(22, geometry.width)
              const eventLeft = isTimedHousekeeping
                ? item.phase === "pre"
                  ? Math.max(geometry.left, timedLeft - eventWidth)
                  : timedLeft
                : geometry.left
              return <div key={item.id} title={`${item.label} · ${status} · ${item.startsOn}`} className={`absolute h-5 overflow-hidden border px-1.5 text-[10px] font-medium leading-5 ${item.critical ? "border-red-500/60 bg-red-800/90 text-red-50" : `border-white/10 ${className}`}`} style={{ left: eventLeft, width: eventWidth, top: 5 + (index % 2) * 2 }}><span className="truncate">{item.label}</span></div>
            })}
            {key === "milestones" && <LogOut className="sr-only" />}
          </div>
        </div>
      ))}
    </div>
  )
}

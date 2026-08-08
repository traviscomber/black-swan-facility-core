"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addHours, format, isSameDay, parseISO } from "date-fns"
import { BedDouble, Car, CheckCircle2, Clock3, ConciergeBell, LogIn, LogOut, TriangleAlert, UserRound, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { DAY_WIDTH, LABEL_WIDTH, type CalendarEvent } from "@/components/calendar/timeline-row"
import { useLanguage } from "@/lib/hooks/use-language"

type DailyCounts = {
  occupied: number
  arrivals: number
  departures: number
  housekeeping: number
  hospitality: number
  issues: number
}

type ReservationOperational = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  estimated_arrival_time: string | null
  status: string
  arrival_status: string | null
  room: { room_number: string; location_ref: { name: string } | null } | null
}

type HousekeepingOperational = {
  id: string
  reservation_id: string | null
  task_type: string
  status: string | null
  assigned_to: string | null
  scheduled_for: string | null
  service_date: string | null
  inspection_status: string | null
  requires_inspection: boolean | null
}

type LogisticsOperational = {
  id: string
  reservation_id: string
  direction: string
  status: string
  anchor_at: string | null
  transport_mode: string | null
  hub: string | null
  driver_id: string | null
  boat_responsible_id: string | null
}

type AgendaItem = {
  id: string
  at: Date
  kind: "housekeeping" | "logistics" | "arrival"
  title: string
  guest: string
  place: string
  owner: string | null
  state: string
  warning?: string | null
}

const EMPTY: DailyCounts = { occupied: 0, arrivals: 0, departures: 0, housekeeping: 0, hospitality: 0, issues: 0 }

const copy = {
  en: {
    summary: "Daily summary", occupied: "Occupied", arrivals: "Arrivals", departures: "Departures", issues: "Issues",
    agenda: "Operational agenda · next 72 hours", agendaHint: "What happens next, who owns it, and what needs attention.", noAgenda: "No operational milestones in the next 72 hours.",
    unassigned: "Unassigned", responsible: "Owner", arrival: "Guest arrival", preparation: "Room preparation", inspection: "Final inspection", housekeeping: "Housekeeping",
  },
  es: {
    summary: "Resumen diario", occupied: "Ocupadas", arrivals: "Llegadas", departures: "Salidas", issues: "Incidencias",
    agenda: "Agenda operativa · próximas 72 horas", agendaHint: "Qué ocurre, quién es responsable y qué requiere atención.", noAgenda: "No hay hitos operativos en las próximas 72 horas.",
    unassigned: "Sin encargado", responsible: "Encargado", arrival: "Llegada huésped", preparation: "Preparación habitación", inspection: "Inspección final", housekeeping: "Housekeeping",
  },
  de: {
    summary: "Tagesübersicht", occupied: "Belegt", arrivals: "Anreisen", departures: "Abreisen", issues: "Vorfälle",
    agenda: "Betriebsagenda · nächste 72 Stunden", agendaHint: "Was als Nächstes passiert, wer verantwortlich ist und was Aufmerksamkeit braucht.", noAgenda: "Keine operativen Meilensteine in den nächsten 72 Stunden.",
    unassigned: "Nicht zugewiesen", responsible: "Verantwortlich", arrival: "Gästeankunft", preparation: "Zimmer vorbereiten", inspection: "Endkontrolle", housekeeping: "Housekeeping",
  },
}

function dateKey(value: string | null | undefined) {
  if (!value) return null
  try { return format(parseISO(value), "yyyy-MM-dd") } catch { return null }
}

function chileTimestamp(date: string, time: string | null) {
  const rawTime = time?.slice(0, 8) || "12:00:00"
  return new Date(`${date}T${rawTime}-04:00`)
}

function operationalTime(value: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function humanTask(taskType: string, c: (typeof copy)[keyof typeof copy]) {
  if (taskType === "pre_arrival_preparation") return c.preparation
  if (taskType === "pre_arrival_inspection") return c.inspection
  return taskType.replaceAll("_", " ")
}

function stateLabel(value: string | null) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    assigned: "Asignada",
    in_progress: "En curso",
    inspection: "Por aprobar",
    completed: "Completada",
    planned: "Planificada",
    confirmed: "Confirmada",
    checked_in: "Hospedado",
    not_arrived: "No llegado",
    draft: "Borrador",
  }
  return labels[value ?? ""] ?? value ?? "Pendiente"
}

export function CalendarDailyOperationsSummary({ dates, reservations, timelineWidth }: { dates: Date[]; reservations: CalendarEvent[]; timelineWidth: number }) {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const c = copy[language]
  const [operations, setOperations] = useState<Record<string, Pick<DailyCounts, "housekeeping" | "hospitality" | "issues">>>({})
  const [reservationDetails, setReservationDetails] = useState<ReservationOperational[]>([])
  const [housekeeping, setHousekeeping] = useState<HousekeepingOperational[]>([])
  const [logistics, setLogistics] = useState<LogisticsOperational[]>([])
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const ids = [...new Set(reservations.map((reservation) => reservation.event_id))]
    if (ids.length === 0) {
      setOperations({}); setReservationDetails([]); setHousekeeping([]); setLogistics([]); setEmployeeNames({}); return
    }

    const [housekeepingResult, hospitalityResult, issuesResult, reservationsResult, logisticsResult] = await Promise.all([
      supabase.from("housekeeping_tasks").select("id, reservation_id, task_type, status, assigned_to, scheduled_for, service_date, inspection_status, requires_inspection").in("reservation_id", ids),
      supabase.from("hospitality_requests").select("reservation_id, promised_at, due_at, created_at").in("reservation_id", ids),
      supabase.from("issues").select("related_item_id, created_at").eq("related_item_type", "reservation").in("related_item_id", ids),
      supabase.from("reservations").select("id, guest_name, check_in, check_out, estimated_arrival_time, status, arrival_status, room:rooms(room_number, location_ref:locations(name))").in("id", ids),
      supabase.from("reservation_logistics").select("id, reservation_id, direction, status, anchor_at, transport_mode, hub, driver_id, boat_responsible_id").in("reservation_id", ids),
    ])

    const next: Record<string, Pick<DailyCounts, "housekeeping" | "hospitality" | "issues">> = {}
    const ensure = (key: string) => next[key] ??= { housekeeping: 0, hospitality: 0, issues: 0 }

    for (const item of housekeepingResult.data ?? []) {
      const key = dateKey(item.scheduled_for ?? item.service_date)
      if (key) ensure(key).housekeeping += 1
    }
    for (const item of hospitalityResult.data ?? []) {
      const key = dateKey(item.promised_at ?? item.due_at ?? item.created_at)
      if (key) ensure(key).hospitality += 1
    }
    for (const item of issuesResult.data ?? []) {
      const key = dateKey(item.created_at)
      if (key) ensure(key).issues += 1
    }

    const hk = (housekeepingResult.data ?? []) as HousekeepingOperational[]
    const lg = (logisticsResult.data ?? []) as LogisticsOperational[]
    const employeeIds = [...new Set([...hk.map((item) => item.assigned_to), ...lg.map((item) => item.driver_id), ...lg.map((item) => item.boat_responsible_id)].filter((value): value is string => Boolean(value)))]
    let names: Record<string, string> = {}
    if (employeeIds.length > 0) {
      const employeeResult = await supabase.from("employees").select("id, name").in("id", employeeIds)
      names = Object.fromEntries((employeeResult.data ?? []).map((employee) => [employee.id, employee.name]))
    }

    setOperations(next)
    setReservationDetails((reservationsResult.data ?? []) as unknown as ReservationOperational[])
    setHousekeeping(hk)
    setLogistics(lg)
    setEmployeeNames(names)
  }, [reservations, supabase])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => dates.map((date) => {
    const key = format(date, "yyyy-MM-dd")
    const base = operations[key] ?? { housekeeping: 0, hospitality: 0, issues: 0 }
    return reservations.reduce<DailyCounts>((acc, reservation) => {
      const start = parseISO(reservation.starts_on)
      const end = parseISO(reservation.ends_on)
      if (date >= start && date < end) acc.occupied += 1
      if (isSameDay(date, start)) acc.arrivals += 1
      if (isSameDay(date, end)) acc.departures += 1
      return acc
    }, { ...EMPTY, ...base })
  }), [dates, operations, reservations])

  const agenda = useMemo<AgendaItem[]>(() => {
    const now = new Date()
    const end = addHours(now, 72)
    const byReservation = new Map(reservationDetails.map((reservation) => [reservation.id, reservation]))
    const items: AgendaItem[] = []

    for (const task of housekeeping) {
      if (!task.scheduled_for) continue
      const at = new Date(task.scheduled_for)
      if (at < now || at > end || task.status === "completed") continue
      const reservation = task.reservation_id ? byReservation.get(task.reservation_id) : null
      if (!reservation) continue
      const place = [reservation.room?.location_ref?.name, reservation.room?.room_number].filter(Boolean).join(" · ")
      items.push({
        id: `hk-${task.id}`,
        at,
        kind: "housekeeping",
        title: humanTask(task.task_type, c),
        guest: reservation.guest_name,
        place,
        owner: task.assigned_to ? employeeNames[task.assigned_to] ?? null : null,
        state: task.status === "inspection" ? "Por aprobar" : stateLabel(task.status),
        warning: !task.assigned_to ? c.unassigned : task.status === "inspection" ? "Requiere aprobación" : null,
      })
    }

    for (const item of logistics) {
      if (item.direction !== "arrival" || !item.anchor_at || item.status === "completed" || item.status === "cancelled") continue
      const at = new Date(item.anchor_at)
      if (at < now || at > end) continue
      const reservation = byReservation.get(item.reservation_id)
      if (!reservation) continue
      const place = [reservation.room?.location_ref?.name, reservation.room?.room_number].filter(Boolean).join(" · ")
      const ownerId = item.driver_id ?? item.boat_responsible_id
      items.push({
        id: `lg-${item.id}`,
        at,
        kind: "logistics",
        title: `${item.transport_mode === "flight" ? "Vuelo / traslado" : item.transport_mode?.replaceAll("_", " ") || "Traslado"}${item.hub && item.hub !== "unknown" ? ` · ${item.hub}` : ""}`,
        guest: reservation.guest_name,
        place,
        owner: ownerId ? employeeNames[ownerId] ?? null : null,
        state: stateLabel(item.status),
        warning: !ownerId ? c.unassigned : null,
      })
    }

    for (const reservation of reservationDetails) {
      if (["checked_in", "checked_out", "cancelled"].includes(reservation.status)) continue
      const at = chileTimestamp(reservation.check_in, reservation.estimated_arrival_time)
      if (at < now || at > end) continue
      const place = [reservation.room?.location_ref?.name, reservation.room?.room_number].filter(Boolean).join(" · ")
      items.push({
        id: `arrival-${reservation.id}`,
        at,
        kind: "arrival",
        title: c.arrival,
        guest: reservation.guest_name,
        place,
        owner: null,
        state: stateLabel(reservation.arrival_status ?? reservation.status),
      })
    }

    return items.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 14)
  }, [c, employeeNames, housekeeping, logistics, reservationDetails])

  const warnings = agenda.filter((item) => item.warning === c.unassigned).length

  return (
    <>
      <div className="border-t bg-background px-3 py-3">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">{c.agenda}</p>{warnings > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{warnings} {c.unassigned.toLowerCase()}</Badge>}</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.agendaHint}</p>
          </div>
        </div>
        {agenda.length === 0 ? <p className="py-2 text-xs text-muted-foreground">{c.noAgenda}</p> : (
          <div className="grid gap-1.5 lg:grid-cols-2 xl:grid-cols-3">
            {agenda.map((item) => {
              const Icon = item.kind === "logistics" ? Car : item.kind === "arrival" ? LogIn : item.title === c.inspection ? CheckCircle2 : BedDouble
              return <div key={item.id} className="flex min-w-0 items-start gap-2 rounded-[5px] bg-muted/45 px-2.5 py-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">{operationalTime(item.at)}</span>{item.warning && <span className="text-[10px] font-semibold text-amber-700">{item.warning}</span>}</div>
                  <p className="truncate text-xs font-semibold">{item.title} · {item.guest}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground"><span className="truncate">{item.place || "—"}</span><span className="inline-flex items-center gap-1"><UserRound className="h-2.5 w-2.5" />{item.owner ?? c.unassigned}</span><span>{item.state}</span></div>
                </div>
              </div>
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-30 flex border-t bg-background/95 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
        <div className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r bg-background px-3 text-xs font-semibold" style={{ width: LABEL_WIDTH, height: 46 }}>
          <Users className="h-4 w-4 text-primary" />
          {c.summary}
        </div>
        <div className="grid" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${dates.length}, ${DAY_WIDTH}px)` }}>
          {counts.map((count, index) => (
            <div key={dates[index].toISOString()} className="flex h-[46px] flex-wrap content-center justify-center gap-x-1.5 gap-y-0.5 border-r px-1 text-[9px] text-muted-foreground">
              <span title={c.occupied} className="inline-flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{count.occupied}</span>
              <span title={c.arrivals} className="inline-flex items-center gap-0.5 text-emerald-700"><LogIn className="h-2.5 w-2.5" />{count.arrivals}</span>
              <span title={c.departures} className="inline-flex items-center gap-0.5 text-amber-700"><LogOut className="h-2.5 w-2.5" />{count.departures}</span>
              <span title="Housekeeping" className="inline-flex items-center gap-0.5"><BedDouble className="h-2.5 w-2.5" />{count.housekeeping}</span>
              <span title="Hospitality" className="inline-flex items-center gap-0.5"><ConciergeBell className="h-2.5 w-2.5" />{count.hospitality}</span>
              <span title={c.issues} className={`inline-flex items-center gap-0.5 ${count.issues > 0 ? "text-red-700" : ""}`}><TriangleAlert className="h-2.5 w-2.5" />{count.issues}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ConciergeBell,
  MapPin,
  PackageCheck,
  RefreshCw,
  Repeat2,
  Ship,
  Truck,
  Wrench,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type CalendarItem = {
  type: string
  id: string
  startsAt: string
  endsAt: string | null
  title: string
  subtitle: string | null
  department: string
  locationId: string | null
  reservationId: string | null
  status: string | null
  readiness: string
  href: string
  metadata: Record<string, unknown>
}

type TurnaroundWindow = {
  reservationId: string
  previousReservationId: string
  roomId: string
  locationId: string | null
  roomLabel: string
  previousGuestName: string
  nextGuestName: string
  previousReleaseAt: string
  nextArrivalAt: string
  preparationStartAt: string
  inspectionStartAt: string
  windowMinutes: number
  operationalMinutes: number
  status: "planned" | "insufficient" | "overlap"
}

type OperationalCalendarProps = {
  days?: number
  compact?: boolean
  title?: string
}

const typeLabels: Record<string, string> = {
  arrival: "Reserva",
  departure: "Reserva",
  housekeeping: "Housekeeping",
  hospitality: "Hospitalidad",
  maintenance: "Mantenimiento",
  procurement: "Compras",
  activity: "Actividad",
  service: "Servicio",
  transport_coordination: "Coordinación",
  departure_coordination: "Coordinación",
  external_arrival: "Arribo externo",
  external_departure: "Salida externa",
  road_transfer: "Traslado terrestre",
  boat_transfer: "Bote",
  property_arrival: "Llegada al Fundo",
}

const typeIcons: Record<string, typeof CalendarDays> = {
  arrival: BedDouble,
  departure: BedDouble,
  housekeeping: ClipboardCheck,
  hospitality: ConciergeBell,
  maintenance: Wrench,
  procurement: PackageCheck,
  activity: CalendarDays,
  service: CheckCircle2,
  transport_coordination: ClipboardCheck,
  departure_coordination: ClipboardCheck,
  external_arrival: MapPin,
  external_departure: MapPin,
  road_transfer: Truck,
  boat_transfer: Ship,
  property_arrival: BedDouble,
}

const readinessLabels: Record<string, string> = {
  ready: "Lista para ejecutar",
  needs_owner: "Falta recurso o responsable",
  pending_confirmation: "Pendiente de confirmar",
  estimated: "Fecha estimada",
  blocking: "Bloquea operación",
  needs_review: "Requiere definición",
  draft: "Borrador",
}

function readinessVariant(readiness: string): "default" | "secondary" | "outline" | "destructive" {
  if (readiness === "blocking") return "destructive"
  if (readiness === "ready") return "default"
  if (["needs_owner", "needs_review", "pending_confirmation"].includes(readiness)) return "secondary"
  return "outline"
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

function turnaroundLabel(status: TurnaroundWindow["status"]) {
  if (status === "overlap") return "Solapamiento"
  if (status === "insufficient") return "Ventana insuficiente"
  return "Transición planificada"
}

export function OperationalCalendar({ days = 14, compact = false, title = "Próximas acciones" }: OperationalCalendarProps) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<CalendarItem[]>([])
  const [turnarounds, setTurnarounds] = useState<TurnaroundWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const startDate = useMemo(() => startOfDay(new Date()), [])
  const endDate = useMemo(() => addDays(startDate, days), [days, startDate])

  const load = useCallback(async () => {
    setLoading(true)
    const params = {
      p_start_date: format(startDate, "yyyy-MM-dd"),
      p_end_date: format(endDate, "yyyy-MM-dd"),
    }

    const [calendarResult, logisticsResult, turnaroundResult] = await Promise.all([
      supabase.rpc("get_operational_calendar", params),
      supabase.rpc("get_reservation_logistics_calendar", params),
      supabase.rpc("get_booking_turnaround_windows", params),
    ])

    if (calendarResult.error) {
      setError(calendarResult.error.message)
      setItems([])
    } else {
      const operationalItems = Array.isArray(calendarResult.data) ? (calendarResult.data as CalendarItem[]) : []
      const logisticsItems = !logisticsResult.error && Array.isArray(logisticsResult.data)
        ? (logisticsResult.data as CalendarItem[])
        : []

      setItems(
        [...operationalItems, ...logisticsItems].sort((a, b) =>
          a.startsAt.localeCompare(b.startsAt) || a.type.localeCompare(b.type),
        ),
      )

      const secondaryErrors = [
        logisticsResult.error ? `logística: ${logisticsResult.error.message}` : null,
        turnaroundResult.error ? `transiciones: ${turnaroundResult.error.message}` : null,
      ].filter(Boolean)

      setError(secondaryErrors.length > 0 ? `Carga parcial del calendario (${secondaryErrors.join("; ")}).` : null)
    }

    setTurnarounds(
      !turnaroundResult.error && Array.isArray(turnaroundResult.data)
        ? (turnaroundResult.data as TurnaroundWindow[])
        : [],
    )
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const groups = new Map<string, CalendarItem[]>()
    items.forEach((item) => {
      const key = format(parseISO(item.startsAt), "yyyy-MM-dd")
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const readyCount = items.filter((item) => item.readiness === "ready").length
  const attentionCount = items.length - readyCount
  const conflictCount = turnarounds.filter((window) => window.status !== "planned").length
  const visibleGroups = compact ? grouped.slice(0, 5) : grouped
  const visibleTurnarounds = compact ? turnarounds.slice(0, 3) : turnarounds

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Calendario operacional</p>
          <h2 className="mt-1 text-xl font-normal">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Desde hoy hasta {format(endDate, "d 'de' MMMM", { locale: es })}. Reservas, logística, recursos y trabajo en una sola secuencia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && (
            <>
              <Badge variant="outline">{readyCount} listas</Badge>
              <Badge variant={attentionCount > 0 ? "secondary" : "outline"}>{attentionCount} requieren atención</Badge>
              {conflictCount > 0 && <Badge variant="destructive">{conflictCount} conflictos</Badge>}
            </>
          )}
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!loading && visibleTurnarounds.length > 0 && (
        <div className="space-y-3 bg-card p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Entre reservas</p>
            <h3 className="mt-1 text-base font-normal">Ventanas de trabajo por habitación</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              El tiempo comienza cuando sale el booking anterior y termina antes de la inspección final del siguiente.
            </p>
          </div>

          <div className="grid gap-2">
            {visibleTurnarounds.map((window) => {
              const conflict = window.status !== "planned"
              return (
                <Link
                  key={`${window.previousReservationId}-${window.reservationId}`}
                  href={`/bookings?reservation=${window.reservationId}`}
                  className="group grid gap-3 bg-secondary p-4 transition-colors hover:bg-accent sm:grid-cols-[34px_1fr_auto] sm:items-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center bg-muted">
                    <Repeat2 className={`h-4 w-4 ${conflict ? "text-destructive" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{window.roomLabel}</span>
                      <span className="text-sm font-medium">
                        {window.previousGuestName} → {window.nextGuestName}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Liberación {format(parseISO(window.previousReleaseAt), "d MMM HH:mm", { locale: es })} · llegada {format(parseISO(window.nextArrivalAt), "d MMM HH:mm", { locale: es })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ventana total: {formatDuration(window.windowMinutes)} · trabajo útil antes de inspección: {formatDuration(window.operationalMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={conflict ? "destructive" : "default"}>{turnaroundLabel(window.status)}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando próximas acciones…</p>
      ) : visibleGroups.length === 0 ? (
        <p className="bg-card p-8 text-center text-sm text-muted-foreground">No hay acciones programadas dentro de este período.</p>
      ) : (
        <div className="divide-y divide-border/30">
          {visibleGroups.map(([date, dateItems]) => {
            const parsedDate = parseISO(date)
            const today = isSameDay(parsedDate, new Date())
            return (
              <div key={date} className="grid gap-3 py-4 lg:grid-cols-[150px_1fr]">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    {today ? "Hoy" : format(parsedDate, "EEEE", { locale: es })}
                  </p>
                  <p className="mt-1 text-sm font-medium">{format(parsedDate, "d MMM yyyy", { locale: es })}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateItems.length} acciones</p>
                </div>
                <div className="space-y-2">
                  {dateItems.map((item) => {
                    const Icon = typeIcons[item.type] ?? CalendarDays
                    return (
                      <Link
                        key={`${item.type}-${item.id}-${item.startsAt}`}
                        href={item.href}
                        className="group grid gap-3 bg-card p-3 transition-colors hover:bg-muted sm:grid-cols-[34px_1fr_auto] sm:items-center"
                      >
                        <div className="flex h-8 w-8 items-center justify-center bg-muted">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{typeLabels[item.type] ?? item.type}</Badge>
                            <p className="truncate text-sm font-medium">{item.title}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {format(parseISO(item.startsAt), "HH:mm")}
                            {item.endsAt ? `–${format(parseISO(item.endsAt), "HH:mm")}` : ""}
                            {item.subtitle ? ` · ${item.subtitle}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={readinessVariant(item.readiness)}>
                            {readinessLabels[item.readiness] ?? item.readiness}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {compact && (grouped.length > visibleGroups.length || turnarounds.length > visibleTurnarounds.length) && (
        <Button asChild variant="secondary" className="w-full">
          <Link href="/bookings">
            Ver calendario operacional completo <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </section>
  )
}

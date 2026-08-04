"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BedDouble,
  CalendarArrowDown,
  CalendarArrowUp,
  CircleDollarSign,
  ClockAlert,
  RefreshCw,
  UserRoundClock,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type MetricKey =
  | "arrivalsToday"
  | "departuresToday"
  | "roomsNotReady"
  | "waitingForRoom"
  | "overdueHousekeeping"
  | "criticalIssues"
  | "pendingPayments"

type Metrics = Record<MetricKey, number>

type DetailItem = {
  id: string
  title: string
  subtitle: string
  status: string | null
  target: string | null
}

const EMPTY_METRICS: Metrics = {
  arrivalsToday: 0,
  departuresToday: 0,
  roomsNotReady: 0,
  waitingForRoom: 0,
  overdueHousekeeping: 0,
  criticalIssues: 0,
  pendingPayments: 0,
}

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function BookingOperationsBar() {
  const supabase = useMemo(() => createClient(), [])
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null)
  const [detailItems, setDetailItems] = useState<DetailItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    const today = localDateKey()

    const [arrivalsResult, departuresResult, roomsResult, waitingResult, housekeepingResult, issuesResult, paymentsResult] = await Promise.all([
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("check_in", today),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("check_out", today),
      supabase.from("rooms").select("id", { count: "exact", head: true }).not("operational_status", "in", "(ready,inspected,occupied)"),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("arrival_status", "waiting_for_room"),
      supabase.from("housekeeping_tasks").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled,rejected)").lt("due_at", new Date().toISOString()),
      supabase.from("issues").select("id", { count: "exact", head: true }).not("status", "in", "(resolved,closed)").in("priority", ["critical", "urgent"]),
      supabase.from("reservations").select("id", { count: "exact", head: true }).not("payment_status", "in", "(paid,completed)"),
    ])

    const firstError = [arrivalsResult, departuresResult, roomsResult, waitingResult, housekeepingResult, issuesResult, paymentsResult].find((result) => result.error)?.error

    if (!firstError) {
      setMetrics({
        arrivalsToday: arrivalsResult.count ?? 0,
        departuresToday: departuresResult.count ?? 0,
        roomsNotReady: roomsResult.count ?? 0,
        waitingForRoom: waitingResult.count ?? 0,
        overdueHousekeeping: housekeepingResult.count ?? 0,
        criticalIssues: issuesResult.count ?? 0,
        pendingPayments: paymentsResult.count ?? 0,
      })
      setUpdatedAt(new Date())
    }

    setLoading(false)
  }, [supabase])

  const loadDetails = useCallback(async (metric: MetricKey) => {
    setActiveMetric(metric)
    setDetailLoading(true)
    setDetailItems([])
    const today = localDateKey()

    try {
      if (metric === "arrivalsToday" || metric === "departuresToday" || metric === "waitingForRoom" || metric === "pendingPayments") {
        let query = supabase
          .from("reservations")
          .select("id, guest_name, check_in, check_out, status, arrival_status, payment_status, total_amount, room:rooms(room_number, location:locations(name))")
          .order("check_in")

        if (metric === "arrivalsToday") query = query.eq("check_in", today)
        if (metric === "departuresToday") query = query.eq("check_out", today)
        if (metric === "waitingForRoom") query = query.eq("arrival_status", "waiting_for_room")
        if (metric === "pendingPayments") query = query.not("payment_status", "in", "(paid,completed)")

        const { data, error } = await query
        if (error) throw error
        setDetailItems((data ?? []).map((row: any) => ({
          id: row.id,
          title: row.guest_name,
          subtitle: `${row.room?.location?.name ?? "Sin propiedad"} · ${row.room?.room_number ?? "Sin habitación"} · ${row.check_in} → ${row.check_out}`,
          status: metric === "pendingPayments" ? row.payment_status : row.arrival_status ?? row.status,
          target: `/bookings?reservation=${row.id}`,
        })))
      }

      if (metric === "roomsNotReady") {
        const { data, error } = await supabase
          .from("rooms")
          .select("id, room_number, room_type, operational_status, location:locations(name)")
          .not("operational_status", "in", "(ready,inspected,occupied)")
          .order("room_number")
        if (error) throw error
        setDetailItems((data ?? []).map((row: any) => ({
          id: row.id,
          title: `Habitación ${row.room_number}`,
          subtitle: `${row.location?.name ?? "Sin propiedad"} · ${row.room_type}`,
          status: row.operational_status,
          target: "/bookings#room-status",
        })))
      }

      if (metric === "overdueHousekeeping") {
        const { data, error } = await supabase
          .from("housekeeping_tasks")
          .select("id, task_type, status, due_at, reservation:reservations(guest_name), room:rooms(room_number, location:locations(name))")
          .not("status", "in", "(completed,cancelled,rejected)")
          .lt("due_at", new Date().toISOString())
          .order("due_at")
        if (error) throw error
        setDetailItems((data ?? []).map((row: any) => ({
          id: row.id,
          title: `${row.task_type} · Habitación ${row.room?.room_number ?? "—"}`,
          subtitle: `${row.room?.location?.name ?? "Sin propiedad"} · ${row.reservation?.guest_name ?? "Sin huésped"} · venció ${row.due_at ? new Date(row.due_at).toLocaleString("es-CL") : "sin hora"}`,
          status: row.status,
          target: "/bookings#housekeeping",
        })))
      }

      if (metric === "criticalIssues") {
        const { data, error } = await supabase
          .from("issues")
          .select("id, title, description, priority, status, created_at")
          .not("status", "in", "(resolved,closed)")
          .in("priority", ["critical", "urgent"])
          .order("created_at", { ascending: false })
        if (error) throw error
        setDetailItems((data ?? []).map((row) => ({
          id: row.id,
          title: row.title ?? "Incidencia crítica",
          subtitle: row.description ?? "Sin descripción",
          status: row.priority ?? row.status,
          target: "/maintenance/issues",
        })))
      }
    } finally {
      setDetailLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadMetrics()
    const channel = supabase
      .channel("booking-operations-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => void loadMetrics())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadMetrics, supabase])

  const items = [
    { key: "arrivalsToday" as const, label: "Llegadas hoy", value: metrics.arrivalsToday, icon: CalendarArrowDown, alert: false },
    { key: "departuresToday" as const, label: "Salidas hoy", value: metrics.departuresToday, icon: CalendarArrowUp, alert: false },
    { key: "roomsNotReady" as const, label: "Habitaciones no listas", value: metrics.roomsNotReady, icon: BedDouble, alert: metrics.roomsNotReady > 0 },
    { key: "waitingForRoom" as const, label: "Huéspedes esperando", value: metrics.waitingForRoom, icon: UserRoundClock, alert: metrics.waitingForRoom > 0 },
    { key: "overdueHousekeeping" as const, label: "Housekeeping vencido", value: metrics.overdueHousekeeping, icon: ClockAlert, alert: metrics.overdueHousekeeping > 0 },
    { key: "criticalIssues" as const, label: "Incidencias críticas", value: metrics.criticalIssues, icon: AlertTriangle, alert: metrics.criticalIssues > 0 },
    { key: "pendingPayments" as const, label: "Pagos pendientes", value: metrics.pendingPayments, icon: CircleDollarSign, alert: metrics.pendingPayments > 0 },
  ]

  const activeLabel = items.find((item) => item.key === activeMetric)?.label ?? "Detalle operativo"

  return (
    <>
      <section className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3 overflow-x-auto">
          <div className="mr-1 min-w-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A6 · Alertas accionables</p>
            <p className="text-xs text-muted-foreground">{updatedAt ? `Actualizado ${updatedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : "Cargando métricas"}</p>
          </div>

          {items.map(({ key, label, value, icon: Icon, alert }) => (
            <button
              type="button"
              key={key}
              onClick={() => void loadDetails(key)}
              className={`flex min-w-[145px] items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/40 ${alert ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}
            >
              <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <p className={`text-lg font-semibold leading-none ${alert ? "text-destructive" : ""}`}>{value}</p>
                <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">{label}</p>
              </div>
            </button>
          ))}

          <Button type="button" variant="ghost" size="icon" className="min-w-9" onClick={() => void loadMetrics()} disabled={loading} aria-label="Actualizar métricas operativas">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </section>

      {activeMetric && (
        <div className="fixed inset-0 z-[90] flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setActiveMetric(null)} aria-label="Cerrar detalle" />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A6 · Atención requerida</p>
                <h2 className="mt-1 text-xl font-semibold">{activeLabel}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Registros reales vinculados a esta métrica.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActiveMetric(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Cargando registros…</p>
              ) : detailItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No hay registros que requieran atención en esta categoría.</div>
              ) : (
                <div className="space-y-3">
                  {detailItems.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                        </div>
                        {item.status && <Badge variant="outline">{item.status}</Badge>}
                      </div>
                      {item.target && <Button asChild variant="outline" size="sm" className="mt-4"><a href={item.target}>Abrir flujo</a></Button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

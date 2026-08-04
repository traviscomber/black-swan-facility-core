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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Metrics = {
  arrivalsToday: number
  departuresToday: number
  roomsNotReady: number
  waitingForRoom: number
  overdueHousekeeping: number
  criticalIssues: number
  pendingPayments: number
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

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    const today = localDateKey()

    const [
      arrivalsResult,
      departuresResult,
      roomsResult,
      waitingResult,
      housekeepingResult,
      issuesResult,
      paymentsResult,
    ] = await Promise.all([
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("check_in", today),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("check_out", today),
      supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .not("operational_status", "in", "(ready,inspected,occupied)"),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("arrival_status", "waiting_for_room"),
      supabase
        .from("housekeeping_tasks")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(completed,cancelled,rejected)")
        .lt("due_at", new Date().toISOString()),
      supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(resolved,closed)")
        .in("priority", ["critical", "urgent"]),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .not("payment_status", "in", "(paid,completed)"),
    ])

    const firstError = [
      arrivalsResult,
      departuresResult,
      roomsResult,
      waitingResult,
      housekeepingResult,
      issuesResult,
      paymentsResult,
    ].find((result) => result.error)?.error

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

  useEffect(() => {
    void loadMetrics()

    const channel = supabase
      .channel("booking-operations-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => void loadMetrics())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadMetrics, supabase])

  const items = [
    { label: "Llegadas hoy", value: metrics.arrivalsToday, icon: CalendarArrowDown, alert: false },
    { label: "Salidas hoy", value: metrics.departuresToday, icon: CalendarArrowUp, alert: false },
    { label: "Habitaciones no listas", value: metrics.roomsNotReady, icon: BedDouble, alert: metrics.roomsNotReady > 0 },
    { label: "Huéspedes esperando", value: metrics.waitingForRoom, icon: UserRoundClock, alert: metrics.waitingForRoom > 0 },
    { label: "Housekeeping vencido", value: metrics.overdueHousekeeping, icon: ClockAlert, alert: metrics.overdueHousekeeping > 0 },
    { label: "Incidencias críticas", value: metrics.criticalIssues, icon: AlertTriangle, alert: metrics.criticalIssues > 0 },
    { label: "Pagos pendientes", value: metrics.pendingPayments, icon: CircleDollarSign, alert: metrics.pendingPayments > 0 },
  ]

  return (
    <section className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 overflow-x-auto">
        <div className="mr-1 min-w-fit">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">A5 · Operación diaria</p>
          <p className="text-xs text-muted-foreground">
            {updatedAt ? `Actualizado ${updatedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : "Cargando métricas"}
          </p>
        </div>

        {items.map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className={`flex min-w-[145px] items-center gap-3 rounded-lg border px-3 py-2 ${alert ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}
          >
            <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className={`text-lg font-semibold leading-none ${alert ? "text-destructive" : ""}`}>{value}</p>
              <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}

        <Button type="button" variant="ghost" size="icon" className="min-w-9" onClick={() => void loadMetrics()} disabled={loading} aria-label="Actualizar métricas operativas">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </section>
  )
}

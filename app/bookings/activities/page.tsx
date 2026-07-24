"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Grid3x3,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HousekeepingTimeline } from "@/components/housekeeping-timeline"
import { MaintenanceTimeline } from "@/components/maintenance-timeline"
import { RoomStateMatrix } from "@/components/room-state-matrix"

// ── Types ──────────────────────────────────────────────────────────────────

interface Reservation {
  id: string
  guest_name: string
  guest_email?: string | null
  guest_phone?: string | null
  check_in: string
  check_out: string
  status: string
  total_amount?: number | null
  num_guests?: number | null
  bed?: {
    bed_number: string
    room?: {
      room_number: string
      location?: { name: string }
    }
  }
}

type ActivityType = "arrivals" | "departures" | "active" | "pending"
type OpsTab = "housekeeping" | "maintenance" | "room_state"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  checked_in: "Check-in",
  "checked-in": "Check-in",
  checked_out: "Check-out",
  "checked-out": "Check-out",
  cancelled: "Cancelada",
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function BookingActivitiesPage() {
  const supabase = useMemo(() => createClient(), [])

  // Arrivals / departures state
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<ActivityType>("arrivals")
  const today = startOfDay(new Date())

  // Phase D Operations state
  const [opsTab, setOpsTab] = useState<OpsTab>("housekeeping")
  const [hkTasks, setHkTasks] = useState<unknown[]>([])
  const [maintTasks, setMaintTasks] = useState<unknown[]>([])
  const [roomStates, setRoomStates] = useState<unknown[]>([])
  const [opsLoading, setOpsLoading] = useState(true)

  // ── Load arrivals / departures ─────────────────────────────────────────
  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = format(addDays(today, -1), "yyyy-MM-dd")
    const to   = format(addDays(today, 7),  "yyyy-MM-dd")
    const { data, error: loadError } = await supabase
      .from("reservations")
      .select(`
        id, guest_name, guest_email, guest_phone, check_in, check_out, status,
        total_amount, num_guests,
        bed:beds(bed_number, room:rooms(room_number, location:locations(name)))
      `)
      .lte("check_in", to)
      .gte("check_out", from)
      .order("check_in")
    if (loadError) {
      setError(loadError.message)
      setReservations([])
    } else {
      setReservations((data ?? []) as unknown as Reservation[])
    }
    setLoading(false)
  }, [supabase])

  // ── Load Phase D operations data ───────────────────────────────────────
  const loadOps = useCallback(async () => {
    setOpsLoading(true)
    const [hkRes, msRes, rsRes] = await Promise.all([
      fetch("/api/operations/housekeeping"),
      fetch("/api/operations/maintenance"),
      fetch("/api/operations/room-state"),
    ])
    const [hkJson, msJson, rsJson] = await Promise.all([
      hkRes.json(),
      msRes.json(),
      rsRes.json(),
    ])
    setHkTasks(hkJson.data ?? [])
    setMaintTasks(msJson.data ?? [])
    setRoomStates(rsJson.data ?? [])
    setOpsLoading(false)
  }, [])

  useEffect(() => {
    loadReservations()
    loadOps()
    const channel = supabase
      .channel("booking-activities")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadReservations)
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_schedules" }, loadOps)
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_schedules" }, loadOps)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadReservations, loadOps, supabase])

  // ── Computed buckets ───────────────────────────────────────────────────
  const buckets = useMemo(() => {
    const activeStatuses = new Set(["confirmed", "checked_in", "checked-in"])
    return {
      arrivals:   reservations.filter((r) => isSameDay(parseISO(r.check_in),  today) && r.status !== "cancelled"),
      departures: reservations.filter((r) => isSameDay(parseISO(r.check_out), today) && r.status !== "cancelled"),
      active:     reservations.filter((r) => parseISO(r.check_in) <= today && parseISO(r.check_out) > today && activeStatuses.has(r.status)),
      pending:    reservations.filter((r) => r.status === "pending"),
    }
  }, [reservations, today])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return buckets[type].filter((r) => {
      if (!term) return true
      const room     = r.bed?.room?.room_number ?? ""
      const property = r.bed?.room?.location?.name ?? ""
      return [r.guest_name, r.guest_email ?? "", r.guest_phone ?? "", room, property]
        .some((v) => v.toLowerCase().includes(term))
    })
  }, [buckets, search, type])

  // ── Ops derived counts ─────────────────────────────────────────────────
  const hkPending = (hkTasks as { status?: string }[]).filter((t) => t.status !== "completed").length
  const maintOpen = (maintTasks as { status?: string }[]).filter((t) => t.status === "open" || t.status === "pending" || t.status === "in_progress").length
  const maintUrgent = (maintTasks as { priority?: number; status?: string }[]).filter((t) => (t.priority ?? 0) >= 3 && t.status !== "completed" && t.status !== "cancelled").length

  // ── Handlers ───────────────────────────────────────────────────────────
  async function updateReservationStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from("reservations").update({ status }).eq("id", id)
    if (updateError) setError(updateError.message)
    else await loadReservations()
  }

  async function handleHkStatusChange(id: string, status: string) {
    await fetch("/api/operations/housekeeping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    await loadOps()
  }

  async function handleMaintStatusChange(id: string, status: string) {
    await fetch("/api/operations/maintenance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    await loadOps()
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Centro de Operaciones</h1>
            <p className="text-sm text-muted-foreground">
              Llegadas, salidas, housekeeping y mantenimiento.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/bookings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Calendario
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => { loadReservations(); loadOps() }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* ── Section A: Arrivals / Departures ────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Actividad de reservas
            </h2>
          </div>

          {/* KPI tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <MetricTile
              title="Llegadas hoy"
              value={buckets.arrivals.length}
              icon={<LogIn className="h-4 w-4" />}
              active={type === "arrivals"}
              onClick={() => setType("arrivals")}
            />
            <MetricTile
              title="Salidas hoy"
              value={buckets.departures.length}
              icon={<LogOut className="h-4 w-4" />}
              active={type === "departures"}
              onClick={() => setType("departures")}
            />
            <MetricTile
              title="Estancias activas"
              value={buckets.active.length}
              icon={<CalendarCheck className="h-4 w-4" />}
              active={type === "active"}
              onClick={() => setType("active")}
            />
            <MetricTile
              title="Pendientes"
              value={buckets.pending.length}
              icon={<Clock3 className="h-4 w-4" />}
              active={type === "pending"}
              onClick={() => setType("pending")}
            />
          </div>

          {/* Search + filter */}
          <Card className="mb-4">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar huesped, habitacion o propiedad"
                />
              </div>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="arrivals">Llegadas de hoy</SelectItem>
                  <SelectItem value="departures">Salidas de hoy</SelectItem>
                  <SelectItem value="active">Estancias activas</SelectItem>
                  <SelectItem value="pending">Reservas pendientes</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {visible.length} {type === "arrivals" ? "llegadas" : type === "departures" ? "salidas" : type === "active" ? "estancias" : "pendientes"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Cargando...</p>
              ) : visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No hay actividades para esta vista.
                </p>
              ) : (
                visible.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{reservation.guest_name}</p>
                        <Badge variant="outline">
                          {STATUS_LABELS[reservation.status] ?? reservation.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {reservation.bed?.room?.location?.name ?? "Sin propiedad"} &middot;{" "}
                        Hab. {reservation.bed?.room?.room_number ?? "—"} &middot;{" "}
                        {reservation.bed?.bed_number ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {reservation.check_in} → {reservation.check_out} &middot;{" "}
                        {reservation.num_guests ?? 1} huesped(es)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(reservation.status === "confirmed" || reservation.status === "pending") && (
                        <Button
                          size="sm"
                          onClick={() => updateReservationStatus(reservation.id, "checked_in")}
                        >
                          <LogIn className="mr-2 h-4 w-4" />
                          Check-in
                        </Button>
                      )}
                      {(reservation.status === "checked_in" || reservation.status === "checked-in") && (
                        <Button
                          size="sm"
                          onClick={() => updateReservationStatus(reservation.id, "checked_out")}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Check-out
                        </Button>
                      )}
                      {reservation.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateReservationStatus(reservation.id, "confirmed")}
                        >
                          Confirmar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Section B: Phase D Operations ─────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Operaciones del dia
            </h2>
          </div>

          {/* Ops KPI strip */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div
              className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${opsTab === "housekeeping" ? "border-primary bg-primary/5" : "bg-card"}`}
              onClick={() => setOpsTab("housekeeping")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setOpsTab("housekeeping")}
            >
              <div className="flex items-center justify-between">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold tabular-nums">{hkPending}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">HK pendientes</p>
            </div>

            <div
              className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${opsTab === "maintenance" ? "border-primary bg-primary/5" : "bg-card"}`}
              onClick={() => setOpsTab("maintenance")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setOpsTab("maintenance")}
            >
              <div className="flex items-center justify-between">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums">{maintOpen}</span>
                  {maintUrgent > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-rose-500">
                      <AlertTriangle className="h-3 w-3" />
                      {maintUrgent}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Mantenimiento abierto</p>
            </div>

            <div
              className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${opsTab === "room_state" ? "border-primary bg-primary/5" : "bg-card"}`}
              onClick={() => setOpsTab("room_state")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setOpsTab("room_state")}
            >
              <div className="flex items-center justify-between">
                <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold tabular-nums">{roomStates.length}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Habitaciones</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-lg border bg-muted/40 p-1">
            {(
              [
                { id: "housekeeping" as const, label: "Housekeeping", icon: Sparkles },
                { id: "maintenance"  as const, label: "Mantenimiento", icon: Wrench },
                { id: "room_state"   as const, label: "Estado habitaciones", icon: Grid3x3 },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOpsTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  opsTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <Card>
            <CardContent className="p-4">
              {opsLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Cargando operaciones...
                </p>
              ) : opsTab === "housekeeping" ? (
                <HousekeepingTimeline
                  tasks={hkTasks as Parameters<typeof HousekeepingTimeline>[0]["tasks"]}
                  onStatusChange={handleHkStatusChange}
                />
              ) : opsTab === "maintenance" ? (
                <MaintenanceTimeline
                  tasks={maintTasks as Parameters<typeof MaintenanceTimeline>[0]["tasks"]}
                  onStatusChange={handleMaintStatusChange}
                />
              ) : (
                <RoomStateMatrix
                  rooms={roomStates as Parameters<typeof RoomStateMatrix>[0]["rooms"]}
                />
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}

// ── Metric tile ────────────────────────────────────────────────────────────

function MetricTile({
  title,
  value,
  icon,
  active,
  onClick,
}: {
  title: string
  value: number
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="text-left focus-visible:outline-none">
      <Card className={`transition-colors ${active ? "border-primary ring-1 ring-primary" : "hover:border-border/80"}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </CardContent>
      </Card>
    </button>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { Activity, AlertTriangle, ArrowLeft, CalendarCheck, Clock3, Grid3x3, LogIn, LogOut, RefreshCw, Search, Sparkles, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HousekeepingTimeline } from "@/components/housekeeping-timeline"
import { MaintenanceTimeline } from "@/components/maintenance-timeline"
import { RoomStateMatrix } from "@/components/room-state-matrix"
import { useLanguage } from "@/lib/hooks/use-language"
import { bookingActivitiesTranslations } from "@/lib/translations/booking-activities"

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
  bed?: { bed_number: string; room?: { room_number: string; location?: { name: string } } }
}

type ActivityType = "arrivals" | "departures" | "active" | "pending"
type OpsTab = "housekeeping" | "maintenance" | "room_state"

type ActionError = {
  message: string
  code: "preparation_pending" | "room_not_ready" | "other"
}

export default function BookingActivitiesPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = bookingActivitiesTranslations[language]
  const localize = (href: string) => `/${language}${href}`
  const statusLabels: Record<string, string> = {
    pending: copy.statusPending,
    confirmed: copy.statusConfirmed,
    checked_in: copy.checkIn,
    "checked-in": copy.checkIn,
    checked_out: copy.checkOut,
    "checked-out": copy.checkOut,
    cancelled: copy.statusCancelled,
  }

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<ActionError | null>(null)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<ActivityType>("arrivals")
  const today = useMemo(() => startOfDay(new Date()), [])
  const [opsTab, setOpsTab] = useState<OpsTab>("housekeeping")
  const [hkTasks, setHkTasks] = useState<unknown[]>([])
  const [maintTasks, setMaintTasks] = useState<unknown[]>([])
  const [roomStates, setRoomStates] = useState<unknown[]>([])
  const [opsLoading, setOpsLoading] = useState(true)

  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = format(addDays(today, -1), "yyyy-MM-dd")
    const to = format(addDays(today, 7), "yyyy-MM-dd")
    const { data, error: loadError } = await supabase
      .from("reservations")
      .select(`id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_amount, num_guests, bed:beds(bed_number, room:rooms(room_number, location:locations(name)))`)
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
  }, [supabase, today])

  const loadOps = useCallback(async () => {
    setOpsLoading(true)
    const [hkRes, msRes, rsRes] = await Promise.all([
      fetch("/api/operations/housekeeping"),
      fetch("/api/operations/maintenance"),
      fetch("/api/operations/room-state"),
    ])
    const [hkJson, msJson, rsJson] = await Promise.all([hkRes.json(), msRes.json(), rsRes.json()])
    setHkTasks(hkJson.data ?? [])
    setMaintTasks(msJson.data ?? [])
    setRoomStates(rsJson.data ?? [])
    setOpsLoading(false)
  }, [])

  useEffect(() => {
    void loadReservations()
    void loadOps()
    const channel = supabase
      .channel("booking-activities")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadReservations())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_schedules" }, () => void loadOps())
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_schedules" }, () => void loadOps())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadReservations, loadOps, supabase])

  const buckets = useMemo(() => {
    const activeStatuses = new Set(["confirmed", "checked_in", "checked-in"])
    return {
      arrivals: reservations.filter((r) => isSameDay(parseISO(r.check_in), today) && r.status !== "cancelled"),
      departures: reservations.filter((r) => isSameDay(parseISO(r.check_out), today) && r.status !== "cancelled"),
      active: reservations.filter((r) => parseISO(r.check_in) <= today && parseISO(r.check_out) > today && activeStatuses.has(r.status)),
      pending: reservations.filter((r) => r.status === "pending"),
    }
  }, [reservations, today])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return buckets[type].filter((r) => {
      if (!term) return true
      const room = r.bed?.room?.room_number ?? ""
      const property = r.bed?.room?.location?.name ?? ""
      return [r.guest_name, r.guest_email ?? "", r.guest_phone ?? "", room, property].some((v) => v.toLowerCase().includes(term))
    })
  }, [buckets, search, type])

  const hkPending = (hkTasks as { status?: string }[]).filter((t) => t.status !== "completed").length
  const maintOpen = (maintTasks as { status?: string }[]).filter((t) => ["open", "pending", "in_progress"].includes(t.status ?? "")).length
  const maintUrgent = (maintTasks as { priority?: number; status?: string }[]).filter((t) => (t.priority ?? 0) >= 3 && t.status !== "completed" && t.status !== "cancelled").length

  function classifyActionError(message: string): ActionError {
    if (message.includes("preparation_pending")) return { code: "preparation_pending", message: copy.preparationPending }
    if (message.includes("room_not_ready")) return { code: "room_not_ready", message: copy.roomNotReady }
    return { code: "other", message: copy.operationalError }
  }

  async function updateReservationStatus(id: string, status: string) {
    setActionError(null)
    if (status === "checked_in") {
      const { error: checkInError } = await supabase.rpc("check_in_or_queue", { p_reservation_id: id })
      if (checkInError) {
        setActionError(classifyActionError(checkInError.message))
        return
      }
      await loadReservations()
      return
    }

    const { error: updateError } = await supabase.from("reservations").update({ status }).eq("id", id)
    if (updateError) setActionError(classifyActionError(updateError.message))
    else await loadReservations()
  }

  async function handleHkStatusChange(id: string, status: string) {
    await fetch("/api/operations/housekeeping", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    await loadOps()
  }

  async function handleMaintStatusChange(id: string, status: string) {
    await fetch("/api/operations/maintenance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    await loadOps()
  }

  const visibleLabel = type === "arrivals" ? copy.arrivals : type === "departures" ? copy.departures : type === "active" ? copy.stays : copy.pendingPlural
  const tabs = [
    { id: "housekeeping" as const, label: copy.housekeeping, icon: Sparkles },
    { id: "maintenance" as const, label: copy.maintenance, icon: Wrench },
    { id: "room_state" as const, label: copy.roomState, icon: Grid3x3 },
  ]

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href={localize("/bookings/calendar")}><ArrowLeft className="mr-2 h-4 w-4" />{copy.calendar}</Link></Button>
            <Button variant="outline" onClick={() => { setActionError(null); void loadReservations(); void loadOps() }}><RefreshCw className="mr-2 h-4 w-4" />{copy.refresh}</Button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{copy.bookingActivity}</h2></div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile title={copy.arrivalsToday} value={buckets.arrivals.length} icon={<LogIn className="h-4 w-4" />} active={type === "arrivals"} onClick={() => setType("arrivals")} />
            <MetricTile title={copy.departuresToday} value={buckets.departures.length} icon={<LogOut className="h-4 w-4" />} active={type === "departures"} onClick={() => setType("departures")} />
            <MetricTile title={copy.activeStays} value={buckets.active.length} icon={<CalendarCheck className="h-4 w-4" />} active={type === "active"} onClick={() => setType("active")} />
            <MetricTile title={copy.pending} value={buckets.pending.length} icon={<Clock3 className="h-4 w-4" />} active={type === "pending"} onClick={() => setType("pending")} />
          </div>

          {actionError && (
            <Card className="mb-4 border-amber-500/40 bg-amber-500/10">
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-semibold">{copy.attentionRequired}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{actionError.message}</p>
                  </div>
                </div>
                {(actionError.code === "preparation_pending" || actionError.code === "room_not_ready") && (
                  <Button asChild size="sm"><Link href={localize("/bookings/housekeeping")}><Sparkles className="mr-2 h-4 w-4" />{copy.resolveHousekeeping}</Link></Button>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="mb-4"><CardContent className="flex flex-col gap-3 p-4 md:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} /></div>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}><SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="arrivals">{copy.arrivalsToday}</SelectItem><SelectItem value="departures">{copy.departuresToday}</SelectItem><SelectItem value="active">{copy.activeStays}</SelectItem><SelectItem value="pending">{copy.pending}</SelectItem></SelectContent></Select>
          </CardContent></Card>

          {error && <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">{error}</div>}
          <Card><CardHeader><CardTitle className="text-sm font-medium">{visible.length} {visibleLabel}</CardTitle></CardHeader><CardContent className="space-y-3">
            {loading ? <p className="py-10 text-center text-sm text-muted-foreground">{copy.loading}</p> : visible.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{copy.noActivity}</p> : visible.map((reservation) => (
              <div key={reservation.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{reservation.guest_name}</p><Badge variant="outline">{statusLabels[reservation.status] ?? reservation.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{reservation.bed?.room?.location?.name ?? copy.noProperty} · {copy.roomShort} {reservation.bed?.room?.room_number ?? "—"} · {reservation.bed?.bed_number ?? "—"}</p><p className="text-sm text-muted-foreground">{reservation.check_in} → {reservation.check_out} · {reservation.num_guests ?? 1} {copy.guests}</p></div>
                <div className="flex flex-wrap gap-2">
                  {reservation.status === "pending" && <Button size="sm" onClick={() => void updateReservationStatus(reservation.id, "confirmed")}>{copy.confirm}</Button>}
                  {reservation.status === "confirmed" && <Button size="sm" onClick={() => void updateReservationStatus(reservation.id, "checked_in")}><LogIn className="mr-2 h-4 w-4" />{copy.checkIn}</Button>}
                  {(reservation.status === "checked_in" || reservation.status === "checked-in") && <Button size="sm" onClick={() => void updateReservationStatus(reservation.id, "checked_out")}><LogOut className="mr-2 h-4 w-4" />{copy.checkOut}</Button>}
                </div>
              </div>
            ))}
          </CardContent></Card>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{copy.dayOperations}</h2></div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <OpsTile active={opsTab === "housekeeping"} onClick={() => setOpsTab("housekeeping")} icon={<Sparkles className="h-4 w-4 text-muted-foreground" />} value={hkPending} label={copy.hkPending} />
            <OpsTile active={opsTab === "maintenance"} onClick={() => setOpsTab("maintenance")} icon={<Wrench className="h-4 w-4 text-muted-foreground" />} value={maintOpen} label={copy.maintenanceOpen} extra={maintUrgent > 0 ? <span className="flex items-center gap-1 text-xs font-medium text-rose-500"><AlertTriangle className="h-3 w-3" />{maintUrgent}</span> : null} />
            <OpsTile active={opsTab === "room_state"} onClick={() => setOpsTab("room_state")} icon={<Grid3x3 className="h-4 w-4 text-muted-foreground" />} value={roomStates.length} label={copy.rooms} />
          </div>

          <div className="mb-4 flex gap-1 rounded-lg border bg-muted/40 p-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setOpsTab(tab.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${opsTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><tab.icon className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">{tab.label}</span></button>)}</div>

          <Card><CardContent className="p-4">{opsLoading ? <p className="py-10 text-center text-sm text-muted-foreground">{copy.loadingOperations}</p> : opsTab === "housekeeping" ? <HousekeepingTimeline tasks={hkTasks as Parameters<typeof HousekeepingTimeline>[0]["tasks"]} onStatusChange={handleHkStatusChange} /> : opsTab === "maintenance" ? <MaintenanceTimeline tasks={maintTasks as Parameters<typeof MaintenanceTimeline>[0]["tasks"]} onStatusChange={handleMaintStatusChange} /> : <RoomStateMatrix rooms={roomStates as Parameters<typeof RoomStateMatrix>[0]["rooms"]} />}</CardContent></Card>
        </div>
      </div>
    </div>
  )
}

function MetricTile({ title, value, icon, active, onClick }: { title: string; value: number; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-left focus-visible:outline-none"><Card className={`transition-colors ${active ? "border-primary ring-1 ring-primary" : "hover:border-border/80"}`}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{value}</div></CardContent></Card></button>
}

function OpsTile({ active, onClick, icon, value, label, extra }: { active: boolean; onClick: () => void; icon: React.ReactNode; value: number; label: string; extra?: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/30 ${active ? "border-primary bg-primary/5" : "bg-card"}`}><div className="flex items-center justify-between">{icon}<div className="flex items-center gap-2"><span className="text-2xl font-bold tabular-nums">{value}</span>{extra}</div></div><p className="mt-1 text-xs text-muted-foreground">{label}</p></button>
}
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { AlertTriangle, Grid3x3, LogIn, LogOut, RefreshCw, Search, Sparkles, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
type ActionError = { message: string; code: "preparation_pending" | "room_not_ready" | "other" }

type RoomState = {
  id: string
  room_number: string
  room_type: string | null
  location: string | null
  location_id: string | null
  status: string | null
  capacity: number | null
  reservation_status: string | null
  guest_name: string | null
  check_out: string | null
  housekeeping_status: string | null
}

export default function BookingActivitiesPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = bookingActivitiesTranslations[language]
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
  const [roomStates, setRoomStates] = useState<RoomState[]>([])
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
    const todayIso = format(today, "yyyy-MM-dd")
    const [hkRes, maintRes, roomsRes, activeRes, todayHkRes] = await Promise.all([
      supabase.from("housekeeping_schedules").select(`*, bed:beds(bed_number, room:rooms(room_number, location)), reservation:reservations(guest_name, check_out)`).order("checkout_time", { ascending: true }).limit(200),
      supabase.from("maintenance_schedules").select(`*, bed:beds(bed_number, room:rooms(room_number, location))`).order("scheduled_date", { ascending: true }).limit(200),
      supabase.from("rooms").select("id, room_number, room_type, location, location_id, status, capacity").order("room_number"),
      supabase.from("reservations").select("room_id, guest_name, check_out, status").lte("check_in", todayIso).gte("check_out", todayIso).in("status", ["confirmed", "checked_in", "checked-in"]),
      supabase.from("housekeeping_schedules").select("bed_id, status").gte("checkout_time", `${todayIso}T00:00:00`).lte("checkout_time", `${todayIso}T23:59:59`),
    ])

    const firstError = hkRes.error || maintRes.error || roomsRes.error || activeRes.error || todayHkRes.error
    if (firstError) {
      setError(firstError.message)
      setOpsLoading(false)
      return
    }

    const todayHk = todayHkRes.data ?? []
    const bedIds = todayHk.map((task) => task.bed_id).filter(Boolean) as string[]
    const bedsResult = bedIds.length
      ? await supabase.from("beds").select("id, room_id").in("id", bedIds)
      : { data: [], error: null }

    if (bedsResult.error) {
      setError(bedsResult.error.message)
      setOpsLoading(false)
      return
    }

    const bedToRoom = Object.fromEntries((bedsResult.data ?? []).map((bed) => [bed.id, bed.room_id]))
    const activeReservations = activeRes.data ?? []
    const enrichedRooms: RoomState[] = (roomsRes.data ?? []).map((room) => {
      const reservation = activeReservations.find((item) => item.room_id === room.id)
      const housekeeping = todayHk.find((task) => bedToRoom[task.bed_id ?? ""] === room.id)
      return {
        ...room,
        reservation_status: reservation?.status ?? null,
        guest_name: reservation?.guest_name ?? null,
        check_out: reservation?.check_out ?? null,
        housekeeping_status: housekeeping?.status ?? null,
      }
    })

    setHkTasks(hkRes.data ?? [])
    setMaintTasks(maintRes.data ?? [])
    setRoomStates(enrichedRooms)
    setOpsLoading(false)
  }, [supabase, today])

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
    return buckets[type].filter((reservation) => {
      if (!term) return true
      const room = reservation.bed?.room?.room_number ?? ""
      const property = reservation.bed?.room?.location?.name ?? ""
      return [reservation.guest_name, reservation.guest_email ?? "", reservation.guest_phone ?? "", room, property].some((value) => value.toLowerCase().includes(term))
    })
  }, [buckets, search, type])

  const hkPending = (hkTasks as { status?: string }[]).filter((task) => task.status !== "completed").length
  const maintOpen = (maintTasks as { status?: string }[]).filter((task) => ["open", "pending", "in_progress"].includes(task.status ?? "")).length
  const maintUrgent = (maintTasks as { priority?: number; status?: string }[]).filter((task) => (task.priority ?? 0) >= 3 && task.status !== "completed" && task.status !== "cancelled").length

  function classifyActionError(message: string): ActionError {
    if (message.includes("preparation_pending")) return { code: "preparation_pending", message: copy.preparationPending }
    if (message.includes("room_not_ready")) return { code: "room_not_ready", message: copy.roomNotReady }
    return { code: "other", message: copy.operationalError }
  }

  async function updateReservationStatus(id: string, status: string) {
    setActionError(null)
    if (status === "checked_in") {
      const { error: checkInError } = await supabase.rpc("check_in_or_queue", { p_reservation_id: id })
      if (checkInError) { setActionError(classifyActionError(checkInError.message)); return }
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
  const opsTabs = [
    { id: "housekeeping" as const, label: copy.housekeeping, value: hkPending, icon: Sparkles },
    { id: "maintenance" as const, label: copy.maintenance, value: maintOpen, icon: Wrench },
    { id: "room_state" as const, label: copy.roomState, value: roomStates.length, icon: Grid3x3 },
  ]

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
      <div><h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.subtitle}</p></div>
      <Button variant="outline" className="h-8 rounded-[4px] border-white/10 bg-[#111314] px-3 text-xs" onClick={() => { setActionError(null); void loadReservations(); void loadOps() }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{copy.refresh}</Button>
    </header>

    <div className="flex min-h-[44px] flex-col gap-2 border-b border-white/10 bg-[#151718] px-4 py-1.5 md:flex-row md:items-center md:px-5">
      <div className="flex flex-wrap gap-1.5">
        {([
          ["arrivals", copy.arrivalsToday, buckets.arrivals.length, LogIn],
          ["departures", copy.departuresToday, buckets.departures.length, LogOut],
          ["active", copy.activeStays, buckets.active.length, Grid3x3],
          ["pending", copy.pending, buckets.pending.length, AlertTriangle],
        ] as const).map(([id, label, value, Icon]) => <button key={id} type="button" onClick={() => setType(id)} className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] border px-2.5 text-xs ${type === id ? "border-[#00ce63]/50 bg-[#15261d] text-[#00ce63]" : "border-white/10 bg-[#111314] text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" /><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></button>)}
      </div>
      <div className="relative ml-auto w-full md:max-w-sm"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 rounded-[4px] border-white/10 bg-[#111314] pl-8 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} /></div>
      <Select value={type} onValueChange={(value) => setType(value as ActivityType)}><SelectTrigger className="h-8 rounded-[4px] border-white/10 bg-[#111314] text-xs md:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="arrivals">{copy.arrivalsToday}</SelectItem><SelectItem value="departures">{copy.departuresToday}</SelectItem><SelectItem value="active">{copy.activeStays}</SelectItem><SelectItem value="pending">{copy.pending}</SelectItem></SelectContent></Select>
    </div>

    {actionError && <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100 md:px-5"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" /><span>{actionError.message}</span></div>}
    {error && <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200 md:px-5">{error}</div>}

    <section className="border-b border-white/10">
      <div className="flex items-center justify-between bg-[#17191a] px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:px-5"><span>{visibleLabel}</span><span>{visible.length}</span></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-xs">
          <thead className="border-y border-white/[0.06] bg-[#141617] text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-2">{copy.guest}</th><th className="px-4 py-2">Property / Room</th><th className="px-4 py-2">Stay</th><th className="px-4 py-2">{copy.status}</th><th className="px-4 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-white/[0.06]">
            {loading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{copy.loading}</td></tr> : visible.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{copy.noActivity}</td></tr> : visible.map((reservation) => <tr key={reservation.id} className="hover:bg-white/[0.025]"><td className="px-4 py-2.5"><div className="font-medium">{reservation.guest_name}</div><div className="text-[11px] text-muted-foreground">{reservation.guest_email || reservation.guest_phone || "—"}</div></td><td className="px-4 py-2.5 text-muted-foreground">{reservation.bed?.room?.location?.name ?? copy.noProperty} · {copy.roomShort} {reservation.bed?.room?.room_number ?? "—"} · {reservation.bed?.bed_number ?? "—"}</td><td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{reservation.check_in} → {reservation.check_out} · {reservation.num_guests ?? 1} {copy.guests}</td><td className="px-4 py-2.5"><Badge variant="outline" className="h-5 rounded-[3px] px-1.5 text-[10px]">{statusLabels[reservation.status] ?? reservation.status}</Badge></td><td className="px-4 py-2.5 text-right">{reservation.status === "pending" ? <Button size="sm" className="h-7 rounded-[4px] px-2 text-xs" onClick={() => void updateReservationStatus(reservation.id, "confirmed")}>{copy.confirm}</Button> : reservation.status === "confirmed" ? <Button size="sm" className="h-7 rounded-[4px] px-2 text-xs" onClick={() => void updateReservationStatus(reservation.id, "checked_in")}><LogIn className="mr-1 h-3.5 w-3.5" />{copy.checkIn}</Button> : (reservation.status === "checked_in" || reservation.status === "checked-in") ? <Button size="sm" className="h-7 rounded-[4px] px-2 text-xs" onClick={() => void updateReservationStatus(reservation.id, "checked_out")}><LogOut className="mr-1 h-3.5 w-3.5" />{copy.checkOut}</Button> : null}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-[#151718] px-4 py-1.5 md:px-5">
        {opsTabs.map(({ id, label, value, icon: Icon }) => <button key={id} type="button" onClick={() => setOpsTab(id)} className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] border px-2.5 text-xs ${opsTab === id ? "border-[#00ce63]/50 bg-[#15261d] text-[#00ce63]" : "border-white/10 bg-[#111314] text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" /><span>{label}</span><span className="font-semibold tabular-nums">{value}</span>{id === "maintenance" && maintUrgent > 0 ? <span className="text-rose-400">+{maintUrgent}</span> : null}</button>)}
      </div>
      <div className="p-4 md:p-5">{opsLoading ? <p className="py-10 text-center text-sm text-muted-foreground">{copy.loadingOperations}</p> : opsTab === "housekeeping" ? <HousekeepingTimeline tasks={hkTasks as Parameters<typeof HousekeepingTimeline>[0]["tasks"]} onStatusChange={handleHkStatusChange} /> : opsTab === "maintenance" ? <MaintenanceTimeline tasks={maintTasks as Parameters<typeof MaintenanceTimeline>[0]["tasks"]} onStatusChange={handleMaintStatusChange} /> : <RoomStateMatrix rooms={roomStates as Parameters<typeof RoomStateMatrix>[0]["rooms"]} />}</div>
    </section>
  </div>
}

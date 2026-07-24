"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import {
  Ban, CalendarDays, ChevronLeft, ChevronRight,
  CircleDollarSign, Loader2, LogIn, LogOut, Moon, Plus, Search, Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { OccupancyHeatmap } from "@/components/occupancy-heatmap"
import { GapFillerDialog } from "@/components/gap-filler-dialog"
import { HousekeepingTimeline } from "@/components/housekeeping-timeline"
import { MaintenanceTimeline } from "@/components/maintenance-timeline"
import { RoomStateMatrix } from "@/components/room-state-matrix"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ─── Column sizing ───────────────────────────────────────────────────────────
const COL_WIDTH = 96  // px per day column
const ROW_HEIGHT = 48 // px per bed row
const BED_COL_W = 192 // px for the frozen bed label column

// ─── Types ───────────────────────────────────────────────────────────────────
interface Location { id: string; name: string }
interface Bed {
  id: string
  bed_number: string
  bed_type: string
  room: {
    id: string
    room_number: string
    room_type?: string
    location_id: string
    location_ref?: { id: string; name: string }
  }
}
interface Reservation {
  id: string
  bed_id: string
  guest_name: string
  guest_email?: string | null
  guest_phone?: string | null
  check_in: string
  check_out: string
  status: string
  num_guests?: number | null
  total_amount?: number | null
  special_requests?: string | null
}
interface RoomBlock {
  id: string
  room_id: string
  start_date: string
  end_date: string
  block_type: string
  reason: string
  notes?: string | null
  status: string
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_BG: Record<string, string> = {
  confirmed: "#7c3aed",
  checked_in: "#059669",
  "checked-in": "#059669",
  checked_out: "#475569",
  "checked-out": "#475569",
  pending: "#f59e0b",
  cancelled: "#ef4444",
}
const STATUS_BORDER: Record<string, string> = {
  confirmed: "#6d28d9",
  checked_in: "#047857",
  "checked-in": "#047857",
  checked_out: "#334155",
  "checked-out": "#334155",
  pending: "#d97706",
  cancelled: "#dc2626",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  checked_in: "Check-in",
  "checked-in": "Check-in",
  checked_out: "Check-out",
  "checked-out": "Check-out",
  cancelled: "Cancelada",
}
const BLOCK_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento",
  owner_use: "Uso propietario",
  out_of_service: "Fuera de servicio",
  other: "Bloqueada",
}

function norm(v: string) { return v.replaceAll("-", "_") }
function formatClp(v: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v)
}

// ─── Inline reservation block ─────────────────────────────────────────────────
function ReservationBar({
  reservation,
  startDate,
  rangeDays,
  onOpen,
}: {
  reservation: Reservation
  startDate: Date
  rangeDays: number
  onOpen: (r: Reservation) => void
}) {
  const checkIn = parseISO(reservation.check_in)
  const checkOut = parseISO(reservation.check_out)
  const rangeEnd = addDays(startDate, rangeDays)

  // Clamp to visible range
  const visibleStart = checkIn < startDate ? startDate : checkIn
  const visibleEnd = checkOut > rangeEnd ? rangeEnd : checkOut

  const offsetDays = differenceInCalendarDays(visibleStart, startDate)
  const widthDays = differenceInCalendarDays(visibleEnd, visibleStart)

  if (widthDays <= 0) return null

  const left = offsetDays * COL_WIDTH + 2
  const width = widthDays * COL_WIDTH - 4
  const bg = STATUS_BG[norm(reservation.status)] ?? STATUS_BG.confirmed
  const border = STATUS_BORDER[norm(reservation.status)] ?? STATUS_BORDER.confirmed

  return (
    <button
      onClick={() => onOpen(reservation)}
      title={`${reservation.guest_name} · ${reservation.check_in} → ${reservation.check_out}`}
      className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center overflow-hidden group hover:brightness-110 transition-all select-none"
      style={{
        left,
        width,
        height: ROW_HEIGHT - 8,
        backgroundColor: bg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: border,
        color: "#fff",
        zIndex: 10,
      }}
    >
      {/* Check-in notch */}
      {checkIn >= startDate && (
        <div className="absolute left-0 top-0 bottom-0 w-2 flex items-center justify-center opacity-40">
          <LogIn className="h-2.5 w-2.5" />
        </div>
      )}
      <span className="truncate px-3 text-[11px] font-semibold leading-none">
        {reservation.guest_name}
        {reservation.num_guests ? <span className="ml-1 opacity-70 text-[9px]">{reservation.num_guests}p</span> : null}
      </span>
      {/* Check-out notch */}
      {checkOut <= rangeEnd && (
        <div className="absolute right-0 top-0 bottom-0 w-2 flex items-center justify-center opacity-40">
          <LogOut className="h-2.5 w-2.5" />
        </div>
      )}
    </button>
  )
}

// ─── Inline block bar ─────────────────────────────────────────────────────────
function BlockBar({
  block,
  startDate,
  rangeDays,
  onOpen,
}: {
  block: RoomBlock
  startDate: Date
  rangeDays: number
  onOpen: (b: RoomBlock) => void
}) {
  const blockStart = parseISO(block.start_date)
  const blockEnd = parseISO(block.end_date)
  const rangeEnd = addDays(startDate, rangeDays)

  const visibleStart = blockStart < startDate ? startDate : blockStart
  const visibleEnd = blockEnd > rangeEnd ? rangeEnd : blockEnd
  const offsetDays = differenceInCalendarDays(visibleStart, startDate)
  const widthDays = differenceInCalendarDays(visibleEnd, visibleStart)

  if (widthDays <= 0) return null

  const left = offsetDays * COL_WIDTH + 2
  const width = widthDays * COL_WIDTH - 4

  return (
    <button
      onClick={() => onOpen(block)}
      title={`${BLOCK_LABELS[block.block_type] ?? "Bloqueada"} · ${block.reason}`}
      className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center overflow-hidden hover:brightness-110 transition-all select-none border border-zinc-500 bg-zinc-700"
      style={{
        left,
        width,
        height: ROW_HEIGHT - 10,
        zIndex: 10,
        color: "#d4d4d8",
      }}
    >
      <Ban className="ml-2 h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate px-2 text-[11px] font-medium">
        {BLOCK_LABELS[block.block_type] ?? "Bloqueada"}
      </span>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BookingsCalendarPage() {
  const supabase = useMemo(() => createClient(), [])

  const [locations, setLocations] = useState<Location[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])

  const [locationId, setLocationId] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [rangeDays, setRangeDays] = useState(14)
  const [startDate, setStartDate] = useState(startOfDay(new Date()))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [preselectedBed, setPreselectedBed] = useState<Bed | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<RoomBlock | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showOperations, setShowOperations] = useState(false)
  const [gaps, setGaps] = useState<{ bedId: string; startDate: string; endDate: string; days: number }[]>([])
  const [selectedGap, setSelectedGap] = useState<{ bedId: string; startDate: string; endDate: string; days: number } | null>(null)
  const [housekeepingTasks, setHousekeepingTasks] = useState<any[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<any[]>([])
  const [roomStates, setRoomStates] = useState<any[]>([])

  const endDate = useMemo(() => addDays(startDate, rangeDays), [startDate, rangeDays])
  const dates = useMemo(
    () => Array.from({ length: rangeDays }, (_, i) => addDays(startDate, i)),
    [startDate, rangeDays],
  )

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const endStr = format(endDate, "yyyy-MM-dd")
    const startStr = format(startDate, "yyyy-MM-dd")

    try {
      const [locRes, bedRes, resRes, blkRes] = await Promise.all([
        supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
        supabase
          .from("beds")
          .select("id, bed_number, bed_type, room:rooms!inner(id, room_number, room_type, location_id, location_ref:locations(id, name))")
          .order("room_id"),
        supabase
          .from("reservations")
          .select("id, bed_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests, total_amount, special_requests")
          .lt("check_in", endStr)
          .gt("check_out", startStr)
          .not("status", "eq", "cancelled")
          .order("check_in"),
        supabase
          .from("room_blocks")
          .select("id, room_id, start_date, end_date, block_type, reason, notes, status")
          .eq("status", "active")
          .lt("start_date", endStr)
          .gt("end_date", startStr)
          .order("start_date"),
      ])

      const firstError = locRes.error || bedRes.error || resRes.error || blkRes.error
      if (firstError) {
        setError(firstError.message)
        return
      }
      setLocations((locRes.data ?? []) as Location[])
      setBeds((bedRes.data ?? []) as unknown as Bed[])
      setReservations((resRes.data ?? []) as Reservation[])
      setBlocks((blkRes.data ?? []) as RoomBlock[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [supabase, startDate, endDate])

  // Reload whenever date range changes
  useEffect(() => {
    loadData()
  }, [loadData])

  // Load operations data
  useEffect(() => {
    const load = async () => {
      try {
        const [hk, mt, rs] = await Promise.all([
          fetch("/api/operations/housekeeping").then(r => r.json()).catch(() => ({ data: [] })),
          fetch("/api/operations/maintenance").then(r => r.json()).catch(() => ({ data: [] })),
          fetch("/api/operations/room-state").then(r => r.json()).catch(() => ({ data: [] })),
        ])
        setHousekeepingTasks(hk.data || [])
        setMaintenanceTasks(mt.data || [])
        setRoomStates(rs.data || [])
      } catch { /* silent */ }
    }
    load()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("calendar-realtime-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  // ─── Derived data ───────────────────────────────────────────────────────────
  const visibleBeds = useMemo(() => {
    const term = search.trim().toLowerCase()
    return beds.filter((bed) => {
      const matchLoc = locationId === "all" || bed.room.location_id === locationId
      const matchSearch = !term
        || bed.room.room_number.toLowerCase().includes(term)
        || bed.bed_number.toLowerCase().includes(term)
        || bed.bed_type.toLowerCase().includes(term)
      return matchLoc && matchSearch
    })
  }, [beds, locationId, search])

  const visibleBedIds = useMemo(() => new Set(visibleBeds.map(b => b.id)), [visibleBeds])
  const visibleRoomIds = useMemo(() => new Set(visibleBeds.map(b => b.room.id)), [visibleBeds])

  const visibleReservations = useMemo(() =>
    reservations.filter(r => {
      const matchBed = visibleBedIds.has(r.bed_id)
      const matchStatus = statusFilter === "all" || norm(r.status) === statusFilter
      const matchSearch = !search.trim() || r.guest_name.toLowerCase().includes(search.trim().toLowerCase())
      return matchBed && matchStatus && matchSearch
    }),
    [reservations, visibleBedIds, statusFilter, search]
  )

  const visibleBlocks = useMemo(() =>
    blocks.filter(b => visibleRoomIds.has(b.room_id)),
    [blocks, visibleRoomIds]
  )

  // Group reservations and blocks by bed/room
  const resByBed = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    visibleReservations.forEach(r => map.set(r.bed_id, [...(map.get(r.bed_id) ?? []), r]))
    return map
  }, [visibleReservations])

  const blocksByRoom = useMemo(() => {
    const map = new Map<string, RoomBlock[]>()
    visibleBlocks.forEach(b => map.set(b.room_id, [...(map.get(b.room_id) ?? []), b]))
    return map
  }, [visibleBlocks])

  // Gap detection
  useEffect(() => {
    const newGaps: typeof gaps = []
    visibleBeds.forEach((bed) => {
      const sorted = (resByBed.get(bed.id) ?? [])
        .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = differenceInCalendarDays(new Date(sorted[i + 1].check_in), new Date(sorted[i].check_out))
        if (gap > 2) {
          newGaps.push({ bedId: bed.id, startDate: sorted[i].check_out, endDate: sorted[i + 1].check_in, days: gap })
        }
      }
    })
    setGaps(newGaps)
  }, [visibleBeds, resByBed])

  // Metrics
  const metrics = useMemo(() => {
    const blockedNights = visibleBeds.reduce((sum, bed) => {
      const roomBlocks = blocksByRoom.get(bed.room.id) ?? []
      return sum + dates.filter(d =>
        roomBlocks.some(b => d >= parseISO(b.start_date) && d < parseISO(b.end_date))
      ).length
    }, 0)
    const sellable = Math.max(0, visibleBeds.length * rangeDays - blockedNights)
    const occupied = visibleReservations.reduce((sum, r) => {
      const from = parseISO(r.check_in) < startDate ? startDate : parseISO(r.check_in)
      const to = parseISO(r.check_out) > endDate ? endDate : parseISO(r.check_out)
      return sum + Math.max(0, differenceInCalendarDays(to, from))
    }, 0)
    return {
      occupancy: sellable ? Math.round((occupied / sellable) * 100) : 0,
      occupiedNights: occupied,
      blockedNights,
      revenue: visibleReservations.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
      arrivals: visibleReservations.filter(r => isSameDay(parseISO(r.check_in), new Date())).length,
      departures: visibleReservations.filter(r => isSameDay(parseISO(r.check_out), new Date())).length,
    }
  }, [visibleBeds, visibleReservations, blocksByRoom, dates, rangeDays, startDate, endDate])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  function openNewReservation(bed: Bed, date: Date) {
    const roomBlocks = blocksByRoom.get(bed.room.id) ?? []
    if (roomBlocks.some(b => date >= parseISO(b.start_date) && date < parseISO(b.end_date))) return
    setPreselectedBed(bed)
    setPreselectedDate(date)
    setNewReservationOpen(true)
  }

  async function updateReservationStatus(reservation: Reservation, nextStatus: string) {
    setUpdatingStatus(reservation.id)
    setError(null)
    const { error: err } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.id)
    if (err) setError(err.message)
    else {
      setSelectedReservation({ ...reservation, status: nextStatus })
      await loadData()
    }
    setUpdatingStatus(null)
  }

  const fillGap = useCallback(async (bedId: string, checkIn: string, checkOut: string, dailyRate: number) => {
    try {
      const r = await fetch("/api/bookings/revenue/auto-fill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bed_id: bedId, check_in: checkIn, check_out: checkOut, daily_rate: dailyRate }),
      })
      const result = await r.json()
      if (!r.ok) throw new Error(result.error)
      setSelectedGap(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error filling gap")
    }
  }, [loadData])

  // ─── Render ─────────────────────────────────────────────────────────────────
  const totalGridWidth = rangeDays * COL_WIDTH

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reservas</h1>
            <p className="text-sm text-muted-foreground">Calendario operativo con reservas y bloqueos de disponibilidad.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/bookings/blocks"><Ban className="mr-2 h-4 w-4" />Gestionar bloqueos</Link>
            </Button>
            <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}>
              <CalendarDays className="mr-2 h-4 w-4" />Hoy
            </Button>
            <Button onClick={() => { setPreselectedBed(null); setPreselectedDate(null); setNewReservationOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Nueva reserva
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Ocupación vendible" value={`${metrics.occupancy}%`} icon={<Users className="h-4 w-4" />} />
          <MetricCard title="Noches ocupadas" value={String(metrics.occupiedNights)} icon={<Moon className="h-4 w-4" />} />
          <MetricCard title="Noches bloqueadas" value={String(metrics.blockedNights)} icon={<Ban className="h-4 w-4" />} />
          <MetricCard title="Ingresos del rango" value={formatClp(metrics.revenue)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <MetricCard title="Llegadas hoy" value={String(metrics.arrivals)} icon={<LogIn className="h-4 w-4" />} />
          <MetricCard title="Salidas hoy" value={String(metrics.departures)} icon={<LogOut className="h-4 w-4" />} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar huésped, habitación o cama" />
            </div>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Propiedad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las propiedades</SelectItem>
                {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="confirmed">Confirmada</SelectItem>
                <SelectItem value="checked_in">Check-in</SelectItem>
                <SelectItem value="checked_out">Check-out</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
              <SelectTrigger className="w-full xl:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="14">14 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setShowHeatmap(v => !v)} title="Heatmap">
                <Moon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setShowOperations(v => !v)} title="Operaciones">
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadData}>Reintentar</Button>
          </div>
        )}

        {/* ─── Calendar grid ───────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3 px-4">
            <div>
              <CardTitle className="text-base">
                {format(startDate, "dd MMM", { locale: es })} — {format(addDays(endDate, -1), "dd MMM yyyy", { locale: es })}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {visibleBeds.length} unidades · {visibleReservations.length} reservas · {visibleBlocks.length} bloqueos
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setStartDate(d => addDays(d, -rangeDays))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setStartDate(d => addDays(d, rangeDays))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <div className="overflow-auto">
            {/* Outer wrapper keeps bed column frozen */}
            <div style={{ minWidth: BED_COL_W + totalGridWidth }}>

              {/* ── Date header row ── */}
              <div className="flex sticky top-0 z-20 bg-background border-b">
                {/* Frozen bed label header */}
                <div
                  className="sticky left-0 z-30 bg-background border-r shrink-0 flex items-center px-4 text-xs font-semibold text-muted-foreground"
                  style={{ width: BED_COL_W, minHeight: 48 }}
                >
                  Habitación / Cama
                </div>
                {/* Day headers */}
                {dates.map(date => (
                  <div
                    key={date.toISOString()}
                    className={`border-r shrink-0 text-center py-2 text-xs ${isSameDay(date, new Date()) ? "bg-amber-100 dark:bg-amber-900/30" : ""}`}
                    style={{ width: COL_WIDTH }}
                  >
                    <div className="text-muted-foreground">{format(date, "EEE", { locale: es })}</div>
                    <div className={`font-semibold ${isSameDay(date, new Date()) ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {format(date, "d MMM", { locale: es })}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Body ── */}
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Cargando calendario...</span>
                </div>
              ) : beds.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  No hay habitaciones o camas configuradas.
                </div>
              ) : visibleBeds.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  No hay unidades para los filtros seleccionados.
                </div>
              ) : (
                visibleBeds.map((bed, rowIdx) => {
                  const bedReservations = resByBed.get(bed.id) ?? []
                  const roomBlocks = blocksByRoom.get(bed.room.id) ?? []
                  const isEven = rowIdx % 2 === 0

                  return (
                    <div
                      key={bed.id}
                      className={`flex border-b ${isEven ? "bg-background" : "bg-muted/20"} hover:bg-muted/40 transition-colors`}
                      style={{ minHeight: ROW_HEIGHT }}
                    >
                      {/* Frozen bed label */}
                      <div
                        className="sticky left-0 z-10 border-r shrink-0 flex flex-col justify-center px-4 bg-inherit"
                        style={{ width: BED_COL_W }}
                      >
                        <div className="font-medium text-sm leading-tight">Hab. {bed.room.room_number}</div>
                        <div className="text-xs text-muted-foreground">{bed.bed_number} · {bed.bed_type}</div>
                        {bed.room.location_ref?.name && (
                          <div className="text-[10px] text-muted-foreground/60 truncate">{bed.room.location_ref.name}</div>
                        )}
                      </div>

                      {/* Grid area: relative container spanning all day columns */}
                      <div
                        className="relative shrink-0"
                        style={{ width: totalGridWidth, height: ROW_HEIGHT }}
                      >
                        {/* Day column grid lines + empty cell click targets */}
                        {dates.map((date, dayIdx) => {
                          const hasBlock = roomBlocks.some(b => date >= parseISO(b.start_date) && date < parseISO(b.end_date))
                          const hasRes = bedReservations.some(r => date >= parseISO(r.check_in) && date < parseISO(r.check_out))
                          return (
                            <div
                              key={date.toISOString()}
                              className={`absolute top-0 bottom-0 border-r ${isSameDay(date, new Date()) ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
                              style={{ left: dayIdx * COL_WIDTH, width: COL_WIDTH }}
                              onClick={() => !hasBlock && !hasRes && openNewReservation(bed, date)}
                            >
                              {!hasBlock && !hasRes && (
                                <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-40 transition-opacity cursor-pointer">
                                  <Plus className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Block bars */}
                        {roomBlocks.map(block => (
                          <BlockBar
                            key={block.id}
                            block={block}
                            startDate={startDate}
                            rangeDays={rangeDays}
                            onOpen={setSelectedBlock}
                          />
                        ))}

                        {/* Reservation bars */}
                        {bedReservations.map(res => (
                          <ReservationBar
                            key={res.id}
                            reservation={res}
                            startDate={startDate}
                            rangeDays={rangeDays}
                            onOpen={setSelectedReservation}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </Card>

        {/* Gaps summary */}
        {gaps.length > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
            {gaps.length} gap(s) detectado(s) — considere promociones de corta estancia
          </div>
        )}

        {/* Heatmap */}
        {showHeatmap && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OccupancyHeatmap reservations={reservations} totalBeds={visibleBeds.length} startDate={startDate} />
            {gaps.length > 0 && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">Gaps detectados ({gaps.length})</div>
                {gaps.map((gap, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedGap(gap)}
                    className="w-full text-left rounded border border-blue-500/30 bg-blue-500/10 p-2 text-xs hover:bg-blue-500/20 transition"
                  >
                    Cama {gap.bedId.slice(0, 8)}: {gap.startDate} → {gap.endDate} ({gap.days} noches)
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <GapFillerDialog
          open={selectedGap !== null}
          onOpenChange={open => !open && setSelectedGap(null)}
          gap={selectedGap}
          onFill={fillGap}
        />

        {showOperations && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <HousekeepingTimeline tasks={housekeepingTasks} onStatusChange={loadData} />
            <MaintenanceTimeline tasks={maintenanceTasks} />
            <RoomStateMatrix rooms={roomStates} />
          </div>
        )}
      </div>

      {/* ─── Dialogs ──────────────────────────────────────────────────────────── */}
      <AddReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        onSuccess={loadData}
        preselectedBed={preselectedBed?.id}
        preselectedDate={preselectedDate ?? undefined}
        preselectedLocation={preselectedBed?.room.location_ref?.name}
      />

      {/* Block detail */}
      <Dialog open={!!selectedBlock} onOpenChange={open => !open && setSelectedBlock(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bloqueo de habitación</DialogTitle></DialogHeader>
          {selectedBlock && (
            <div className="space-y-4">
              <Badge variant="secondary">{BLOCK_LABELS[selectedBlock.block_type] ?? selectedBlock.block_type}</Badge>
              <Detail label="Motivo" value={selectedBlock.reason} />
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Desde" value={selectedBlock.start_date} />
                <Detail label="Hasta" value={selectedBlock.end_date} />
              </div>
              {selectedBlock.notes && <Detail label="Notas" value={selectedBlock.notes} />}
              <Button asChild className="w-full">
                <Link href="/bookings/blocks">Administrar bloqueos</Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reservation detail */}
      <Dialog open={!!selectedReservation} onOpenChange={open => !open && setSelectedReservation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>
          {selectedReservation && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Huésped</p>
                  <p className="text-xl font-semibold">{selectedReservation.guest_name}</p>
                  {selectedReservation.guest_phone && (
                    <p className="text-sm text-muted-foreground">{selectedReservation.guest_phone}</p>
                  )}
                </div>
                <Badge>{STATUS_LABELS[selectedReservation.status] ?? selectedReservation.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Detail label="Check-in" value={selectedReservation.check_in} />
                <Detail label="Check-out" value={selectedReservation.check_out} />
                <Detail label="Huéspedes" value={String(selectedReservation.num_guests ?? 1)} />
                <Detail label="Total" value={formatClp(Number(selectedReservation.total_amount ?? 0))} />
              </div>
              {selectedReservation.special_requests && (
                <Detail label="Solicitudes especiales" value={selectedReservation.special_requests} />
              )}
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                {norm(selectedReservation.status) === "pending" && (
                  <StatusButton loading={updatingStatus === selectedReservation.id} label="Confirmar reserva" onClick={() => updateReservationStatus(selectedReservation, "confirmed")} />
                )}
                {norm(selectedReservation.status) === "confirmed" && (
                  <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-in" onClick={() => updateReservationStatus(selectedReservation, "checked_in")} />
                )}
                {norm(selectedReservation.status) === "checked_in" && (
                  <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-out" onClick={() => updateReservationStatus(selectedReservation, "checked_out")} />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function StatusButton({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={loading}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  )
}

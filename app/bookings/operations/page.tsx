"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns"
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ConciergeBell,
  DoorOpen,
  LogIn,
  LogOut,
  PackagePlus,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const LABEL_WIDTH = 330
const ZOOM_OPTIONS = [7, 14, 21, 30] as const

type Location = { id: string; name: string }
type Room = {
  id: string
  room_number: string
  room_type: string | null
  location_id: string
  operational_status: string
  location: Location | null
}
type Bed = { id: string; room_id: string; bed_number: string; bed_type: string | null; is_available: boolean; room: Room }
type Reservation = {
  id: string
  bed_id: string | null
  room_id: string | null
  location_id: string | null
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string
  arrival_status: string | null
  payment_status: string | null
  num_guests: number | null
  total_amount: number | null
  special_requests: string | null
  source: string | null
}
type RoomBlock = { id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; status: string }
type HousekeepingTask = { id: string; reservation_id: string | null; room_id: string | null; task_type: string; status: string; priority: string | null; notes: string | null; completed_at: string | null; created_at: string | null }
type HospitalityRequest = { id: string; reservation_id: string | null; room_id: string | null; tablet_device_id: string | null; guest_name: string | null; request_type: string; category: string; status: string; priority: string | null; description: string | null; created_at: string | null }
type ReservationExtra = { id: string; name: string; unit: string; quantity: number; unit_price: number; total_amount: number | null; notes: string | null; created_at: string }
type GuestRequest = { id: string; request_type: string; description: string; status: string | null; created_at: string | null }
type BookingIssue = { id: string; title: string | null; description: string | null; category: string | null; priority: string | null; severity: string | null; status: string | null; created_at: string | null }
type BookingExtra = { id: string; name: string; description: string | null; unit: string; price: number; tax_rate: number }
type BookingOperations = {
  summary: { openHospitality: number; openHousekeeping: number; openGuestRequests: number; openIssues: number; extrasCount: number; extrasAmount: number; totalOperations: number }
  extras: ReservationExtra[]
  guestRequests: GuestRequest[]
  issues: BookingIssue[]
  catalog: BookingExtra[]
}
type SelectedReservation = Reservation & { bed?: Bed }
type RoomGroup = { room: Room; beds: Bed[] }
type LocationGroup = { location: Location; rooms: RoomGroup[] }

const RESERVATION_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  waiting_for_room: "Esperando habitación",
  ready_for_checkin: "Lista para check-in",
  checked_in: "Alojado",
  "checked-in": "Alojado",
  checked_out: "Salida registrada",
  "checked-out": "Salida registrada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
}
const RESERVATION_STYLES: Record<string, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-950",
  confirmed: "border-blue-300 bg-blue-100 text-blue-950",
  waiting_for_room: "border-orange-300 bg-orange-100 text-orange-950",
  ready_for_checkin: "border-cyan-300 bg-cyan-100 text-cyan-950",
  checked_in: "border-emerald-300 bg-emerald-100 text-emerald-950",
  "checked-in": "border-emerald-300 bg-emerald-100 text-emerald-950",
  checked_out: "border-slate-300 bg-slate-100 text-slate-700",
  "checked-out": "border-slate-300 bg-slate-100 text-slate-700",
}
const ROOM_STATUS_LABELS: Record<string, string> = {
  ready: "Lista",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente inspección",
  inspected: "Inspeccionada",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}
const ROOM_STATUS_CLASSES: Record<string, string> = {
  ready: "border-emerald-300 bg-emerald-50 text-emerald-800",
  inspected: "border-emerald-300 bg-emerald-50 text-emerald-800",
  dirty: "border-rose-300 bg-rose-50 text-rose-800",
  cleaning: "border-sky-300 bg-sky-50 text-sky-800",
  clean_pending_inspection: "border-amber-300 bg-amber-50 text-amber-800",
  occupied: "border-violet-300 bg-violet-50 text-violet-800",
  out_of_service: "border-red-400 bg-red-50 text-red-900",
  out_of_inventory: "border-slate-400 bg-slate-100 text-slate-800",
}
const HOSPITALITY_STATUS_LABELS: Record<string, string> = { pending: "Pendiente", assigned: "Asignada", in_progress: "En curso", completed: "Completada", resolved: "Resuelta", cancelled: "Cancelada" }
const HOUSEKEEPING_STATUS_LABELS: Record<string, string> = { pending: "Pendiente", assigned: "Asignada", in_progress: "En curso", completed: "Completada", cancelled: "Cancelada" }
const HOUSEKEEPING_TYPE_LABELS: Record<string, string> = { turnover: "Limpieza de salida", room_preparation: "Preparación de habitación", inspection: "Inspección operativa", cleaning: "Limpieza", deep_cleaning: "Limpieza profunda" }

function iso(date: Date) { return format(date, "yyyy-MM-dd") }
function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }
function overlap(startA: string, endA: string, startB: Date, endB: Date) { return parseISO(startA) < endB && parseISO(endA) > startB }
function normalizeName(value: string | null | undefined) { return (value ?? "").trim().toLocaleLowerCase("es-CL") }
function roomReady(status: string | null | undefined) { return status === "ready" || status === "inspected" }

export default function BookingOperationsTimelinePage() {
  const supabase = useMemo(() => createClient(), [])
  const [rangeDays, setRangeDays] = useState<(typeof ZOOM_OPTIONS)[number]>(21)
  const dayWidth = rangeDays <= 7 ? 128 : rangeDays <= 14 ? 104 : rangeDays <= 21 ? 92 : 72
  const [startDate, setStartDate] = useState(startOfDay(new Date()))
  const endDate = useMemo(() => addDays(startDate, rangeDays), [rangeDays, startDate])
  const dates = useMemo(() => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)), [rangeDays, startDate])
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [housekeeping, setHousekeeping] = useState<HousekeepingTask[]>([])
  const [hospitality, setHospitality] = useState<HospitalityRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [locationId, setLocationId] = useState("all")
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<SelectedReservation | null>(null)
  const [operations, setOperations] = useState<BookingOperations | null>(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsError, setOperationsError] = useState<string | null>(null)
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false)
  const [preselectedBed, setPreselectedBed] = useState<Bed | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null)
  const [savingAction, setSavingAction] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [bedsResult, reservationsResult, blocksResult, housekeepingResult, hospitalityResult] = await Promise.all([
      supabase.from("beds").select("id, room_id, bed_number, bed_type, is_available, room:rooms!inner(id, room_number, room_type, location_id, operational_status, location:locations(id, name))").order("room_id").order("bed_number"),
      supabase.from("reservations").select("id, bed_id, room_id, location_id, guest_name, guest_email, guest_phone, check_in, check_out, status, arrival_status, payment_status, num_guests, total_amount, special_requests, source").lt("check_in", iso(endDate)).gt("check_out", iso(startDate)).not("status", "in", "(cancelled,canceled,void,voided)"),
      supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, status").eq("status", "active").lt("start_date", iso(endDate)).gt("end_date", iso(startDate)),
      supabase.from("housekeeping_tasks").select("id, reservation_id, room_id, task_type, status, priority, notes, completed_at, created_at").not("status", "in", "(completed,cancelled)"),
      supabase.from("hospitality_requests").select("id, reservation_id, room_id, tablet_device_id, guest_name, request_type, category, status, priority, description, created_at").not("status", "in", "(completed,resolved,cancelled)"),
    ])
    const firstError = bedsResult.error || reservationsResult.error || blocksResult.error || housekeepingResult.error || hospitalityResult.error
    if (firstError) setError(firstError.message)
    else {
      const nextBeds = (bedsResult.data ?? []) as unknown as Bed[]
      setBeds(nextBeds)
      setReservations((reservationsResult.data ?? []) as Reservation[])
      setBlocks((blocksResult.data ?? []) as RoomBlock[])
      setHousekeeping((housekeepingResult.data ?? []) as HousekeepingTask[])
      setHospitality((hospitalityResult.data ?? []) as HospitalityRequest[])
      setExpandedRooms((current) => current.size ? current : new Set(nextBeds.map((bed) => bed.room_id)))
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  const loadOperations = useCallback(async (reservationId: string) => {
    setOperationsLoading(true)
    setOperationsError(null)
    try {
      const response = await fetch(`/api/bookings/${reservationId}/operations`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar las operaciones de la reserva")
      setOperations(payload as BookingOperations)
    } catch (loadError) {
      setOperations(null)
      setOperationsError(loadError instanceof Error ? loadError.message : "No fue posible cargar las operaciones")
    } finally {
      setOperationsLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    if (!selected) { setOperations(null); setOperationsError(null); return }
    void loadOperations(selected.id)
  }, [loadOperations, selected])
  useEffect(() => {
    const channel = supabase.channel("booking-operations-timeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const locations = useMemo(() => Array.from(new Map(beds.filter((bed) => bed.room.location).map((bed) => [bed.room.location!.id, bed.room.location!])).values()).sort((a, b) => a.name.localeCompare(b.name)), [beds])
  const hierarchy = useMemo<LocationGroup[]>(() => {
    const term = search.trim().toLowerCase()
    const locationMap = new Map<string, LocationGroup>()
    beds.forEach((bed) => {
      const location = bed.room.location
      if (!location || (locationId !== "all" && location.id !== locationId)) return
      const haystack = `${location.name} ${bed.room.room_number} ${bed.room.room_type ?? ""} ${bed.bed_number} ${bed.bed_type ?? ""} ${ROOM_STATUS_LABELS[bed.room.operational_status] ?? bed.room.operational_status}`.toLowerCase()
      if (term && !haystack.includes(term)) return
      const locationGroup = locationMap.get(location.id) ?? { location, rooms: [] }
      let roomGroup = locationGroup.rooms.find((item) => item.room.id === bed.room_id)
      if (!roomGroup) { roomGroup = { room: bed.room, beds: [] }; locationGroup.rooms.push(roomGroup) }
      roomGroup.beds.push(bed)
      locationMap.set(location.id, locationGroup)
    })
    return Array.from(locationMap.values())
      .map((group) => ({ ...group, rooms: group.rooms.sort((a, b) => a.room.room_number.localeCompare(b.room.room_number)) }))
      .sort((a, b) => a.location.name.localeCompare(b.location.name))
  }, [beds, locationId, search])

  const reservationByBed = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach((item) => { if (item.bed_id) map.set(item.bed_id, [...(map.get(item.bed_id) ?? []), item]) })
    return map
  }, [reservations])
  const blocksByRoom = useMemo(() => {
    const map = new Map<string, RoomBlock[]>()
    blocks.forEach((item) => map.set(item.room_id, [...(map.get(item.room_id) ?? []), item]))
    return map
  }, [blocks])
  const hospitalityForReservation = useCallback((reservation: Reservation) => hospitality.filter((request) => request.reservation_id ? request.reservation_id === reservation.id : Boolean(request.room_id && reservation.room_id && request.room_id === reservation.room_id && normalizeName(request.guest_name) === normalizeName(reservation.guest_name))), [hospitality])
  const housekeepingForReservation = useCallback((reservation: Reservation) => housekeeping.filter((task) => task.reservation_id ? task.reservation_id === reservation.id : Boolean(task.room_id && reservation.room_id && task.room_id === reservation.room_id)), [housekeeping])
  const selectedHospitality = useMemo(() => selected ? hospitalityForReservation(selected) : [], [hospitalityForReservation, selected])
  const selectedHousekeeping = useMemo(() => selected ? housekeepingForReservation(selected) : [], [housekeepingForReservation, selected])
  const metrics = useMemo(() => {
    const today = iso(new Date())
    const uniqueRooms = Array.from(new Map(beds.map((bed) => [bed.room.id, bed.room])).values())
    return {
      arrivals: reservations.filter((item) => item.check_in === today).length,
      departures: reservations.filter((item) => item.check_out === today).length,
      occupied: reservations.filter((item) => item.check_in <= today && item.check_out > today).length,
      roomsNotReady: uniqueRooms.filter((room) => !roomReady(room.operational_status) && room.operational_status !== "occupied").length,
      pendingHousekeeping: housekeeping.length,
      pendingHospitality: hospitality.length,
    }
  }, [beds, housekeeping.length, hospitality.length, reservations])

  function geometry(start: string, end: string) {
    const visibleStart = parseISO(start) < startDate ? startDate : parseISO(start)
    const visibleEnd = parseISO(end) > endDate ? endDate : parseISO(end)
    return { left: differenceInCalendarDays(visibleStart, startDate) * dayWidth + 4, width: Math.max(36, differenceInCalendarDays(visibleEnd, visibleStart) * dayWidth - 8) }
  }
  function toggleRoom(roomId: string) {
    setExpandedRooms((current) => { const next = new Set(current); next.has(roomId) ? next.delete(roomId) : next.add(roomId); return next })
  }
  function openNewReservation(bed: Bed, date: Date) {
    const busy = (reservationByBed.get(bed.id) ?? []).some((item) => overlap(item.check_in, item.check_out, date, addDays(date, 1))) || (blocksByRoom.get(bed.room_id) ?? []).some((item) => overlap(item.start_date, item.end_date, date, addDays(date, 1)))
    if (busy) return
    setPreselectedBed(bed)
    setPreselectedDate(date)
    setReservationDialogOpen(true)
  }

  async function refreshSelected() {
    await loadData()
    if (selected) await loadOperations(selected.id)
  }
  async function setReservationStatus(status: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: updateError } = await supabase.from("reservations").update({ status }).eq("id", selected.id)
    if (updateError) toast.error(updateError.message)
    else { toast.success("Estado de reserva actualizado"); setSelected((current) => current ? { ...current, status } : current); await refreshSelected() }
    setSavingAction(false)
  }
  async function checkInOrQueue() {
    if (!selected) return
    setSavingAction(true)
    const { data, error: rpcError } = await supabase.rpc("check_in_or_queue", { p_reservation_id: selected.id })
    if (rpcError) toast.error(rpcError.message)
    else {
      const result = (data as { result?: string } | null)?.result
      if (result === "checked_in") {
        toast.success("Check-in registrado")
        setSelected((current) => current ? { ...current, status: "checked_in", arrival_status: "checked_in" } : current)
      } else {
        toast.warning("La habitación aún no está lista. La llegada quedó en cola.")
        setSelected((current) => current ? { ...current, status: "waiting_for_room", arrival_status: "waiting_for_room" } : current)
      }
      await refreshSelected()
    }
    setSavingAction(false)
  }
  async function setRoomStatus(status: string) {
    const roomId = selected?.bed?.room.id ?? selected?.room_id
    if (!roomId) return
    setSavingAction(true)
    const { error: rpcError } = await supabase.rpc("set_room_operational_status", { p_room_id: roomId, p_status: status })
    if (rpcError) toast.error(rpcError.message)
    else {
      toast.success("Estado operativo actualizado")
      setSelected((current) => current?.bed ? { ...current, bed: { ...current.bed, room: { ...current.bed.room, operational_status: status } } } : current)
      await refreshSelected()
    }
    setSavingAction(false)
  }
  async function createHousekeepingTask(taskType: string, notes: string) {
    if (!selected) return
    const roomId = selected.bed?.room_id ?? selected.room_id
    if (!roomId) return
    setSavingAction(true)
    const { error: insertError } = await supabase.from("housekeeping_tasks").insert({ reservation_id: selected.id, room_id: roomId, task_type: taskType, status: "pending", priority: taskType === "turnover" ? "high" : "medium", notes })
    if (insertError) toast.error(insertError.message)
    else { toast.success("Tarea de housekeeping creada"); await refreshSelected() }
    setSavingAction(false)
  }
  async function updateHousekeepingStatus(taskId: string, status: "in_progress" | "completed") {
    setSavingAction(true)
    const updates: { status: string; completed_at?: string } = { status }
    if (status === "completed") updates.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from("housekeeping_tasks").update(updates).eq("id", taskId)
    if (updateError) toast.error(updateError.message)
    else { toast.success(status === "completed" ? "Tarea completada" : "Tarea iniciada"); await refreshSelected() }
    setSavingAction(false)
  }
  async function createHospitalityRequest(requestType: string, description: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: insertError } = await supabase.from("hospitality_requests").insert({ reservation_id: selected.id, room_id: selected.bed?.room_id ?? selected.room_id, location_id: selected.bed?.room.location_id ?? selected.location_id, guest_name: selected.guest_name, guest_phone: selected.guest_phone, guest_email: selected.guest_email, request_type: requestType, category: "hospitality", description, priority: "medium", status: "pending" })
    if (insertError) toast.error(insertError.message)
    else { toast.success("Solicitud de hospitalidad creada"); await refreshSelected() }
    setSavingAction(false)
  }
  async function updateHospitalityStatus(requestId: string, status: "in_progress" | "completed") {
    setSavingAction(true)
    const updates: { status: string; completed_at?: string } = { status }
    if (status === "completed") updates.completed_at = new Date().toISOString()
    const { error: updateError } = await supabase.from("hospitality_requests").update(updates).eq("id", requestId)
    if (updateError) toast.error(updateError.message)
    else { toast.success(status === "completed" ? "Solicitud completada" : "Solicitud en curso"); await refreshSelected() }
    setSavingAction(false)
  }
  async function markPayment(status: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: updateError } = await supabase.from("reservations").update({ payment_status: status }).eq("id", selected.id)
    if (updateError) toast.error(updateError.message)
    else { toast.success("Estado de pago actualizado"); setSelected((current) => current ? { ...current, payment_status: status } : current); await loadData() }
    setSavingAction(false)
  }

  return (
    <AppLayout>
      <PageHeader title="Reservas y operación de hospitalidad" description="Timeline único por propiedad, habitación y cama para reservas, estado operativo, housekeeping, atención al huésped, pagos y bloqueos." actions={<Button onClick={() => setReservationDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nueva reserva</Button>} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={<LogIn />} label="Llegadas hoy" value={metrics.arrivals} />
          <Metric icon={<LogOut />} label="Salidas hoy" value={metrics.departures} />
          <Metric icon={<BedDouble />} label="Ocupadas hoy" value={metrics.occupied} />
          <Metric icon={<DoorOpen />} label="Habitaciones no listas" value={metrics.roomsNotReady} />
          <Metric icon={<Sparkles />} label="Limpiezas pendientes" value={metrics.pendingHousekeeping} />
          <Metric icon={<ConciergeBell />} label="Solicitudes abiertas" value={metrics.pendingHospitality} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}>Hoy</Button>
              <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
              <span className="ml-1 text-sm font-medium">{format(startDate, "dd MMM")} – {format(addDays(endDate, -1), "dd MMM yyyy")}</span>
              <div className="ml-2 flex rounded-md border p-1">{ZOOM_OPTIONS.map((days) => <Button key={days} size="sm" variant={rangeDays === days ? "secondary" : "ghost"} onClick={() => setRangeDays(days)}>{days}d</Button>)}</div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">Todas las propiedades</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
              <div className="relative min-w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar propiedad, habitación, cama o estado" className="pl-9" /></div>
              <Button variant="outline" size="icon" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">No fue posible cargar el timeline: {error}</div>}

        <Card className="overflow-hidden">
          <div className="overflow-auto">
            <div style={{ minWidth: LABEL_WIDTH + rangeDays * dayWidth }}>
              <div className="sticky top-0 z-30 flex border-b bg-background">
                <div className="sticky left-0 z-40 flex h-16 shrink-0 items-center border-r bg-background px-4 font-medium" style={{ width: LABEL_WIDTH }}>Propiedad / habitación / cama</div>
                <div className="flex">{dates.map((date) => { const today = iso(date) === iso(new Date()); return <div key={date.toISOString()} className={`flex h-16 shrink-0 flex-col items-center justify-center border-r text-xs ${today ? "bg-primary/10" : ""}`} style={{ width: dayWidth }}><span className="font-medium">{format(date, "EEE")}</span><span className={today ? "font-semibold text-primary" : "text-muted-foreground"}>{format(date, "dd MMM")}</span></div> })}</div>
              </div>

              {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Cargando operación…</div> : hierarchy.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">No hay habitaciones para los filtros seleccionados.</div> : hierarchy.map((locationGroup) => (
                <div key={locationGroup.location.id}>
                  <div className="sticky left-0 z-20 flex h-11 items-center border-b bg-muted/70 px-4 text-sm font-semibold" style={{ width: LABEL_WIDTH + rangeDays * dayWidth }}>{locationGroup.location.name}<Badge variant="outline" className="ml-2">{locationGroup.rooms.length} habitaciones</Badge></div>
                  {locationGroup.rooms.map((roomGroup) => {
                    const multi = roomGroup.beds.length > 1
                    const expanded = !multi || expandedRooms.has(roomGroup.room.id)
                    const roomHousekeeping = housekeeping.filter((task) => task.room_id === roomGroup.room.id)
                    const roomHospitality = hospitality.filter((request) => request.room_id === roomGroup.room.id)
                    const readinessClass = ROOM_STATUS_CLASSES[roomGroup.room.operational_status] ?? "border-border bg-muted text-muted-foreground"
                    return (
                      <div key={roomGroup.room.id}>
                        <div className="flex border-b bg-background">
                          <button type="button" onClick={() => multi && toggleRoom(roomGroup.room.id)} className="sticky left-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-r bg-background px-4 text-left" style={{ width: LABEL_WIDTH }}>
                            <div className="flex min-w-0 items-center gap-2">
                              {multi ? expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" /> : <BedDouble className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <div className="min-w-0"><p className="truncate text-sm font-semibold">{roomGroup.room.room_number}</p><p className="truncate text-xs text-muted-foreground">{roomGroup.room.room_type ?? "Sin tipo"} · {roomGroup.beds.length} {roomGroup.beds.length === 1 ? "cama" : "camas"}</p></div>
                            </div>
                            <div className="flex max-w-[145px] flex-wrap justify-end gap-1">
                              <Badge variant="outline" className={`text-[10px] ${readinessClass}`}>{ROOM_STATUS_LABELS[roomGroup.room.operational_status] ?? roomGroup.room.operational_status}</Badge>
                              {roomHousekeeping.length > 0 && <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{roomHousekeeping.length}</Badge>}
                              {roomHospitality.length > 0 && <Badge variant="secondary" className="gap-1"><ConciergeBell className="h-3 w-3" />{roomHospitality.length}</Badge>}
                            </div>
                          </button>
                          <div className={`relative h-16 ${roomReady(roomGroup.room.operational_status) ? "" : "bg-muted/25"}`} style={{ width: rangeDays * dayWidth }}>
                            {(blocksByRoom.get(roomGroup.room.id) ?? []).map((block) => <div key={block.id} className="absolute top-4 z-10 h-7 rounded border border-slate-400 bg-slate-200 px-2 text-xs leading-6 text-slate-800" style={geometry(block.start_date, block.end_date)}><span className="block truncate">Bloqueo · {block.reason}</span></div>)}
                          </div>
                        </div>

                        {expanded && roomGroup.beds.map((bed) => {
                          const bedReservations = reservationByBed.get(bed.id) ?? []
                          return (
                            <div key={bed.id} className="flex border-b">
                              <div className="sticky left-0 z-20 flex min-h-16 shrink-0 items-center border-r bg-background px-4 pl-10" style={{ width: LABEL_WIDTH }}><div><p className="text-sm font-medium">Cama {bed.bed_number}</p><p className="text-xs text-muted-foreground">{bed.bed_type ?? "Sin tipo"}</p></div></div>
                              <div className="relative min-h-16" style={{ width: rangeDays * dayWidth }}>
                                <div className="absolute inset-0 flex">{dates.map((date) => <button key={date.toISOString()} type="button" onClick={() => openNewReservation(bed, date)} className={`h-full shrink-0 border-r hover:bg-muted/60 ${iso(date) === iso(new Date()) ? "bg-primary/5" : ""}`} style={{ width: dayWidth }} aria-label={`Crear reserva en ${roomGroup.room.room_number}, cama ${bed.bed_number}, el ${iso(date)}`} />)}</div>
                                {bedReservations.map((reservation) => {
                                  const requestCount = hospitalityForReservation(reservation).length
                                  const housekeepingCount = housekeepingForReservation(reservation).length
                                  const arrivalState = reservation.arrival_status && ["waiting_for_room", "ready_for_checkin"].includes(reservation.arrival_status) ? reservation.arrival_status : reservation.status
                                  const readinessWarning = reservation.check_in === iso(new Date()) && !roomReady(roomGroup.room.operational_status) && reservation.status === "confirmed"
                                  return (
                                    <button key={reservation.id} type="button" onClick={() => setSelected({ ...reservation, bed })} className={`absolute bottom-2 z-20 flex h-10 items-center justify-between gap-2 overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow ${RESERVATION_STYLES[arrivalState] ?? RESERVATION_STYLES[reservation.status] ?? "border-violet-300 bg-violet-100 text-violet-950"}`} style={geometry(reservation.check_in, reservation.check_out)}>
                                      <span className="flex min-w-0 items-center gap-1 truncate font-semibold">{readinessWarning && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{reservation.guest_name}</span></span>
                                      <span className="flex shrink-0 items-center gap-1 opacity-80">{housekeepingCount > 0 && <span className="flex items-center gap-0.5 rounded bg-black/10 px-1.5 py-0.5"><Sparkles className="h-3 w-3" />{housekeepingCount}</span>}{requestCount > 0 && <span className="flex items-center gap-0.5 rounded bg-black/10 px-1.5 py-0.5"><ConciergeBell className="h-3 w-3" />{requestCount}</span>}<span>{reservation.num_guests ?? 1}p</span></span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <AddReservationDialog open={reservationDialogOpen} onOpenChange={setReservationDialogOpen} onSuccess={loadData} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedLocation={preselectedBed?.room.location?.name} />

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} aria-label="Cerrar panel" />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operación de estadía</p><h2 className="mt-1 text-xl font-semibold">{selected.guest_name}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.bed?.room.location?.name} · {selected.bed?.room.room_number} · Cama {selected.bed?.bed_number}</p></div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>{RESERVATION_LABELS[selected.arrival_status ?? selected.status] ?? RESERVATION_LABELS[selected.status] ?? selected.status}</Badge>
                <Badge variant="outline">Pago: {selected.payment_status ?? "sin registrar"}</Badge>
                <Badge variant="outline">Origen: {selected.source ?? "interno"}</Badge>
                {selected.bed?.room && <Badge variant="outline" className={ROOM_STATUS_CLASSES[selected.bed.room.operational_status] ?? ""}>{ROOM_STATUS_LABELS[selected.bed.room.operational_status] ?? selected.bed.room.operational_status}</Badge>}
                {selectedHousekeeping.length > 0 && <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{selectedHousekeeping.length} housekeeping</Badge>}
                {selectedHospitality.length > 0 && <Badge variant="secondary" className="gap-1"><ConciergeBell className="h-3 w-3" />{selectedHospitality.length} hospitality</Badge>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2"><Info label="Check-in" value={selected.check_in} /><Info label="Check-out" value={selected.check_out} /><Info label="Huéspedes" value={String(selected.num_guests ?? 1)} /><Info label="Monto" value={formatClp(Number(selected.total_amount ?? 0))} /></div>
              {selected.special_requests && <Info label="Solicitudes especiales" value={selected.special_requests} />}

              <ActionSection title="Preparación de habitación" icon={<DoorOpen className="h-4 w-4" />}>
                <div className="col-span-full rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Estado operativo actual</p><p className="mt-1 text-xs text-muted-foreground">El check-in solo se completa cuando la habitación está lista o inspeccionada.</p></div><Badge variant="outline" className={ROOM_STATUS_CLASSES[selected.bed?.room.operational_status ?? ""] ?? ""}>{ROOM_STATUS_LABELS[selected.bed?.room.operational_status ?? ""] ?? selected.bed?.room.operational_status ?? "Sin estado"}</Badge></div>
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void setRoomStatus("cleaning")} disabled={savingAction}>En limpieza</Button><Button size="sm" variant="outline" onClick={() => void setRoomStatus("clean_pending_inspection")} disabled={savingAction}>Pendiente inspección</Button><Button size="sm" onClick={() => void setRoomStatus("ready")} disabled={savingAction}><CheckCircle2 className="mr-2 h-4 w-4" />Marcar lista</Button></div>
                </div>
              </ActionSection>

              {operationsLoading && <Empty text="Cargando operaciones vinculadas…" />}
              {operationsError && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{operationsError}<Button size="sm" variant="outline" className="ml-3" onClick={() => void loadOperations(selected.id)}>Reintentar</Button></div>}
              {operations && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Info label="Operaciones" value={String(operations.summary.totalOperations)} /><Info label="Servicios / cargos" value={String(operations.summary.extrasCount)} /><Info label="Monto extras" value={formatClp(operations.summary.extrasAmount)} /></div>}

              <ActionSection title="Servicios y cargos" icon={<PackagePlus className="h-4 w-4" />}>{!operations || operations.extras.length === 0 ? <Empty text={operations?.catalog.length === 0 ? "No hay servicios cargados y el catálogo aún está vacío." : "No hay servicios cargados a esta reserva."} /> : operations.extras.map((extra) => <OperationCard key={extra.id} title={extra.name} subtitle={`${extra.quantity} ${extra.unit} × ${formatClp(Number(extra.unit_price))}`} status={formatClp(Number(extra.total_amount ?? extra.quantity * extra.unit_price))} description={extra.notes} actions={null} />)}</ActionSection>
              <ActionSection title="Solicitudes históricas del huésped" icon={<Users className="h-4 w-4" />}>{!operations || operations.guestRequests.length === 0 ? <Empty text="No hay solicitudes históricas vinculadas." /> : operations.guestRequests.map((request) => <OperationCard key={request.id} title={request.request_type} subtitle={request.created_at ? new Date(request.created_at).toLocaleString("es-CL") : "Sin fecha"} status={request.status ?? "sin estado"} description={request.description} actions={null} />)}</ActionSection>
              <ActionSection title="Incidencias vinculadas" icon={<AlertTriangle className="h-4 w-4" />}>{!operations || operations.issues.length === 0 ? <Empty text="No hay incidencias vinculadas a esta reserva." /> : operations.issues.map((issue) => <OperationCard key={issue.id} title={issue.title ?? issue.category ?? "Incidencia"} subtitle={`${issue.priority ?? issue.severity ?? "prioridad no registrada"}${issue.created_at ? ` · ${new Date(issue.created_at).toLocaleString("es-CL")}` : ""}`} status={issue.status ?? "sin estado"} description={issue.description} actions={null} />)}</ActionSection>

              <ActionSection title="Housekeeping activo" icon={<Sparkles className="h-4 w-4" />}>{selectedHousekeeping.length === 0 ? <Empty text="No hay tareas abiertas asociadas a esta reserva." /> : selectedHousekeeping.map((task) => <OperationCard key={task.id} title={HOUSEKEEPING_TYPE_LABELS[task.task_type] ?? task.task_type} subtitle={`${task.reservation_id ? "Vinculada a reserva" : "Histórica por habitación"} · Prioridad ${task.priority ?? "normal"}`} status={HOUSEKEEPING_STATUS_LABELS[task.status] ?? task.status} description={task.notes} actions={<>{task.status === "pending" && <Button size="sm" variant="outline" onClick={() => void updateHousekeepingStatus(task.id, "in_progress")} disabled={savingAction}><PlayCircle className="mr-2 h-4 w-4" />Iniciar</Button>}<Button size="sm" onClick={() => void updateHousekeepingStatus(task.id, "completed")} disabled={savingAction}><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button></>} />)}</ActionSection>
              <ActionSection title="Solicitudes activas de Hospitality" icon={<ConciergeBell className="h-4 w-4" />}>{selectedHospitality.length === 0 ? <Empty text="No hay solicitudes abiertas asociadas a esta reserva." /> : selectedHospitality.map((request) => <OperationCard key={request.id} title={request.request_type} subtitle={`${request.category} · ${request.tablet_device_id ? "Tablet de huésped" : "Registro interno"}`} status={HOSPITALITY_STATUS_LABELS[request.status] ?? request.status} description={request.description} actions={<>{request.status === "pending" && <Button size="sm" variant="outline" onClick={() => void updateHospitalityStatus(request.id, "in_progress")} disabled={savingAction}>Poner en curso</Button>}<Button size="sm" onClick={() => void updateHospitalityStatus(request.id, "completed")} disabled={savingAction}><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button></>} />)}</ActionSection>

              <ActionSection title="Reserva y estadía" icon={<CalendarDays className="h-4 w-4" />}>
                {selected.status === "pending" && <ActionButton icon={<CalendarDays />} label="Confirmar reserva" onClick={() => void setReservationStatus("confirmed")} disabled={savingAction} />}
                {["confirmed", "waiting_for_room", "ready_for_checkin"].includes(selected.status) && <ActionButton icon={<LogIn />} label={roomReady(selected.bed?.room.operational_status) ? "Registrar check-in" : "Registrar llegada y enviar a cola"} onClick={() => void checkInOrQueue()} disabled={savingAction} />}
                {["checked_in", "checked-in"].includes(selected.status) && <ActionButton icon={<LogOut />} label="Registrar check-out" onClick={() => void setReservationStatus("checked_out")} disabled={savingAction} />}
                <ActionButton icon={<CircleDollarSign />} label="Marcar pago recibido" onClick={() => void markPayment("paid")} disabled={savingAction} />
                <ActionButton icon={<CircleDollarSign />} label="Marcar pago pendiente" onClick={() => void markPayment("pending")} disabled={savingAction} />
              </ActionSection>

              <ActionSection title="Crear Housekeeping" icon={<Sparkles className="h-4 w-4" />}><ActionButton icon={<Sparkles />} label="Generar limpieza de salida" onClick={() => void createHousekeepingTask("turnover", `Limpieza posterior al check-out de ${selected.guest_name}, reserva ${selected.id}.`)} disabled={savingAction} /><ActionButton icon={<DoorOpen />} label="Preparar habitación" onClick={() => void createHousekeepingTask("room_preparation", `Preparar habitación para ${selected.guest_name}, reserva ${selected.id}.`)} disabled={savingAction} /><ActionButton icon={<Wrench />} label="Crear inspección operativa" onClick={() => void createHousekeepingTask("inspection", `Revisión operativa asociada a la reserva ${selected.id}.`)} disabled={savingAction} /></ActionSection>
              <ActionSection title="Crear Hospitality" icon={<ConciergeBell className="h-4 w-4" />}><ActionButton icon={<ConciergeBell />} label="Solicitud del huésped" onClick={() => void createHospitalityRequest("guest_request", `Solicitud operativa para ${selected.guest_name}, reserva ${selected.id}.`)} disabled={savingAction} /><ActionButton icon={<Users />} label="Recepción o traslado" onClick={() => void createHospitalityRequest("arrival_coordination", `Coordinar recepción o traslado de ${selected.guest_name} para el ${selected.check_in}.`)} disabled={savingAction} /><ActionButton icon={<BedDouble />} label="Amenidad o preparación especial" onClick={() => void createHospitalityRequest("room_amenity", `Preparación especial para ${selected.guest_name}. ${selected.special_requests ?? "Sin detalle adicional."}`)} disabled={savingAction} /></ActionSection>
            </div>
          </aside>
        </div>
      )}
    </AppLayout>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div></CardContent></Card> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
function Empty({ text }: { text: string }) { return <p className="col-span-full rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</p> }
function ActionSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section><div className="mb-3 flex items-center gap-2"><span className="text-primary">{icon}</span><h3 className="text-sm font-semibold">{title}</h3></div><div className="grid gap-2 sm:grid-cols-2">{children}</div></section> }
function ActionButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <Button type="button" variant="outline" className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left" onClick={onClick} disabled={disabled}><span className="mr-2 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</Button> }
function OperationCard({ title, subtitle, status, description, actions }: { title: string; subtitle: string; status: string; description: string | null; actions: React.ReactNode | null }) { return <div className="col-span-full rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div><Badge variant="outline">{status}</Badge></div>{description && <p className="mt-3 text-sm leading-6">{description}</p>}{actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}</div> }

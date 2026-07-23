"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { Ban, BedDouble, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Home, Loader2, LogIn, LogOut, Moon, Plus, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Location { id: string; name: string }
interface Bed {
  id: string
  bed_number: string
  bed_type: string
  room: { id: string; room_number: string; room_type?: string; location_id: string; location_ref?: { id: string; name: string } }
}
interface CalendarEvent {
  event_id: string
  event_type: "reservation" | "block"
  bed_id: string
  room_id: string
  location_id: string
  starts_on: string
  ends_on: string
  status: string
  label: string
  guest_name: string | null
  block_type: string | null
  source: string | null
  total_amount: number | null
}
interface Reservation {
  id: string; bed_id: string | null; guest_name: string; guest_email?: string | null; guest_phone?: string | null
  check_in: string; check_out: string; status: string; num_guests?: number | null; total_amount?: number | null; special_requests?: string | null
}
interface RoomBlock {
  id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; notes?: string | null; status: string
}

const DAY_WIDTH = 96
const LABEL_WIDTH = 272
const ROW_HEIGHT = 68

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-violet-600 text-white border-violet-700",
  checked_in: "bg-emerald-600 text-white border-emerald-700",
  "checked-in": "bg-emerald-600 text-white border-emerald-700",
  checked_out: "bg-slate-600 text-white border-slate-700",
  "checked-out": "bg-slate-600 text-white border-slate-700",
  pending: "bg-amber-500 text-white border-amber-600",
  cancelled: "bg-red-500 text-white border-red-600",
}
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmada", checked_in: "Check-in", "checked-in": "Check-in",
  checked_out: "Check-out", "checked-out": "Check-out", cancelled: "Cancelada",
}
const BLOCK_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento", owner_use: "Uso propietario", out_of_service: "Fuera de servicio", other: "Bloqueada",
}

function normalizedStatus(value: string) { return value.replaceAll("-", "_") }
function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

export default function BookingsCalendarPage() {
  const supabase = useMemo(() => createClient(), [])
  const [locations, setLocations] = useState<Location[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [locationId, setLocationId] = useState("all")
  const [status, setStatus] = useState("all")
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
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const [dropTargetBedId, setDropTargetBedId] = useState<string | null>(null)
  const [movingReservationId, setMovingReservationId] = useState<string | null>(null)

  const endDate = addDays(startDate, rangeDays)
  const dates = useMemo(() => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)), [rangeDays, startDate])
  const timelineWidth = rangeDays * DAY_WIDTH

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [bedsResult, eventsResult] = await Promise.all([
      supabase.from("beds").select(`id, bed_number, bed_type, room:rooms!inner(id, room_number, room_type, location_id, location_ref:locations!inner(id, name, is_active))`).eq("room.location_ref.is_active", true).order("room_id"),
      supabase.rpc("get_booking_inventory_events", {
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
        p_location_id: null,
      }),
    ])

    const firstError = bedsResult.error || eventsResult.error
    if (firstError) {
      setError(firstError.message)
    } else {
      const loadedBeds = (bedsResult.data ?? []) as unknown as Bed[]
      const lodgingLocations = Array.from(
        new Map(
          loadedBeds
            .filter((bed) => bed.room.location_ref)
            .map((bed) => [bed.room.location_ref!.id, { id: bed.room.location_ref!.id, name: bed.room.location_ref!.name }]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name))

      setLocations(lodgingLocations)
      setBeds(loadedBeds)
      setEvents((eventsResult.data ?? []) as CalendarEvent[])
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const channel = supabase.channel("bookings-calendar-v6")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const visibleBeds = useMemo(() => {
    const term = search.trim().toLowerCase()
    return beds.filter((bed) => {
      const propertyName = bed.room.location_ref?.name?.toLowerCase() ?? ""
      const matchesLocation = locationId === "all" || bed.room.location_id === locationId
      const matchesSearch = !term || propertyName.includes(term) || bed.room.room_number.toLowerCase().includes(term) || bed.bed_number.toLowerCase().includes(term) || bed.bed_type.toLowerCase().includes(term)
      return matchesLocation && matchesSearch
    })
  }, [beds, locationId, search])

  const visibleBedIds = useMemo(() => new Set(visibleBeds.map((bed) => bed.id)), [visibleBeds])
  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events.filter((event) => {
      const matchesBed = visibleBedIds.has(event.bed_id)
      const matchesStatus = event.event_type === "block" || status === "all" || normalizedStatus(event.status) === status
      const matchesSearch = !term || event.event_type === "block" || (event.guest_name ?? event.label).toLowerCase().includes(term)
      return matchesBed && matchesStatus && matchesSearch
    })
  }, [events, search, status, visibleBedIds])

  const visibleReservationEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "reservation"), [visibleEvents])
  const visibleBlockEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "block"), [visibleEvents])

  const eventsByBed = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    visibleEvents.forEach((event) => map.set(event.bed_id, [...(map.get(event.bed_id) ?? []), event]))
    return map
  }, [visibleEvents])

  function eventAt(bedId: string, date: Date, type: CalendarEvent["event_type"]) {
    return (eventsByBed.get(bedId) ?? []).find((event) => event.event_type === type && date >= parseISO(event.starts_on) && date < parseISO(event.ends_on))
  }

  function eventGeometry(event: CalendarEvent) {
    const eventStart = parseISO(event.starts_on) < startDate ? startDate : parseISO(event.starts_on)
    const eventEnd = parseISO(event.ends_on) > endDate ? endDate : parseISO(event.ends_on)
    const offsetDays = Math.max(0, differenceInCalendarDays(eventStart, startDate))
    const durationDays = Math.max(1, differenceInCalendarDays(eventEnd, eventStart))
    return {
      left: offsetDays * DAY_WIDTH + 4,
      width: Math.max(24, durationDays * DAY_WIDTH - 8),
    }
  }

  const metrics = useMemo(() => {
    const blockedNights = visibleBlockEvents.reduce((sum, event) => {
      const from = parseISO(event.starts_on) < startDate ? startDate : parseISO(event.starts_on)
      const to = parseISO(event.ends_on) > endDate ? endDate : parseISO(event.ends_on)
      return sum + Math.max(0, differenceInCalendarDays(to, from))
    }, 0)
    const occupiedNights = visibleReservationEvents.reduce((sum, event) => {
      const from = parseISO(event.starts_on) < startDate ? startDate : parseISO(event.starts_on)
      const to = parseISO(event.ends_on) > endDate ? endDate : parseISO(event.ends_on)
      return sum + Math.max(0, differenceInCalendarDays(to, from))
    }, 0)
    const uniqueReservations = Array.from(new Map(visibleReservationEvents.map((event) => [event.event_id, event])).values())
    const sellableNights = Math.max(0, visibleBeds.length * rangeDays - blockedNights)

    return {
      occupancy: sellableNights ? Math.round((occupiedNights / sellableNights) * 100) : 0,
      occupiedNights,
      blockedNights,
      revenue: uniqueReservations.reduce((sum, event) => sum + Number(event.total_amount ?? 0), 0),
      arrivals: uniqueReservations.filter((event) => isSameDay(parseISO(event.starts_on), new Date())).length,
      departures: uniqueReservations.filter((event) => isSameDay(parseISO(event.ends_on), new Date())).length,
      reservations: uniqueReservations.length,
      blocks: new Set(visibleBlockEvents.map((event) => event.event_id)).size,
    }
  }, [endDate, rangeDays, startDate, visibleBeds, visibleBlockEvents, visibleReservationEvents])

  function openNewReservation(bed: Bed, date: Date) {
    if (eventAt(bed.id, date, "block") || eventAt(bed.id, date, "reservation")) return
    setPreselectedBed(bed)
    setPreselectedDate(date)
    setNewReservationOpen(true)
  }

  function openReservationFromTimeline(bed: Bed, clientX: number, currentTarget: HTMLDivElement) {
    if (draggingEventId) return
    const rect = currentTarget.getBoundingClientRect()
    const offset = Math.max(0, Math.min(timelineWidth - 1, clientX - rect.left))
    const dayIndex = Math.floor(offset / DAY_WIDTH)
    openNewReservation(bed, addDays(startDate, dayIndex))
  }

  function beginReservationDrag(event: CalendarEvent, transfer: DataTransfer) {
    transfer.effectAllowed = "move"
    transfer.setData("text/plain", event.event_id)
    setDraggingEventId(event.event_id)
  }

  function finishReservationDrag() {
    setDraggingEventId(null)
    setDropTargetBedId(null)
  }

  async function moveReservationToBed(targetBed: Bed) {
    const draggedEvent = events.find((event) => event.event_id === draggingEventId && event.event_type === "reservation")
    if (!draggedEvent || draggedEvent.bed_id === targetBed.id || movingReservationId) {
      finishReservationDrag()
      return
    }

    setMovingReservationId(draggedEvent.event_id)
    setError(null)

    const { data: available, error: availabilityError } = await supabase.rpc("is_booking_inventory_available", {
      p_bed_id: targetBed.id,
      p_room_id: targetBed.room.id,
      p_location_id: targetBed.room.location_id,
      p_check_in: draggedEvent.starts_on,
      p_check_out: draggedEvent.ends_on,
      p_exclude_reservation_id: draggedEvent.event_id,
    })

    if (availabilityError) {
      setError(availabilityError.message)
      toast.error("No fue posible validar la disponibilidad")
      setMovingReservationId(null)
      finishReservationDrag()
      return
    }

    if (!available) {
      toast.error("La cama seleccionada no está disponible para esas fechas")
      setMovingReservationId(null)
      finishReservationDrag()
      return
    }

    const previousEvents = events
    setEvents((current) => current.map((event) => event.event_id === draggedEvent.event_id && event.event_type === "reservation"
      ? { ...event, bed_id: targetBed.id, room_id: targetBed.room.id, location_id: targetBed.room.location_id }
      : event))

    const { error: updateError } = await supabase.from("reservations").update({
      bed_id: targetBed.id,
      room_id: targetBed.room.id,
      location_id: targetBed.room.location_id,
      booking_type: "BED",
    }).eq("id", draggedEvent.event_id)

    if (updateError) {
      setEvents(previousEvents)
      setError(updateError.message)
      toast.error("El movimiento fue rechazado y se restauró la reserva")
    } else {
      toast.success(`Reserva movida a Hab. ${targetBed.room.room_number} · ${targetBed.bed_number}`)
      await loadData()
    }

    setMovingReservationId(null)
    finishReservationDrag()
  }

  async function openReservation(event: CalendarEvent) {
    setError(null)
    const { data, error: detailError } = await supabase.from("reservations")
      .select("id, bed_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests, total_amount, special_requests")
      .eq("id", event.event_id)
      .single()

    if (detailError) {
      setError(detailError.message)
      return
    }
    setSelectedReservation(data as Reservation)
  }

  async function openBlock(event: CalendarEvent) {
    setError(null)
    const { data, error: detailError } = await supabase.from("room_blocks")
      .select("id, room_id, start_date, end_date, block_type, reason, notes, status")
      .eq("id", event.event_id)
      .single()

    if (detailError) {
      setError(detailError.message)
      return
    }
    setSelectedBlock(data as RoomBlock)
  }

  async function updateReservationStatus(reservation: Reservation, nextStatus: string) {
    setUpdatingStatus(reservation.id)
    setError(null)
    const { error: updateError } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.id)
    if (updateError) setError(updateError.message)
    else {
      setSelectedReservation({ ...reservation, status: nextStatus })
      await loadData()
    }
    setUpdatingStatus(null)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Hospitalidad · Fundo Corcovado</p>
            <h1 className="text-3xl font-semibold tracking-tight">Reservas y disponibilidad</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Timeline operativo conectado al Availability Engine. Arrastra una reserva hacia otra cama para reasignarla con validación automática.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/bookings/blocks"><Ban className="mr-2 h-4 w-4" />Gestionar bloqueos</Link></Button>
            <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}><CalendarDays className="mr-2 h-4 w-4" />Hoy</Button>
            <Button onClick={() => { setPreselectedBed(null); setPreselectedDate(null); setNewReservationOpen(true) }}><Plus className="mr-2 h-4 w-4" />Nueva reserva</Button>
          </div>
        </div>

        <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <ContextMetric icon={<Home className="h-4 w-4" />} label="Propiedades hospedables" value={String(locations.length)} detail="Ubicaciones con camas configuradas" />
          <ContextMetric icon={<BedDouble className="h-4 w-4" />} label="Camas registradas" value={String(beds.length)} detail="Capacidad física registrada en el sistema" />
          <ContextMetric icon={<Users className="h-4 w-4" />} label="Reservas del rango" value={String(metrics.reservations)} detail="Reservas únicas desde el motor de disponibilidad" />
        </CardContent></Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric title="Ocupación disponible" value={`${metrics.occupancy}%`} icon={<Users className="h-4 w-4" />} />
          <Metric title="Noches ocupadas" value={String(metrics.occupiedNights)} icon={<Moon className="h-4 w-4" />} />
          <Metric title="Noches bloqueadas" value={String(metrics.blockedNights)} icon={<Ban className="h-4 w-4" />} />
          <Metric title="Monto registrado" value={formatClp(metrics.revenue)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <Metric title="Llegadas hoy" value={String(metrics.arrivals)} icon={<LogIn className="h-4 w-4" />} />
          <Metric title="Salidas hoy" value={String(metrics.departures)} icon={<LogOut className="h-4 w-4" />} />
        </div>

        <Card><CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar huésped, propiedad, habitación o cama" /></div>
          <Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Alojamiento" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los alojamientos</SelectItem>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="confirmed">Confirmada</SelectItem><SelectItem value="checked_in">Check-in</SelectItem><SelectItem value="checked_out">Check-out</SelectItem></SelectContent></Select>
          <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}><SelectTrigger className="w-full xl:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 días</SelectItem><SelectItem value="14">14 días</SelectItem><SelectItem value="30">30 días</SelectItem></SelectContent></Select>
        </CardContent></Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">No fue posible cargar o actualizar la disponibilidad: {error}</div>}

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <div><CardTitle className="text-base">{format(startDate, "dd MMM")} — {format(addDays(endDate, -1), "dd MMM yyyy")}</CardTitle><p className="text-xs text-muted-foreground">{visibleBeds.length} camas visibles · {metrics.blocks} bloqueos activos · clic en un espacio libre para reservar · arrastra una reserva para cambiarla de cama</p></div>
            <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -rangeDays))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, rangeDays))}><ChevronRight className="h-4 w-4" /></Button></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
                <div className="sticky top-0 z-30 flex border-b bg-background">
                  <div className="sticky left-0 z-40 flex shrink-0 items-center border-r bg-background px-4 font-medium" style={{ width: LABEL_WIDTH, height: 58 }}>Propiedad / habitación / cama</div>
                  <div className="grid" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${rangeDays}, ${DAY_WIDTH}px)` }}>
                    {dates.map((date) => <div key={date.toISOString()} className={`flex flex-col items-center justify-center border-r text-center ${isSameDay(date, new Date()) ? "bg-amber-100" : ""}`} style={{ height: 58 }}><div className="text-xs text-muted-foreground">{format(date, "EEE")}</div><div className="font-semibold">{format(date, "dd MMM")}</div></div>)}
                  </div>
                </div>

                {loading ? <div className="p-12 text-center text-muted-foreground">Cargando Availability Engine…</div> : visibleBeds.length === 0 ? <div className="p-12 text-center text-muted-foreground">No hay camas para los filtros seleccionados.</div> : visibleBeds.map((bed) => {
                  const bedEvents = eventsByBed.get(bed.id) ?? []
                  const isDropTarget = dropTargetBedId === bed.id && !!draggingEventId
                  return <div
                    key={bed.id}
                    className={`flex border-b transition ${isDropTarget ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500" : "hover:bg-muted/20"}`}
                    style={{ height: ROW_HEIGHT }}
                    onDragOver={(dragEvent) => {
                      if (!draggingEventId) return
                      dragEvent.preventDefault()
                      dragEvent.dataTransfer.dropEffect = "move"
                    }}
                    onDragEnter={() => draggingEventId && setDropTargetBedId(bed.id)}
                    onDragLeave={(dragEvent) => {
                      if (!dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)) setDropTargetBedId(null)
                    }}
                    onDrop={(dropEvent) => {
                      dropEvent.preventDefault()
                      void moveReservationToBed(bed)
                    }}
                  >
                    <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r bg-background px-4" style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}>
                      <div className="truncate font-medium">{bed.room.location_ref?.name ?? "Sin propiedad"}</div>
                      <div className="truncate text-xs text-muted-foreground">Hab. {bed.room.room_number} · {bed.bed_number} · {bed.bed_type}</div>
                    </div>
                    <div
                      className="relative cursor-crosshair"
                      style={{ width: timelineWidth, height: ROW_HEIGHT, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH}px)` }}
                      onClick={(clickEvent) => openReservationFromTimeline(bed, clickEvent.clientX, clickEvent.currentTarget)}
                    >
                      {dates.map((date, index) => isSameDay(date, new Date()) ? <div key={`today-${bed.id}-${index}`} className="pointer-events-none absolute inset-y-0 bg-amber-50/70" style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }} /> : null)}
                      {bedEvents.map((event) => {
                        const geometry = eventGeometry(event)
                        const isBlock = event.event_type === "block"
                        const isMoving = movingReservationId === event.event_id
                        return <button
                          key={`${event.event_type}-${event.event_id}-${bed.id}`}
                          type="button"
                          draggable={!isBlock && !movingReservationId}
                          onDragStart={(dragEvent) => !isBlock && beginReservationDrag(event, dragEvent.dataTransfer)}
                          onDragEnd={finishReservationDrag}
                          onClick={(buttonEvent) => {
                            buttonEvent.stopPropagation()
                            if (draggingEventId) return
                            if (isBlock) void openBlock(event)
                            else void openReservation(event)
                          }}
                          className={`absolute top-2 h-[52px] overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary ${isBlock ? "border-zinc-500 bg-zinc-800 text-white" : `${STATUS_STYLES[event.status] ?? "bg-slate-200 text-slate-900"} cursor-grab active:cursor-grabbing`} ${draggingEventId === event.event_id ? "opacity-40" : ""}`}
                          style={{ left: geometry.left, width: geometry.width }}
                          title={isBlock ? `${event.label} · ${event.starts_on} → ${event.ends_on}` : `Arrastra para cambiar de cama · ${event.guest_name ?? event.label} · ${event.starts_on} → ${event.ends_on}`}
                        >
                          <div className="truncate font-semibold">{isMoving ? "Validando movimiento…" : isBlock ? BLOCK_LABELS[event.block_type ?? "other"] ?? "Bloqueada" : event.guest_name ?? event.label}</div>
                          <div className="truncate opacity-80">{isBlock ? event.label : `${STATUS_LABELS[event.status] ?? event.status} · ${event.starts_on} → ${event.ends_on}`}</div>
                        </button>
                      })}
                    </div>
                  </div>
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddReservationDialog open={newReservationOpen} onOpenChange={setNewReservationOpen} onSuccess={loadData} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedLocation={preselectedBed?.room.location_ref?.name} />
      <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}><DialogContent><DialogHeader><DialogTitle>Bloqueo de habitación</DialogTitle></DialogHeader>{selectedBlock && <div className="space-y-4"><Badge variant="secondary">{BLOCK_LABELS[selectedBlock.block_type] ?? selectedBlock.block_type}</Badge><Detail label="Motivo" value={selectedBlock.reason} /><div className="grid grid-cols-2 gap-4"><Detail label="Desde" value={selectedBlock.start_date} /><Detail label="Hasta" value={selectedBlock.end_date} /></div>{selectedBlock.notes && <Detail label="Notas" value={selectedBlock.notes} />}<Button asChild className="w-full"><Link href="/bookings/blocks">Administrar bloqueos</Link></Button></div>}</DialogContent></Dialog>
      <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>{selectedReservation && <div className="space-y-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Huésped</p><p className="text-xl font-semibold">{selectedReservation.guest_name}</p></div><Badge>{STATUS_LABELS[selectedReservation.status] ?? selectedReservation.status}</Badge></div><div className="grid grid-cols-2 gap-4 text-sm"><Detail label="Check-in" value={selectedReservation.check_in} /><Detail label="Check-out" value={selectedReservation.check_out} /><Detail label="Huéspedes" value={String(selectedReservation.num_guests ?? 1)} /><Detail label="Monto registrado" value={formatClp(Number(selectedReservation.total_amount ?? 0))} /></div>{selectedReservation.special_requests && <Detail label="Solicitudes especiales" value={selectedReservation.special_requests} />}<div className="flex flex-wrap justify-end gap-2 border-t pt-4">{normalizedStatus(selectedReservation.status) === "pending" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Confirmar reserva" onClick={() => updateReservationStatus(selectedReservation, "confirmed")} />}{normalizedStatus(selectedReservation.status) === "confirmed" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-in" onClick={() => updateReservationStatus(selectedReservation, "checked_in")} />}{normalizedStatus(selectedReservation.status) === "checked_in" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-out" onClick={() => updateReservationStatus(selectedReservation, "checked_out")} />}</div></div>}</DialogContent></Dialog>
    </div>
  )
}

function ContextMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 text-primary">{icon}</div><div><p className="text-sm font-medium">{label}</p><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>
}
function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card> }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div> }
function StatusButton({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) { return <Button onClick={onClick} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{label}</Button> }

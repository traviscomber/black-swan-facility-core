"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns"
import {
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ConciergeBell,
  DoorOpen,
  LogIn,
  LogOut,
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

const DAY_WIDTH = 92
const LABEL_WIDTH = 290
const RANGE_DAYS = 21

type Location = { id: string; name: string }
type Room = { id: string; room_number: string; room_type: string | null; location_id: string; location: Location | null }
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
  payment_status: string | null
  num_guests: number | null
  total_amount: number | null
  special_requests: string | null
  source: string | null
}
type RoomBlock = { id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; status: string }
type HousekeepingTask = { id: string; room_id: string; task_type: string; status: string; priority: string | null; notes: string | null }
type HospitalityRequest = { id: string; room_id: string | null; guest_name: string | null; request_type: string; status: string; priority: string | null; description: string }

type SelectedReservation = Reservation & { bed?: Bed }

const RESERVATION_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
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
  checked_in: "border-emerald-300 bg-emerald-100 text-emerald-950",
  "checked-in": "border-emerald-300 bg-emerald-100 text-emerald-950",
  checked_out: "border-slate-300 bg-slate-100 text-slate-700",
  "checked-out": "border-slate-300 bg-slate-100 text-slate-700",
}

function iso(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

function overlap(startA: string, endA: string, startB: Date, endB: Date) {
  return parseISO(startA) < endB && parseISO(endA) > startB
}

export default function BookingOperationsTimelinePage() {
  const supabase = useMemo(() => createClient(), [])
  const [startDate, setStartDate] = useState(startOfDay(new Date()))
  const endDate = useMemo(() => addDays(startDate, RANGE_DAYS), [startDate])
  const dates = useMemo(() => Array.from({ length: RANGE_DAYS }, (_, index) => addDays(startDate, index)), [startDate])
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [housekeeping, setHousekeeping] = useState<HousekeepingTask[]>([])
  const [hospitality, setHospitality] = useState<HospitalityRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [locationId, setLocationId] = useState("all")
  const [selected, setSelected] = useState<SelectedReservation | null>(null)
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false)
  const [preselectedBed, setPreselectedBed] = useState<Bed | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null)
  const [savingAction, setSavingAction] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [bedsResult, reservationsResult, blocksResult, housekeepingResult, hospitalityResult] = await Promise.all([
      supabase
        .from("beds")
        .select("id, room_id, bed_number, bed_type, is_available, room:rooms!inner(id, room_number, room_type, location_id, location:locations(id, name))")
        .order("room_id")
        .order("bed_number"),
      supabase
        .from("reservations")
        .select("id, bed_id, room_id, location_id, guest_name, guest_email, guest_phone, check_in, check_out, status, payment_status, num_guests, total_amount, special_requests, source")
        .lt("check_in", iso(endDate))
        .gt("check_out", iso(startDate))
        .not("status", "in", "(cancelled,canceled,void,voided)"),
      supabase
        .from("room_blocks")
        .select("id, room_id, start_date, end_date, block_type, reason, status")
        .eq("status", "active")
        .lt("start_date", iso(endDate))
        .gt("end_date", iso(startDate)),
      supabase.from("housekeeping_tasks").select("id, room_id, task_type, status, priority, notes").not("status", "in", "(completed,cancelled)"),
      supabase.from("hospitality_requests").select("id, room_id, guest_name, request_type, status, priority, description").not("status", "in", "(completed,resolved,cancelled)"),
    ])

    const firstError = bedsResult.error || reservationsResult.error || blocksResult.error || housekeepingResult.error || hospitalityResult.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setBeds((bedsResult.data ?? []) as unknown as Bed[])
      setReservations((reservationsResult.data ?? []) as Reservation[])
      setBlocks((blocksResult.data ?? []) as RoomBlock[])
      setHousekeeping((housekeepingResult.data ?? []) as HousekeepingTask[])
      setHospitality((hospitalityResult.data ?? []) as HospitalityRequest[])
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel("booking-operations-timeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void loadData())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadData, supabase])

  const locations = useMemo(() => {
    return Array.from(
      new Map(
        beds
          .filter((bed) => bed.room.location)
          .map((bed) => [bed.room.location!.id, bed.room.location!]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name))
  }, [beds])

  const visibleBeds = useMemo(() => {
    const term = search.trim().toLowerCase()
    return beds.filter((bed) => {
      const matchesLocation = locationId === "all" || bed.room.location_id === locationId
      const haystack = `${bed.room.location?.name ?? ""} ${bed.room.room_number} ${bed.bed_number} ${bed.bed_type ?? ""}`.toLowerCase()
      return matchesLocation && (!term || haystack.includes(term))
    })
  }, [beds, locationId, search])

  const reservationByBed = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach((reservation) => {
      if (!reservation.bed_id) return
      map.set(reservation.bed_id, [...(map.get(reservation.bed_id) ?? []), reservation])
    })
    return map
  }, [reservations])

  const blocksByRoom = useMemo(() => {
    const map = new Map<string, RoomBlock[]>()
    blocks.forEach((block) => map.set(block.room_id, [...(map.get(block.room_id) ?? []), block]))
    return map
  }, [blocks])

  const metrics = useMemo(() => {
    const today = iso(new Date())
    const arrivals = reservations.filter((item) => item.check_in === today).length
    const departures = reservations.filter((item) => item.check_out === today).length
    const occupied = reservations.filter((item) => item.check_in <= today && item.check_out > today).length
    const pendingHousekeeping = housekeeping.length
    const pendingHospitality = hospitality.length
    const revenue = reservations.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)
    return { arrivals, departures, occupied, pendingHousekeeping, pendingHospitality, revenue }
  }, [housekeeping.length, hospitality.length, reservations])

  function reservationGeometry(reservation: Reservation) {
    const visibleStart = parseISO(reservation.check_in) < startDate ? startDate : parseISO(reservation.check_in)
    const visibleEnd = parseISO(reservation.check_out) > endDate ? endDate : parseISO(reservation.check_out)
    const left = differenceInCalendarDays(visibleStart, startDate) * DAY_WIDTH + 4
    const width = Math.max(36, differenceInCalendarDays(visibleEnd, visibleStart) * DAY_WIDTH - 8)
    return { left, width }
  }

  function blockGeometry(block: RoomBlock) {
    const visibleStart = parseISO(block.start_date) < startDate ? startDate : parseISO(block.start_date)
    const visibleEnd = parseISO(block.end_date) > endDate ? endDate : parseISO(block.end_date)
    const left = differenceInCalendarDays(visibleStart, startDate) * DAY_WIDTH + 4
    const width = Math.max(36, differenceInCalendarDays(visibleEnd, visibleStart) * DAY_WIDTH - 8)
    return { left, width }
  }

  function openNewReservation(bed: Bed, date: Date) {
    const hasReservation = (reservationByBed.get(bed.id) ?? []).some((item) => overlap(item.check_in, item.check_out, date, addDays(date, 1)))
    const hasBlock = (blocksByRoom.get(bed.room_id) ?? []).some((item) => overlap(item.start_date, item.end_date, date, addDays(date, 1)))
    if (hasReservation || hasBlock) return
    setPreselectedBed(bed)
    setPreselectedDate(date)
    setReservationDialogOpen(true)
  }

  async function setReservationStatus(status: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: updateError } = await supabase.from("reservations").update({ status }).eq("id", selected.id)
    if (updateError) toast.error(updateError.message)
    else {
      toast.success("Estado de reserva actualizado")
      setSelected((current) => current ? { ...current, status } : current)
      await loadData()
    }
    setSavingAction(false)
  }

  async function createHousekeepingTask(taskType: string, notes: string) {
    if (!selected?.bed?.room_id) return
    setSavingAction(true)
    const { error: insertError } = await supabase.from("housekeeping_tasks").insert({
      room_id: selected.bed.room_id,
      task_type: taskType,
      status: "pending",
      priority: taskType === "turnover" ? "high" : "medium",
      notes,
    })
    if (insertError) toast.error(insertError.message)
    else {
      toast.success("Tarea de housekeeping creada")
      await loadData()
    }
    setSavingAction(false)
  }

  async function createHospitalityRequest(requestType: string, description: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: insertError } = await supabase.from("hospitality_requests").insert({
      room_id: selected.bed?.room_id ?? selected.room_id,
      location_id: selected.bed?.room.location_id ?? selected.location_id,
      guest_name: selected.guest_name,
      guest_phone: selected.guest_phone,
      guest_email: selected.guest_email,
      request_type: requestType,
      category: "hospitality",
      description,
      priority: "medium",
      status: "pending",
    })
    if (insertError) toast.error(insertError.message)
    else {
      toast.success("Solicitud de hospitalidad creada")
      await loadData()
    }
    setSavingAction(false)
  }

  async function markPayment(status: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: updateError } = await supabase.from("reservations").update({ payment_status: status }).eq("id", selected.id)
    if (updateError) toast.error(updateError.message)
    else {
      toast.success("Estado de pago actualizado")
      setSelected((current) => current ? { ...current, payment_status: status } : current)
      await loadData()
    }
    setSavingAction(false)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Reservas y operación de hospitalidad"
        description="Timeline único para reservas, ocupación, housekeeping, atención al huésped, pagos y bloqueos del Fundo Corcovado."
        actions={<Button onClick={() => setReservationDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nueva reserva</Button>}
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={<LogIn />} label="Llegadas hoy" value={metrics.arrivals} />
          <Metric icon={<LogOut />} label="Salidas hoy" value={metrics.departures} />
          <Metric icon={<BedDouble />} label="Ocupadas hoy" value={metrics.occupied} />
          <Metric icon={<Sparkles />} label="Limpiezas pendientes" value={metrics.pendingHousekeeping} />
          <Metric icon={<ConciergeBell />} label="Solicitudes abiertas" value={metrics.pendingHospitality} />
          <Metric icon={<CircleDollarSign />} label="Monto del rango" value={formatClp(metrics.revenue)} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}>Hoy</Button>
              <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
              <div className="ml-1 text-sm font-medium">{format(startDate, "dd MMM")} – {format(addDays(endDate, -1), "dd MMM yyyy")}</div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="all">Todas las ubicaciones</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <div className="relative min-w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar habitación o cama" className="pl-9" /></div>
              <Button variant="outline" size="icon" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">No fue posible cargar el timeline: {error}</div>}

        <Card className="overflow-hidden">
          <div className="overflow-auto">
            <div style={{ minWidth: LABEL_WIDTH + RANGE_DAYS * DAY_WIDTH }}>
              <div className="sticky top-0 z-30 flex border-b bg-background">
                <div className="sticky left-0 z-40 flex h-16 shrink-0 items-center border-r bg-background px-4 font-medium" style={{ width: LABEL_WIDTH }}>Habitación / cama</div>
                <div className="flex">
                  {dates.map((date) => {
                    const today = iso(date) === iso(new Date())
                    return <div key={date.toISOString()} className={`flex h-16 shrink-0 flex-col items-center justify-center border-r text-xs ${today ? "bg-primary/10" : ""}`} style={{ width: DAY_WIDTH }}><span className="font-medium">{format(date, "EEE")}</span><span className={today ? "font-semibold text-primary" : "text-muted-foreground"}>{format(date, "dd MMM")}</span></div>
                  })}
                </div>
              </div>

              {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Cargando operación de hospitalidad…</div> : visibleBeds.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">No hay camas para los filtros seleccionados.</div> : visibleBeds.map((bed) => {
                const bedReservations = reservationByBed.get(bed.id) ?? []
                const roomBlocks = blocksByRoom.get(bed.room_id) ?? []
                const roomHousekeeping = housekeeping.filter((task) => task.room_id === bed.room_id)
                const roomHospitality = hospitality.filter((request) => request.room_id === bed.room_id)
                return (
                  <div key={bed.id} className="flex border-b last:border-b-0">
                    <div className="sticky left-0 z-20 flex min-h-20 shrink-0 items-center justify-between gap-3 border-r bg-background px-4" style={{ width: LABEL_WIDTH }}>
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{bed.room.room_number} · Cama {bed.bed_number}</p><p className="truncate text-xs text-muted-foreground">{bed.room.location?.name ?? "Sin ubicación"} · {bed.bed_type ?? bed.room.room_type ?? "Sin tipo"}</p></div>
                      <div className="flex shrink-0 gap-1">{roomHousekeeping.length > 0 && <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{roomHousekeeping.length}</Badge>}{roomHospitality.length > 0 && <Badge variant="secondary" className="gap-1"><ConciergeBell className="h-3 w-3" />{roomHospitality.length}</Badge>}</div>
                    </div>
                    <div className="relative min-h-20" style={{ width: RANGE_DAYS * DAY_WIDTH }}>
                      <div className="absolute inset-0 flex">{dates.map((date) => <button key={date.toISOString()} type="button" onClick={() => openNewReservation(bed, date)} className={`h-full shrink-0 border-r hover:bg-muted/60 ${iso(date) === iso(new Date()) ? "bg-primary/5" : ""}`} style={{ width: DAY_WIDTH }} aria-label={`Crear reserva en ${bed.room.room_number} el ${iso(date)}`} />)}</div>
                      {roomBlocks.map((block) => { const geometry = blockGeometry(block); return <div key={block.id} className="absolute top-2 z-10 h-7 rounded border border-slate-400 bg-slate-200 px-2 text-xs leading-6 text-slate-800" style={geometry} title={`${block.block_type}: ${block.reason}`}><span className="block truncate">Bloqueo · {block.reason}</span></div> })}
                      {bedReservations.map((reservation) => {
                        const geometry = reservationGeometry(reservation)
                        const statusClass = RESERVATION_STYLES[reservation.status] ?? "border-violet-300 bg-violet-100 text-violet-950"
                        return <button key={reservation.id} type="button" onClick={() => setSelected({ ...reservation, bed })} className={`absolute bottom-2 z-20 flex h-10 items-center justify-between gap-2 overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow ${statusClass}`} style={geometry}><span className="min-w-0 truncate font-semibold">{reservation.guest_name}</span><span className="shrink-0 opacity-70">{reservation.num_guests ?? 1}p</span></button>
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      <AddReservationDialog open={reservationDialogOpen} onOpenChange={setReservationDialogOpen} onSuccess={loadData} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedLocation={preselectedBed?.room.location?.name} />

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} aria-label="Cerrar panel" />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operación de estadía</p><h2 className="mt-1 text-xl font-semibold">{selected.guest_name}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.bed?.room.location?.name} · {selected.bed?.room.room_number} · Cama {selected.bed?.bed_number}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button></div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2"><Badge>{RESERVATION_LABELS[selected.status] ?? selected.status}</Badge><Badge variant="outline">Pago: {selected.payment_status ?? "sin registrar"}</Badge><Badge variant="outline">Origen: {selected.source ?? "interno"}</Badge></div>
              <div className="grid gap-3 sm:grid-cols-2"><Info label="Check-in" value={selected.check_in} /><Info label="Check-out" value={selected.check_out} /><Info label="Huéspedes" value={String(selected.num_guests ?? 1)} /><Info label="Monto" value={formatClp(Number(selected.total_amount ?? 0))} /></div>
              {selected.special_requests && <Info label="Solicitudes especiales" value={selected.special_requests} />}

              <ActionSection title="Reserva y estadía" icon={<CalendarDays className="h-4 w-4" />}>
                {selected.status === "pending" && <ActionButton icon={<CalendarDays />} label="Confirmar reserva" onClick={() => void setReservationStatus("confirmed")} disabled={savingAction} />}
                {selected.status === "confirmed" && <ActionButton icon={<LogIn />} label="Registrar check-in" onClick={() => void setReservationStatus("checked_in")} disabled={savingAction} />}
                {["checked_in", "checked-in"].includes(selected.status) && <ActionButton icon={<LogOut />} label="Registrar check-out" onClick={() => void setReservationStatus("checked_out")} disabled={savingAction} />}
                <ActionButton icon={<CircleDollarSign />} label="Marcar pago recibido" onClick={() => void markPayment("paid")} disabled={savingAction} />
                <ActionButton icon={<CircleDollarSign />} label="Marcar pago pendiente" onClick={() => void markPayment("pending")} disabled={savingAction} />
              </ActionSection>

              <ActionSection title="Housekeeping" icon={<Sparkles className="h-4 w-4" />}>
                <ActionButton icon={<Sparkles />} label="Generar limpieza de salida" onClick={() => void createHousekeepingTask("turnover", `Limpieza posterior al check-out de ${selected.guest_name}, reserva ${selected.id}.`)} disabled={savingAction} />
                <ActionButton icon={<DoorOpen />} label="Solicitar preparación de habitación" onClick={() => void createHousekeepingTask("room_preparation", `Preparar habitación para la llegada de ${selected.guest_name}, reserva ${selected.id}.`)} disabled={savingAction} />
                <ActionButton icon={<Wrench />} label="Reportar revisión técnica" onClick={() => void createHousekeepingTask("inspection", `Revisión operativa asociada a la reserva ${selected.id}.`)} disabled={savingAction} />
              </ActionSection>

              <ActionSection title="Hospitalidad" icon={<ConciergeBell className="h-4 w-4" />}>
                <ActionButton icon={<ConciergeBell />} label="Crear solicitud del huésped" onClick={() => void createHospitalityRequest("guest_request", `Solicitud operativa para ${selected.guest_name}, asociada a la reserva ${selected.id}.`)} disabled={savingAction} />
                <ActionButton icon={<Users />} label="Coordinar recepción o traslado" onClick={() => void createHospitalityRequest("arrival_coordination", `Coordinar recepción o traslado de ${selected.guest_name} para el ${selected.check_in}.`)} disabled={savingAction} />
                <ActionButton icon={<BedDouble />} label="Solicitar amenidad o preparación especial" onClick={() => void createHospitalityRequest("room_amenity", `Preparación especial para ${selected.guest_name}. ${selected.special_requests ?? "Sin detalle adicional."}`)} disabled={savingAction} />
              </ActionSection>
            </div>
          </aside>
        </div>
      )}
    </AppLayout>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div></CardContent></Card>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>
}

function ActionSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section><div className="mb-3 flex items-center gap-2"><span className="text-primary">{icon}</span><h3 className="text-sm font-semibold">{title}</h3></div><div className="grid gap-2 sm:grid-cols-2">{children}</div></section>
}

function ActionButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <Button type="button" variant="outline" className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left" onClick={onClick} disabled={disabled}><span className="mr-2 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</Button>
}

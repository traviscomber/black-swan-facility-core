"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { Ban, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Loader2, LogIn, LogOut, Moon, Plus, Search, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { ResizableReservationBlock } from "@/components/resizable-reservation-block"
import { OccupancyHeatmap } from "@/components/occupancy-heatmap"
import { GapFillerDialog } from "@/components/gap-filler-dialog"
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
interface Reservation {
  id: string; bed_id: string; guest_name: string; guest_email?: string | null; guest_phone?: string | null
  check_in: string; check_out: string; status: string; num_guests?: number | null; total_amount?: number | null; special_requests?: string | null
}
interface RoomBlock {
  id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; notes?: string | null; status: string
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-violet-600 text-white border-violet-700", checked_in: "bg-emerald-600 text-white border-emerald-700",
  "checked-in": "bg-emerald-600 text-white border-emerald-700", checked_out: "bg-slate-600 text-white border-slate-700",
  "checked-out": "bg-slate-600 text-white border-slate-700", pending: "bg-amber-500 text-white border-amber-600",
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
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkOperationOpen, setBulkOperationOpen] = useState(false)
  const [bulkConflicts, setBulkConflicts] = useState<{ id: string; reason: string }[]>([])
  const [bulkOperationType, setBulkOperationType] = useState<"move" | "status" | "delete">("move")
  const [lastBulkOperation, setLastBulkOperation] = useState<{ ids: string[]; type: string; timestamp: number } | null>(null)
  const [showPricingOverlay, setShowPricingOverlay] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [gaps, setGaps] = useState<{ bedId: string; startDate: string; endDate: string; days: number }[]>([])
  const [suggestions, setSuggestions] = useState<{ type: string; message: string; action?: string }[]>([])
  const [selectedGap, setSelectedGap] = useState<{ bedId: string; startDate: string; endDate: string; days: number } | null>(null)

  const endDate = addDays(startDate, rangeDays)
  const dates = useMemo(() => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)), [rangeDays, startDate])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [locationsResult, bedsResult, reservationsResult, blocksResult] = await Promise.all([
      supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
      supabase.from("beds").select(`id, bed_number, bed_type, room:rooms!inner(id, room_number, room_type, location_id, location_ref:locations(id, name))`).order("room_id"),
      supabase.from("reservations").select("id, bed_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests, total_amount, special_requests")
        .lt("check_in", format(endDate, "yyyy-MM-dd")).gt("check_out", format(startDate, "yyyy-MM-dd")).order("check_in"),
      supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, notes, status")
        .eq("status", "active").lt("start_date", format(endDate, "yyyy-MM-dd")).gt("end_date", format(startDate, "yyyy-MM-dd")).order("start_date"),
    ])
    const firstError = locationsResult.error || bedsResult.error || reservationsResult.error || blocksResult.error
    if (firstError) setError(firstError.message)
    else {
      setLocations((locationsResult.data ?? []) as Location[])
      setBeds((bedsResult.data ?? []) as unknown as Bed[])
      setReservations((reservationsResult.data ?? []) as Reservation[])
      setBlocks((blocksResult.data ?? []) as RoomBlock[])
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // C3: Gap detection
  const computeGaps = useCallback(() => {
    const newGaps = []
    visibleBeds.forEach((bed) => {
      const bedReservations = reservations.filter((r) => r.bed_id === bed.id && r.status !== "cancelled")
        .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())
      
      for (let i = 0; i < bedReservations.length - 1; i++) {
        const gap = differenceInCalendarDays(new Date(bedReservations[i + 1].check_in), new Date(bedReservations[i].check_out))
        if (gap > 2) {
          newGaps.push({
            bedId: bed.id,
            startDate: bedReservations[i].check_out,
            endDate: bedReservations[i + 1].check_in,
            days: gap,
          })
        }
      }
    })
    setGaps(newGaps)
  }, [visibleBeds, reservations])

  // C4: Smart suggestions
  useEffect(() => {
    computeGaps()
    const newSuggestions = []
    const avgOccupancy = visibleBeds.length > 0 
      ? (reservations.length * 3) / (visibleBeds.length * rangeDays) * 100 
      : 0
    
    if (gaps.length > 0) newSuggestions.push({ type: "gap", message: `${gaps.length} gaps detectados - considere promociones` })
    if (avgOccupancy > 90) newSuggestions.push({ type: "high", message: "Ocupación >90% - aumente precios 15-20%" })
    if (avgOccupancy < 50) newSuggestions.push({ type: "low", message: "Ocupación <50% - considere descuentos" })
    
    setSuggestions(newSuggestions)
  }, [visibleBeds, reservations, rangeDays, gaps.length, computeGaps])
  useEffect(() => {
    const channel = supabase.channel("bookings-calendar-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const visibleBeds = useMemo(() => {
    const term = search.trim().toLowerCase()
    return beds.filter((bed) => {
      const matchesLocation = locationId === "all" || bed.room.location_id === locationId
      const matchesSearch = !term || bed.room.room_number.toLowerCase().includes(term) || bed.bed_number.toLowerCase().includes(term) || bed.bed_type.toLowerCase().includes(term)
      return matchesLocation && matchesSearch
    })
  }, [beds, locationId, search])

  const visibleBedIds = useMemo(() => new Set(visibleBeds.map((bed) => bed.id)), [visibleBeds])
  const visibleRoomIds = useMemo(() => new Set(visibleBeds.map((bed) => bed.room.id)), [visibleBeds])
  const visibleReservations = useMemo(() => reservations.filter((reservation) => {
    const matchesBed = visibleBedIds.has(reservation.bed_id)
    const matchesStatus = status === "all" || normalizedStatus(reservation.status) === status
    const matchesSearch = !search.trim() || reservation.guest_name.toLowerCase().includes(search.trim().toLowerCase())
    return matchesBed && matchesStatus && matchesSearch
  }), [reservations, search, status, visibleBedIds])
  const visibleBlocks = useMemo(() => blocks.filter((block) => visibleRoomIds.has(block.room_id)), [blocks, visibleRoomIds])

  const reservationsByBed = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    visibleReservations.forEach((item) => map.set(item.bed_id, [...(map.get(item.bed_id) ?? []), item]))
    return map
  }, [visibleReservations])
  const blocksByRoom = useMemo(() => {
    const map = new Map<string, RoomBlock[]>()
    visibleBlocks.forEach((item) => map.set(item.room_id, [...(map.get(item.room_id) ?? []), item]))
    return map
  }, [visibleBlocks])

  function reservationAt(bedId: string, date: Date) {
    return (reservationsByBed.get(bedId) ?? []).find((item) => date >= parseISO(item.check_in) && date < parseISO(item.check_out))
  }
  function blockAt(roomId: string, date: Date) {
    return (blocksByRoom.get(roomId) ?? []).find((item) => date >= parseISO(item.start_date) && date < parseISO(item.end_date))
  }

  const metrics = useMemo(() => {
    const active = visibleReservations.filter((item) => normalizedStatus(item.status) !== "cancelled")
    const blockedNights = visibleBeds.reduce((sum, bed) => sum + dates.filter((date) => !!blockAt(bed.room.id, date)).length, 0)
    const sellableNights = Math.max(0, visibleBeds.length * rangeDays - blockedNights)
    const occupiedNights = active.reduce((sum, item) => {
      const from = parseISO(item.check_in) < startDate ? startDate : parseISO(item.check_in)
      const to = parseISO(item.check_out) > endDate ? endDate : parseISO(item.check_out)
      return sum + Math.max(0, differenceInCalendarDays(to, from))
    }, 0)
    return {
      occupancy: sellableNights ? Math.round((occupiedNights / sellableNights) * 100) : 0,
      occupiedNights, blockedNights,
      revenue: active.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0),
      arrivals: active.filter((item) => isSameDay(parseISO(item.check_in), new Date())).length,
      departures: active.filter((item) => isSameDay(parseISO(item.check_out), new Date())).length,
    }
  }, [dates, endDate, rangeDays, startDate, visibleBeds, visibleReservations])

  function openNewReservation(bed: Bed, date: Date) {
    if (blockAt(bed.room.id, date)) return
    setPreselectedBed(bed); setPreselectedDate(date); setNewReservationOpen(true)
  }

  async function updateReservationStatus(reservation: Reservation, nextStatus: string) {
    setUpdatingStatus(reservation.id); setError(null)
    const { error: updateError } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.id)
    if (updateError) setError(updateError.message)
    else { setSelectedReservation({ ...reservation, status: nextStatus }); await loadData() }
    setUpdatingStatus(null)
  }

  async function handleReservationResize(reservationId: string, newCheckIn: string, newCheckOut: string) {
    try {
      setError(null)
      
      // Get reservation to verify it exists
      const reservationToUpdate = reservations.find((r) => r.id === reservationId)
      if (!reservationToUpdate) throw new Error("Reservation not found")

      // Call API to update with conflict checking
      const response = await fetch("/api/bookings/reservations/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          check_in: newCheckIn,
          check_out: newCheckOut,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update reservation dates")
      }

      // Reload data to reflect changes
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error updating reservation"
      setError(message)
      throw err
    }
  }

  const toggleSelectReservation = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const executeBulkOperation = useCallback(async (daysDelta: number = 0, daysExtend: number = 0, newStatus?: string) => {
    if (selectedIds.size === 0) return
    setError(null)
    const ids = Array.from(selectedIds)
    const endpoint = bulkOperationType === "status" ? "/api/bookings/bulk/status" : 
                     bulkOperationType === "delete" ? "/api/bookings/bulk/delete" :
                     "/api/bookings/bulk/execute"
    const payload = bulkOperationType === "status" ? { reservation_ids: ids, status: newStatus } :
                    bulkOperationType === "delete" ? { reservation_ids: ids } :
                    { reservation_ids: ids, days_delta: daysDelta, days_extend: daysExtend }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    if (!response.ok) {
      setBulkConflicts(result.conflicts || [])
      setError(result.error || "Operación masiva fallida")
      return
    }
    setLastBulkOperation({ ids, type: bulkOperationType, timestamp: Date.now() })
    setSelectedIds(new Set())
    setBulkOperationOpen(false)
    setBulkConflicts([])
    await loadData()
  }, [selectedIds, bulkOperationType])

  const undoLastOperation = useCallback(async () => {
    if (!lastBulkOperation) return
    setError(null)
    const response = await fetch("/api/bookings/bulk/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservation_ids: lastBulkOperation.ids,
        operation_type: lastBulkOperation.type,
      }),
    })
    const result = await response.json()
    if (!response.ok) {
      setError(result.error || "Deshacer falló")
      return
    }
    setLastBulkOperation(null)
    await loadData()
  }, [lastBulkOperation])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setBulkConflicts([])
  }, [])

  const fillGap = useCallback(async (bedId: string, checkIn: string, checkOut: string, dailyRate: number) => {
    try {
      const response = await fetch("/api/bookings/revenue/auto-fill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bed_id: bedId, check_in: checkIn, check_out: checkOut, daily_rate: dailyRate }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setSelectedGap(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error filling gap")
    }
  }, [loadData])

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Reservas</h1><p className="text-sm text-muted-foreground">Calendario operativo con reservas y bloqueos de disponibilidad.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/bookings/blocks"><Ban className="mr-2 h-4 w-4" />Gestionar bloqueos</Link></Button>
            <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}><CalendarDays className="mr-2 h-4 w-4" />Hoy</Button>
            <Button onClick={() => { setPreselectedBed(null); setPreselectedDate(null); setNewReservationOpen(true) }}><Plus className="mr-2 h-4 w-4" />Nueva reserva</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric title="Ocupación vendible" value={`${metrics.occupancy}%`} icon={<Users className="h-4 w-4" />} />
          <Metric title="Noches ocupadas" value={String(metrics.occupiedNights)} icon={<Moon className="h-4 w-4" />} />
          <Metric title="Noches bloqueadas" value={String(metrics.blockedNights)} icon={<Ban className="h-4 w-4" />} />
          <Metric title="Ingresos del rango" value={formatClp(metrics.revenue)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <Metric title="Llegadas hoy" value={String(metrics.arrivals)} icon={<LogIn className="h-4 w-4" />} />
          <Metric title="Salidas hoy" value={String(metrics.departures)} icon={<LogOut className="h-4 w-4" />} />
        </div>

        <Card><CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar huésped, habitación o cama" /></div>
          <Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Propiedad" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las propiedades</SelectItem>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="confirmed">Confirmada</SelectItem><SelectItem value="checked_in">Check-in</SelectItem><SelectItem value="checked_out">Check-out</SelectItem><SelectItem value="cancelled">Cancelada</SelectItem></SelectContent></Select>
          <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}><SelectTrigger className="w-full xl:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 días</SelectItem><SelectItem value="14">14 días</SelectItem><SelectItem value="30">30 días</SelectItem></SelectContent></Select>
        </CardContent></Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}
        
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 space-y-1 text-xs">
            {suggestions.map((s, i) => <div key={i} className={s.type === "gap" ? "text-blue-600" : s.type === "high" ? "text-green-600" : "text-amber-600"}>{s.message}</div>)}
          </div>
        )}
        
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
            <span className="text-sm font-medium">{selectedIds.size} reserva(s) seleccionada(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant={showPricingOverlay ? "default" : "outline"} onClick={() => setShowPricingOverlay(!showPricingOverlay)}>💰 Precios</Button>
              <Button size="sm" variant={showHeatmap ? "default" : "outline"} onClick={() => setShowHeatmap(!showHeatmap)}>🔥 Heatmap</Button>
              <Button variant="outline" onClick={() => setStartDate(addDays(startDate, -rangeDays))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setStartDate(addDays(startDate, rangeDays))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        <Card className="overflow-hidden"><CardHeader className="flex flex-row items-center justify-between border-b py-3"><div><CardTitle className="text-base">{format(startDate, "dd MMM")} — {format(addDays(endDate, -1), "dd MMM yyyy")}</CardTitle><p className="text-xs text-muted-foreground">{visibleBeds.length} unidades visibles · {visibleBlocks.length} bloqueos activos</p></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -rangeDays))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, rangeDays))}><ChevronRight className="h-4 w-4" /></Button></div></CardHeader>
          <CardContent className="p-0"><div className="overflow-auto"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-20 bg-background"><tr><th className="sticky left-0 z-30 min-w-48 border-b border-r bg-background px-4 py-3 text-left">Habitación / cama</th>{dates.map((date) => <th key={date.toISOString()} className={`min-w-24 border-b border-r px-2 py-2 text-center ${isSameDay(date, new Date()) ? "bg-amber-100" : ""}`}><div className="text-xs text-muted-foreground">{format(date, "EEE")}</div><div className="font-semibold">{format(date, "dd MMM")}</div></th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={dates.length + 1} className="p-12 text-center text-muted-foreground">Cargando calendario...</td></tr> : visibleBeds.length === 0 ? <tr><td colSpan={dates.length + 1} className="p-12 text-center text-muted-foreground">No hay unidades para los filtros seleccionados.</td></tr> : visibleBeds.map((bed) => <tr key={bed.id} className="hover:bg-muted/30"><td className="sticky left-0 z-10 border-b border-r bg-background px-4 py-3"><div className="font-medium">Hab. {bed.room.room_number}</div><div className="text-xs text-muted-foreground">{bed.bed_number} · {bed.bed_type}</div></td>{dates.map((date) => {
              const reservation = reservationAt(bed.id, date); const block = blockAt(bed.room.id, date)
              const reservationStart = reservation && isSameDay(parseISO(reservation.check_in), date)
              const blockStart = block && isSameDay(parseISO(block.start_date), date)
              const isSelected = reservation && selectedIds.has(reservation.id)
              return <td key={`${bed.id}-${date.toISOString()}`} className={`h-16 border-b border-r p-1 ${isSameDay(date, new Date()) ? "bg-amber-50" : ""}`}>{reservation ? <button onClick={() => {
                if (isSelected) toggleSelectReservation(reservation.id)
                else setSelectedReservation(reservation)
              }} onContextMenu={(e) => { e.preventDefault(); toggleSelectReservation(reservation.id)               }} className={`h-full w-full rounded border px-2 text-left text-xs transition-all ${isSelected ? "ring-2 ring-blue-500" : ""} ${STATUS_STYLES[reservation.status] ?? "bg-slate-200 text-slate-900"}`} title={`${reservation.guest_name} · ${reservation.check_in} → ${reservation.check_out} · Click derecho para seleccionar`}>{reservationStart ? <><div className="truncate font-semibold">{reservation.guest_name}</div><div className="truncate opacity-80">{showPricingOverlay && reservation.total_amount ? `$${reservation.total_amount}` : (STATUS_LABELS[reservation.status] ?? reservation.status)}</div></> : <div className="h-full opacity-40" />}</button> : block ? <button onClick={() => setSelectedBlock(block)} className="h-full w-full rounded border border-zinc-500 bg-zinc-800 px-2 text-left text-xs text-white" title={`${block.reason} · ${block.start_date} → ${block.end_date}`}>{blockStart ? <><div className="truncate font-semibold">{BLOCK_LABELS[block.block_type] ?? "Bloqueada"}</div><div className="truncate opacity-80">{block.reason}</div></> : <div className="h-full opacity-40" />}</button> : <button onClick={() => openNewReservation(bed, date)} className="h-full w-full rounded text-muted-foreground hover:bg-primary/10 hover:text-primary"><Plus className="mx-auto h-4 w-4" /></button>}</td>
            })}</tr>)}</tbody></table></div></CardContent>
        </Card>
      </div>

      <AddReservationDialog open={newReservationOpen} onOpenChange={setNewReservationOpen} onSuccess={loadData} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedLocation={preselectedBed?.room.location_ref?.name} />
      
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
                  Cama {gap.bedId}: {gap.startDate} → {gap.endDate} ({gap.days} noches)
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      <GapFillerDialog open={selectedGap !== null} onOpenChange={(open) => !open && setSelectedGap(null)} gap={selectedGap} onFill={fillGap} />
      
      <Dialog open={bulkOperationOpen} onOpenChange={setBulkOperationOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Operación masiva ({selectedIds.size})</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {bulkConflicts.length > 0 && (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600">
                <p className="font-medium">Conflictos: {bulkConflicts.map(c => c.reason).join(", ")}</p>
              </div>
            )}
            <div className="flex gap-2 border-b">
              {["move", "status", "delete"].map((op) => (
                <button key={op} onClick={() => setBulkOperationType(op as any)} className={`px-3 py-2 text-sm font-medium border-b-2 transition ${bulkOperationType === op ? "border-blue-500 text-blue-500" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {op === "move" ? "Mover/Extender" : op === "status" ? "Estado" : "Eliminar"}
                </button>
              ))}
            </div>
            {bulkOperationType === "move" && (
              <div className="space-y-3">
                <div><label className="text-xs font-medium">Mover días</label><Input type="number" defaultValue="0" min="-180" max="180" id="daysDelta" /></div>
                <div><label className="text-xs font-medium">Extender días</label><Input type="number" defaultValue="0" min="0" max="180" id="daysExtend" /></div>
              </div>
            )}
            {bulkOperationType === "status" && (
              <div><label className="text-xs font-medium">Nuevo estado</label>
                <Select defaultValue="confirmed">
                  <SelectTrigger id="statusSelect"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {bulkOperationType === "delete" && (
              <p className="text-xs text-muted-foreground">Se eliminarán {selectedIds.size} reserva(s). Esta acción no se puede deshacer automáticamente.</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => {
                if (bulkOperationType === "move") {
                  const delta = Number((document.getElementById("daysDelta") as HTMLInputElement)?.value || 0)
                  const extend = Number((document.getElementById("daysExtend") as HTMLInputElement)?.value || 0)
                  executeBulkOperation(delta, extend)
                } else if (bulkOperationType === "status") {
                  const status = (document.getElementById("statusSelect") as HTMLInputElement)?.value || "confirmed"
                  executeBulkOperation(0, 0, status)
                } else {
                  executeBulkOperation()
                }
              }}>Ejecutar</Button>
              <Button variant="outline" onClick={() => setBulkOperationOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {lastBulkOperation && Date.now() - lastBulkOperation.timestamp < 30000 && (
        <div className="fixed bottom-4 right-4 flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
          <span className="text-blue-600">Última operación: {lastBulkOperation.type} ({lastBulkOperation.ids.length})</span>
          <Button size="sm" variant="ghost" onClick={undoLastOperation} className="text-blue-600 hover:text-blue-700">Deshacer</Button>
        </div>
      )}
      <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}><DialogContent><DialogHeader><DialogTitle>Bloqueo de habitación</DialogTitle></DialogHeader>{selectedBlock && <div className="space-y-4"><Badge variant="secondary">{BLOCK_LABELS[selectedBlock.block_type] ?? selectedBlock.block_type}</Badge><Detail label="Motivo" value={selectedBlock.reason} /><div className="grid grid-cols-2 gap-4"><Detail label="Desde" value={selectedBlock.start_date} /><Detail label="Hasta" value={selectedBlock.end_date} /></div>{selectedBlock.notes && <Detail label="Notas" value={selectedBlock.notes} />}<Button asChild className="w-full"><Link href="/bookings/blocks">Administrar bloqueos</Link></Button></div>}</DialogContent></Dialog>
      <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>{selectedReservation && <div className="space-y-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Huésped</p><p className="text-xl font-semibold">{selectedReservation.guest_name}</p></div><Badge>{STATUS_LABELS[selectedReservation.status] ?? selectedReservation.status}</Badge></div><div className="grid grid-cols-2 gap-4 text-sm"><Detail label="Check-in" value={selectedReservation.check_in} /><Detail label="Check-out" value={selectedReservation.check_out} /><Detail label="Huéspedes" value={String(selectedReservation.num_guests ?? 1)} /><Detail label="Total" value={formatClp(Number(selectedReservation.total_amount ?? 0))} /></div><div className="flex flex-wrap justify-end gap-2 border-t pt-4">{normalizedStatus(selectedReservation.status) === "pending" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Confirmar reserva" onClick={() => updateReservationStatus(selectedReservation, "confirmed")} />}{normalizedStatus(selectedReservation.status) === "confirmed" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-in" onClick={() => updateReservationStatus(selectedReservation, "checked_in")} />}{normalizedStatus(selectedReservation.status) === "checked_in" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-out" onClick={() => updateReservationStatus(selectedReservation, "checked_out")} />}</div></div>}</DialogContent></Dialog>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card> }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div> }
function StatusButton({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) { return <Button onClick={onClick} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{label}</Button> }

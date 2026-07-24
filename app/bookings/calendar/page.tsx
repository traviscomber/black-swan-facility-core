"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { Ban, BedDouble, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, CircleDollarSign, Home, Loader2, LogIn, LogOut, Moon, Plus, RotateCcw, Search, Square, Trash2, Users, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type ReservationResizeEdge, useReservationResizeState } from "./use-reservation-resize-state"

interface Location { id: string; name: string }
interface Bed { id: string; bed_number: string; bed_type: string; room: { id: string; room_number: string; room_type?: string; location_id: string; location_ref?: { id: string; name: string } } }
interface CalendarEvent { event_id: string; event_type: "reservation" | "block"; bed_id: string; room_id: string; location_id: string; starts_on: string; ends_on: string; status: string; label: string; guest_name: string | null; block_type: string | null; source: string | null; total_amount: number | null }
interface Reservation { id: string; bed_id: string | null; guest_name: string; guest_email?: string | null; guest_phone?: string | null; check_in: string; check_out: string; status: string; num_guests?: number | null; total_amount?: number | null; special_requests?: string | null }
interface RoomBlock { id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; notes?: string | null; status: string }
interface ResizeRpcResult { success: boolean; message: string; check_in: string; check_out: string }
interface BulkConflict { reservation_id: string; reason: string }

const DAY_WIDTH = 96
const LABEL_WIDTH = 272
const ROW_HEIGHT = 68
const STATUS_STYLES: Record<string, string> = { confirmed: "bg-violet-600 text-white border-violet-700", checked_in: "bg-emerald-600 text-white border-emerald-700", "checked-in": "bg-emerald-600 text-white border-emerald-700", checked_out: "bg-slate-600 text-white border-slate-700", "checked-out": "bg-slate-600 text-white border-slate-700", pending: "bg-amber-500 text-white border-amber-600", cancelled: "bg-red-500 text-white border-red-600" }
const STATUS_LABELS: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmada", checked_in: "Check-in", "checked-in": "Check-in", checked_out: "Check-out", "checked-out": "Check-out", cancelled: "Cancelada" }
const BLOCK_LABELS: Record<string, string> = { maintenance: "Mantenimiento", owner_use: "Uso propietario", out_of_service: "Fuera de servicio", other: "Bloqueada" }
function normalizedStatus(value: string) { return value.replaceAll("-", "_") }
function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }
function intervalsOverlap(startA: string, endA: string, startB: string, endB: string) { return parseISO(startA) < parseISO(endB) && parseISO(endA) > parseISO(startB) }

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
  const { resizeState, resizingReservationId, confirmingReservationId, isResizing, beginResize, updatePreview, markConfirming, clearResize } = useReservationResizeState()

  // Phase B: multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkConflicts, setBulkConflicts] = useState<BulkConflict[]>([])
  const [lastOperationId, setLastOperationId] = useState<string | null>(null)
  const [undoExpiry, setUndoExpiry] = useState<Date | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0)

  const endDate = useMemo(() => addDays(startDate, rangeDays), [startDate, rangeDays])
  const dates = useMemo(() => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)), [rangeDays, startDate])
  const timelineWidth = rangeDays * DAY_WIDTH

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const [bedsResult, eventsResult] = await Promise.all([
      supabase.from("beds").select(`id, bed_number, bed_type, room:rooms!inner(id, room_number, room_type, location_id, location_ref:locations!inner(id, name, is_active))`).eq("room.location_ref.is_active", true).order("room_id"),
      supabase.rpc("get_booking_inventory_events", { p_start_date: format(startDate, "yyyy-MM-dd"), p_end_date: format(endDate, "yyyy-MM-dd"), p_location_id: null }),
    ])
    const firstError = bedsResult.error || eventsResult.error
    if (firstError) setError(firstError.message)
    else {
      const loadedBeds = (bedsResult.data ?? []) as unknown as Bed[]
      const lodgingLocations = Array.from(new Map(loadedBeds.filter((bed) => bed.room.location_ref).map((bed) => [bed.room.location_ref!.id, { id: bed.room.location_ref!.id, name: bed.room.location_ref!.name }])).values()).sort((a, b) => a.name.localeCompare(b.name))
      setLocations(lodgingLocations); setBeds(loadedBeds); setEvents((eventsResult.data ?? []) as CalendarEvent[])
    }
    setLoading(false)
  }, [endDate, startDate, supabase])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const channel = supabase.channel("bookings-calendar-v6").on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, loadData).on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, loadData).on("postgres_changes", { event: "*", schema: "public", table: "beds" }, loadData).on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, loadData).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])

  // Undo countdown
  useEffect(() => {
    if (!undoExpiry) { setUndoSecondsLeft(0); return }
    const tick = () => {
      const secs = Math.max(0, Math.round((undoExpiry.getTime() - Date.now()) / 1000))
      setUndoSecondsLeft(secs)
      if (secs === 0) { setLastOperationId(null); setUndoExpiry(null) }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [undoExpiry])

  const visibleBeds = useMemo(() => { const term = search.trim().toLowerCase(); return beds.filter((bed) => { const propertyName = bed.room.location_ref?.name?.toLowerCase() ?? ""; return (locationId === "all" || bed.room.location_id === locationId) && (!term || propertyName.includes(term) || bed.room.room_number.toLowerCase().includes(term) || bed.bed_number.toLowerCase().includes(term) || bed.bed_type.toLowerCase().includes(term)) }) }, [beds, locationId, search])
  const visibleBedIds = useMemo(() => new Set(visibleBeds.map((bed) => bed.id)), [visibleBeds])
  const visibleEvents = useMemo(() => { const term = search.trim().toLowerCase(); return events.filter((event) => visibleBedIds.has(event.bed_id) && (event.event_type === "block" || status === "all" || normalizedStatus(event.status) === status) && (!term || event.event_type === "block" || (event.guest_name ?? event.label).toLowerCase().includes(term))) }, [events, search, status, visibleBedIds])
  const visibleReservationEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "reservation"), [visibleEvents])
  const visibleBlockEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "block"), [visibleEvents])
  const eventsByBed = useMemo(() => { const map = new Map<string, CalendarEvent[]>(); visibleEvents.forEach((event) => map.set(event.bed_id, [...(map.get(event.bed_id) ?? []), event])); return map }, [visibleEvents])
  const resizeConflict = useMemo(() => {
    if (!resizeState) return null
    return events.find((event) => event.bed_id === resizeState.bedId && event.event_id !== resizeState.reservationId && intervalsOverlap(resizeState.previewStart, resizeState.previewEnd, event.starts_on, event.ends_on)) ?? null
  }, [events, resizeState])

  // Phase B: derived bulk state
  const selectedEvents = useMemo(() => visibleReservationEvents.filter((e) => selectedIds.has(e.event_id)), [visibleReservationEvents, selectedIds])
  const conflictIds = useMemo(() => new Set(bulkConflicts.map((c) => c.reservation_id)), [bulkConflicts])
  const isBulkMode = selectedIds.size > 0

  function toggleSelect(eventId: string, shiftKey: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) { next.delete(eventId) } else { next.add(eventId) }
      return next
    })
    setBulkConflicts([])
  }
  function selectAll() { setSelectedIds(new Set(visibleReservationEvents.map((e) => e.event_id))); setBulkConflicts([]) }
  function clearSelection() { setSelectedIds(new Set()); setBulkConflicts([]) }

  function eventAt(bedId: string, date: Date, type: CalendarEvent["event_type"]) { return (eventsByBed.get(bedId) ?? []).find((event) => event.event_type === type && date >= parseISO(event.starts_on) && date < parseISO(event.ends_on)) }
  function geometryForDates(startsOn: string, endsOn: string) { const eventStart = parseISO(startsOn) < startDate ? startDate : parseISO(startsOn); const eventEnd = parseISO(endsOn) > endDate ? endDate : parseISO(endsOn); const offsetDays = Math.max(0, differenceInCalendarDays(eventStart, startDate)); const durationDays = Math.max(1, differenceInCalendarDays(eventEnd, eventStart)); return { left: offsetDays * DAY_WIDTH + 4, width: Math.max(24, durationDays * DAY_WIDTH - 8) } }
  function eventGeometry(event: CalendarEvent) { return geometryForDates(event.starts_on, event.ends_on) }

  const metrics = useMemo(() => {
    const blockedNights = visibleBlockEvents.reduce((sum, event) => sum + Math.max(0, differenceInCalendarDays(parseISO(event.ends_on) > endDate ? endDate : parseISO(event.ends_on), parseISO(event.starts_on) < startDate ? startDate : parseISO(event.starts_on))), 0)
    const occupiedNights = visibleReservationEvents.reduce((sum, event) => sum + Math.max(0, differenceInCalendarDays(parseISO(event.ends_on) > endDate ? endDate : parseISO(event.ends_on), parseISO(event.starts_on) < startDate ? startDate : parseISO(event.starts_on))), 0)
    const uniqueReservations = Array.from(new Map(visibleReservationEvents.map((event) => [event.event_id, event])).values())
    const sellableNights = Math.max(0, visibleBeds.length * rangeDays - blockedNights)
    return { occupancy: sellableNights ? Math.round((occupiedNights / sellableNights) * 100) : 0, occupiedNights, blockedNights, revenue: uniqueReservations.reduce((sum, event) => sum + Number(event.total_amount ?? 0), 0), arrivals: uniqueReservations.filter((event) => isSameDay(parseISO(event.starts_on), new Date())).length, departures: uniqueReservations.filter((event) => isSameDay(parseISO(event.ends_on), new Date())).length, reservations: uniqueReservations.length, blocks: new Set(visibleBlockEvents.map((event) => event.event_id)).size }
  }, [endDate, rangeDays, startDate, visibleBeds, visibleBlockEvents, visibleReservationEvents])

  function openNewReservation(bed: Bed, date: Date) { if (eventAt(bed.id, date, "block") || eventAt(bed.id, date, "reservation")) return; setPreselectedBed(bed); setPreselectedDate(date); setNewReservationOpen(true) }
  function openReservationFromTimeline(bed: Bed, clientX: number, currentTarget: HTMLDivElement) { if (draggingEventId || isResizing || confirmingReservationId || isBulkMode) return; const rect = currentTarget.getBoundingClientRect(); const offset = Math.max(0, Math.min(timelineWidth - 1, clientX - rect.left)); openNewReservation(bed, addDays(startDate, Math.floor(offset / DAY_WIDTH))) }

  function beginReservationResize(event: CalendarEvent, edge: ReservationResizeEdge, pointerEvent: React.PointerEvent<HTMLSpanElement>) { if (event.event_type !== "reservation" || movingReservationId || draggingEventId || confirmingReservationId || isBulkMode) return; pointerEvent.preventDefault(); pointerEvent.stopPropagation(); pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId); beginResize({ reservationId: event.event_id, bedId: event.bed_id, edge, pointerId: pointerEvent.pointerId, pointerStartX: pointerEvent.clientX, startsOn: event.starts_on, endsOn: event.ends_on }) }
  function moveReservationResize(pointerEvent: React.PointerEvent<HTMLSpanElement>) { if (!resizeState || resizeState.pointerId !== pointerEvent.pointerId) return; pointerEvent.preventDefault(); pointerEvent.stopPropagation(); const deltaDays = Math.round((pointerEvent.clientX - resizeState.pointerStartX) / DAY_WIDTH); const originalStart = parseISO(resizeState.originalStart); const originalEnd = parseISO(resizeState.originalEnd); if (resizeState.edge === "left") { const candidate = addDays(originalStart, deltaDays); const latestStart = addDays(originalEnd, -1); updatePreview(format(candidate > latestStart ? latestStart : candidate, "yyyy-MM-dd"), resizeState.originalEnd) } else { const candidate = addDays(originalEnd, deltaDays); const earliestEnd = addDays(originalStart, 1); updatePreview(resizeState.originalStart, format(candidate < earliestEnd ? earliestEnd : candidate, "yyyy-MM-dd")) } }
  async function finishReservationResize(pointerEvent: React.PointerEvent<HTMLSpanElement>) {
    pointerEvent.preventDefault(); pointerEvent.stopPropagation()
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId)
    if (!resizeState || resizeState.pointerId !== pointerEvent.pointerId) { clearResize(); return }
    const pendingResize = resizeState
    if (pendingResize.previewStart === pendingResize.originalStart && pendingResize.previewEnd === pendingResize.originalEnd) { clearResize(); return }
    if (resizeConflict) { toast.error(resizeConflict.event_type === "block" ? "Las nuevas fechas chocan con un bloqueo" : "Las nuevas fechas chocan con otra reserva"); clearResize(); return }
    const previousEvents = events
    setError(null)
    setEvents((current) => current.map((event) => event.event_type === "reservation" && event.event_id === pendingResize.reservationId ? { ...event, starts_on: pendingResize.previewStart, ends_on: pendingResize.previewEnd } : event))
    markConfirming(pendingResize.reservationId)
    const { data, error: resizeError } = await supabase.rpc("resize_booking_reservation", { p_reservation_id: pendingResize.reservationId, p_check_in: pendingResize.previewStart, p_check_out: pendingResize.previewEnd })
    const result = ((data ?? [])[0] ?? null) as ResizeRpcResult | null
    if (resizeError || !result?.success) { setEvents(previousEvents); const message = resizeError?.message ?? result?.message ?? "La disponibilidad cambió antes de confirmar las fechas"; setError(message); toast.error("El cambio de fechas fue rechazado y se restauró la reserva"); clearResize(); return }
    setEvents((current) => current.map((event) => event.event_type === "reservation" && event.event_id === pendingResize.reservationId ? { ...event, starts_on: result.check_in, ends_on: result.check_out } : event))
    toast.success(`Reserva actualizada: ${result.check_in} → ${result.check_out}`); clearResize(); await loadData()
  }
  function beginReservationDrag(event: CalendarEvent, transfer: DataTransfer) { if (isResizing || confirmingReservationId || isBulkMode) return; transfer.effectAllowed = "move"; transfer.setData("text/plain", event.event_id); setDraggingEventId(event.event_id) }
  function finishReservationDrag() { setDraggingEventId(null); setDropTargetBedId(null) }

  async function moveReservationToBed(targetBed: Bed) {
    const draggedEvent = events.find((event) => event.event_id === draggingEventId && event.event_type === "reservation")
    if (!draggedEvent || draggedEvent.bed_id === targetBed.id || movingReservationId) { finishReservationDrag(); return }
    setMovingReservationId(draggedEvent.event_id); setError(null)
    const { data: available, error: availabilityError } = await supabase.rpc("is_booking_inventory_available", { p_bed_id: targetBed.id, p_room_id: targetBed.room.id, p_location_id: targetBed.room.location_id, p_check_in: draggedEvent.starts_on, p_check_out: draggedEvent.ends_on, p_exclude_reservation_id: draggedEvent.event_id })
    if (availabilityError) { setError(availabilityError.message); toast.error("No fue posible validar la disponibilidad"); setMovingReservationId(null); finishReservationDrag(); return }
    if (!available) { toast.error("La cama seleccionada no está disponible para esas fechas"); setMovingReservationId(null); finishReservationDrag(); return }
    const previousEvents = events
    setEvents((current) => current.map((event) => event.event_id === draggedEvent.event_id && event.event_type === "reservation" ? { ...event, bed_id: targetBed.id, room_id: targetBed.room.id, location_id: targetBed.room.location_id } : event))
    const { error: updateError } = await supabase.from("reservations").update({ bed_id: targetBed.id, room_id: targetBed.room.id, location_id: targetBed.room.location_id, booking_type: "BED" }).eq("id", draggedEvent.event_id)
    if (updateError) { setEvents(previousEvents); setError(updateError.message); toast.error("El movimiento fue rechazado y se restauró la reserva") } else { toast.success(`Reserva movida a Hab. ${targetBed.room.room_number} · ${targetBed.bed_number}`); await loadData() }
    setMovingReservationId(null); finishReservationDrag()
  }

  async function openReservation(event: CalendarEvent) { setError(null); const { data, error: detailError } = await supabase.from("reservations").select("id, bed_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests, total_amount, special_requests").eq("id", event.event_id).single(); if (detailError) { setError(detailError.message); return }; setSelectedReservation(data as Reservation) }
  async function openBlock(event: CalendarEvent) { setError(null); const { data, error: detailError } = await supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, notes, status").eq("id", event.event_id).single(); if (detailError) { setError(detailError.message); return }; setSelectedBlock(data as RoomBlock) }
  async function updateReservationStatus(reservation: Reservation, nextStatus: string) { setUpdatingStatus(reservation.id); setError(null); const { error: updateError } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.id); if (updateError) setError(updateError.message); else { setSelectedReservation({ ...reservation, status: nextStatus }); await loadData() }; setUpdatingStatus(null) }

  // Phase B: bulk operations
  function armUndoTimer(operationId: string) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    const expiry = new Date(Date.now() + 30 * 60 * 1000)
    setLastOperationId(operationId)
    setUndoExpiry(expiry)
    undoTimerRef.current = setTimeout(() => { setLastOperationId(null); setUndoExpiry(null) }, 30 * 60 * 1000)
  }

  async function executeBulkStatus(nextStatus: string) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    try {
      const res = await fetch("/api/bookings/bulk/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], status: nextStatus }) })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? "No fue posible actualizar el estado"); return }
      armUndoTimer(data.operation_id)
      toast.success(`${data.updated_count} reserva${data.updated_count !== 1 ? "s" : ""} actualizadas a "${STATUS_LABELS[nextStatus] ?? nextStatus}"`)
      clearSelection(); await loadData()
    } catch { toast.error("Error de red al actualizar estado") } finally { setBulkLoading(false) }
  }

  async function executeBulkShift(daysDelta: number) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    const updates = selectedEvents.map((e) => ({
      id: e.event_id,
      bed_id: e.bed_id,
      check_in: format(addDays(parseISO(e.starts_on), daysDelta), "yyyy-MM-dd"),
      check_out: format(addDays(parseISO(e.ends_on), daysDelta), "yyyy-MM-dd"),
    }))
    try {
      const res = await fetch("/api/bookings/bulk/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], updates, operation_type: "move" }) })
      const data = await res.json()
      if (res.status === 409) { setBulkConflicts(data.conflicts ?? []); toast.error(data.error ?? "Conflictos detectados"); return }
      if (!res.ok || !data.success) { toast.error(data.error ?? "No fue posible mover las reservas"); return }
      armUndoTimer(data.operation_id)
      toast.success(`${data.updated_count} reserva${data.updated_count !== 1 ? "s" : ""} movidas ${daysDelta > 0 ? `+${daysDelta}` : daysDelta} día${Math.abs(daysDelta) !== 1 ? "s" : ""}`)
      clearSelection(); await loadData()
    } catch { toast.error("Error de red al mover reservas") } finally { setBulkLoading(false) }
  }

  async function executeBulkExtend(daysExtend: number) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    const updates = selectedEvents.map((e) => ({
      id: e.event_id,
      bed_id: e.bed_id,
      check_in: e.starts_on,
      check_out: format(addDays(parseISO(e.ends_on), daysExtend), "yyyy-MM-dd"),
    }))
    try {
      const res = await fetch("/api/bookings/bulk/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], updates, operation_type: daysExtend > 0 ? "extend" : "reduce" }) })
      const data = await res.json()
      if (res.status === 409) { setBulkConflicts(data.conflicts ?? []); toast.error(data.error ?? "Conflictos detectados"); return }
      if (!res.ok || !data.success) { toast.error(data.error ?? "No fue posible modificar las reservas"); return }
      armUndoTimer(data.operation_id)
      const label = daysExtend > 0 ? `extendidas +${daysExtend} día${daysExtend !== 1 ? "s" : ""}` : `reducidas ${daysExtend} día${Math.abs(daysExtend) !== 1 ? "s" : ""}`
      toast.success(`${data.updated_count} reserva${data.updated_count !== 1 ? "s" : ""} ${label}`)
      clearSelection(); await loadData()
    } catch { toast.error("Error de red al modificar reservas") } finally { setBulkLoading(false) }
  }

  async function executeBulkDelete() {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    try {
      const res = await fetch("/api/bookings/bulk/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds] }) })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? "No fue posible eliminar las reservas"); return }
      toast.success(`${data.deleted_count} reserva${data.deleted_count !== 1 ? "s" : ""} eliminadas`)
      clearSelection(); await loadData()
    } catch { toast.error("Error de red al eliminar reservas") } finally { setBulkLoading(false) }
  }

  async function undoLastOperation() {
    if (!lastOperationId || bulkLoading) return
    setBulkLoading(true)
    try {
      const res = await fetch("/api/bookings/bulk/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: lastOperationId }) })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? "No fue posible deshacer la operación"); return }
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      setLastOperationId(null); setUndoExpiry(null)
      toast.success(`Operación deshecha: ${data.restored_count} reserva${data.restored_count !== 1 ? "s" : ""} restauradas`)
      await loadData()
    } catch { toast.error("Error de red al deshacer") } finally { setBulkLoading(false) }
  }

  return <div className="min-h-screen bg-background p-4 md:p-6"><div className="mx-auto max-w-[1800px] space-y-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Hospitalidad · Fundo Corcovado</p><h1 className="text-3xl font-semibold tracking-tight">Reservas y disponibilidad</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Timeline operativo conectado al Availability Engine. Arrastra una reserva hacia otra cama para reasignarla. Ctrl+clic o clic en el checkbox para selección múltiple.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/bookings/blocks"><Ban className="mr-2 h-4 w-4" />Gestionar bloqueos</Link></Button><Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}><CalendarDays className="mr-2 h-4 w-4" />Hoy</Button><Button onClick={() => { setPreselectedBed(null); setPreselectedDate(null); setNewReservationOpen(true) }}><Plus className="mr-2 h-4 w-4" />Nueva reserva</Button></div></div>
    <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-3"><ContextMetric icon={<Home className="h-4 w-4" />} label="Propiedades hospedables" value={String(locations.length)} detail="Ubicaciones con camas configuradas" /><ContextMetric icon={<BedDouble className="h-4 w-4" />} label="Camas registradas" value={String(beds.length)} detail="Capacidad física registrada en el sistema" /><ContextMetric icon={<Users className="h-4 w-4" />} label="Reservas del rango" value={String(metrics.reservations)} detail="Reservas únicas desde el motor de disponibilidad" /></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric title="Ocupación disponible" value={`${metrics.occupancy}%`} icon={<Users className="h-4 w-4" />} /><Metric title="Noches ocupadas" value={String(metrics.occupiedNights)} icon={<Moon className="h-4 w-4" />} /><Metric title="Noches bloqueadas" value={String(metrics.blockedNights)} icon={<Ban className="h-4 w-4" />} /><Metric title="Monto registrado" value={formatClp(metrics.revenue)} icon={<CircleDollarSign className="h-4 w-4" />} /><Metric title="Llegadas hoy" value={String(metrics.arrivals)} icon={<LogIn className="h-4 w-4" />} /><Metric title="Salidas hoy" value={String(metrics.departures)} icon={<LogOut className="h-4 w-4" />} /></div>
    <Card><CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar huésped, propiedad, habitación o cama" /></div><Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Alojamiento" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los alojamientos</SelectItem>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="confirmed">Confirmada</SelectItem><SelectItem value="checked_in">Check-in</SelectItem><SelectItem value="checked_out">Check-out</SelectItem></SelectContent></Select><Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}><SelectTrigger className="w-full xl:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 días</SelectItem><SelectItem value="14">14 días</SelectItem><SelectItem value="30">30 días</SelectItem></SelectContent></Select></CardContent></Card>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">No fue posible cargar o actualizar la disponibilidad: {error}</div>}
    {bulkConflicts.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600">{bulkConflicts.length} conflicto{bulkConflicts.length !== 1 ? "s" : ""} detectado{bulkConflicts.length !== 1 ? "s" : ""}. Revisa las reservas marcadas en amarillo antes de continuar.</div>}

    {/* Phase B: Undo toast bar */}
    {lastOperationId && undoSecondsLeft > 0 && (
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <RotateCcw className="h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1 text-sm">Operación completada. Puedes deshacerla durante los próximos <span className="font-semibold">{undoSecondsLeft}s</span>.</p>
        <Button size="sm" variant="outline" onClick={undoLastOperation} disabled={bulkLoading}>{bulkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deshacer</Button>
      </div>
    )}

    <Card className="overflow-hidden"><CardHeader className="flex flex-row items-center justify-between border-b py-3"><div><CardTitle className="text-base">{format(startDate, "dd MMM")} — {format(addDays(endDate, -1), "dd MMM yyyy")}</CardTitle><p className="text-xs text-muted-foreground">{visibleBeds.length} camas visibles · {metrics.blocks} bloqueos activos · clic en espacio libre para reservar · arrastra para reasignar cama · ajusta extremos para cambiar fechas · Ctrl+clic para selección múltiple</p></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -rangeDays))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, rangeDays))}><ChevronRight className="h-4 w-4" /></Button></div></CardHeader>

      {/* Phase B: Bulk operations bar */}
      {isBulkMode && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-4 py-2.5">
          <span className="mr-1 text-sm font-semibold text-primary">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={selectAll} disabled={bulkLoading}><CheckSquare className="mr-1.5 h-3.5 w-3.5" />Todas</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkShift(-1)} disabled={bulkLoading}><ChevronLeft className="mr-1 h-3.5 w-3.5" />-1 día</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkShift(1)} disabled={bulkLoading}><ChevronRight className="mr-1 h-3.5 w-3.5" />+1 día</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkShift(7)} disabled={bulkLoading}>+7 días</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkExtend(1)} disabled={bulkLoading}>Extender +1</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkExtend(-1)} disabled={bulkLoading}>Reducir -1</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkStatus("confirmed")} disabled={bulkLoading}>Confirmar</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkStatus("checked_in")} disabled={bulkLoading}>Check-in</Button>
            <Button size="sm" variant="outline" onClick={() => executeBulkStatus("cancelled")} disabled={bulkLoading}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={executeBulkDelete} disabled={bulkLoading}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar</Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button size="sm" variant="ghost" onClick={clearSelection}><X className="mr-1.5 h-3.5 w-3.5" />Limpiar</Button>
          </div>
        </div>
      )}

      <CardContent className="p-0"><div className="overflow-auto"><div style={{ minWidth: LABEL_WIDTH + timelineWidth }}>
        <div className="sticky top-0 z-30 flex border-b bg-background"><div className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r bg-background px-4 font-medium" style={{ width: LABEL_WIDTH, height: 58 }}>{visibleReservationEvents.length > 0 && <button type="button" onClick={isBulkMode ? clearSelection : selectAll} className="shrink-0 text-muted-foreground transition hover:text-foreground" aria-label={isBulkMode ? "Deseleccionar todo" : "Seleccionar todo"}>{isBulkMode ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}</button>}<span>Propiedad / habitación / cama</span></div><div className="grid" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${rangeDays}, ${DAY_WIDTH}px)` }}>{dates.map((date) => <div key={date.toISOString()} className={`flex flex-col items-center justify-center border-r text-center ${isSameDay(date, new Date()) ? "bg-amber-100" : ""}`} style={{ height: 58 }}><div className="text-xs text-muted-foreground">{format(date, "EEE")}</div><div className="font-semibold">{format(date, "dd MMM")}</div></div>)}</div></div>
        {loading ? <div className="p-12 text-center text-muted-foreground">Cargando Availability Engine…</div> : visibleBeds.length === 0 ? <div className="p-12 text-center text-muted-foreground">No hay camas para los filtros seleccionados.</div> : visibleBeds.map((bed) => { const bedEvents = eventsByBed.get(bed.id) ?? []; const isDropTarget = dropTargetBedId === bed.id && !!draggingEventId; return <div key={bed.id} className={`flex border-b transition ${isDropTarget ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500" : "hover:bg-muted/20"}`} style={{ height: ROW_HEIGHT }} onDragOver={(dragEvent) => { if (!draggingEventId) return; dragEvent.preventDefault(); dragEvent.dataTransfer.dropEffect = "move" }} onDragEnter={() => draggingEventId && setDropTargetBedId(bed.id)} onDragLeave={(dragEvent) => { if (!dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)) setDropTargetBedId(null) }} onDrop={(dropEvent) => { dropEvent.preventDefault(); void moveReservationToBed(bed) }}>
          <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background px-4" style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}>
            <div className="flex-1 overflow-hidden"><div className="truncate font-medium">{bed.room.location_ref?.name ?? "Sin propiedad"}</div><div className="truncate text-xs text-muted-foreground">Hab. {bed.room.room_number} · {bed.bed_number} · {bed.bed_type}</div></div>
          </div>
          <div className="relative cursor-crosshair" style={{ width: timelineWidth, height: ROW_HEIGHT, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH}px)` }} onClick={(clickEvent) => openReservationFromTimeline(bed, clickEvent.clientX, clickEvent.currentTarget)}>{dates.map((date, index) => isSameDay(date, new Date()) ? <div key={`today-${bed.id}-${index}`} className="pointer-events-none absolute inset-y-0 bg-amber-50/70" style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }} /> : null)}
            {bedEvents.map((event) => {
              const geometry = eventGeometry(event)
              const isBlock = event.event_type === "block"
              const isMoving = movingReservationId === event.event_id
              const isEventResizing = resizingReservationId === event.event_id
              const isConfirmingResize = confirmingReservationId === event.event_id
              const previewGeometry = isEventResizing && resizeState ? geometryForDates(resizeState.previewStart, resizeState.previewEnd) : null
              const hasConflict = isEventResizing && !!resizeConflict
              const isSelected = !isBlock && selectedIds.has(event.event_id)
              const isBulkConflict = conflictIds.has(event.event_id)
              return <div key={`${event.event_type}-${event.event_id}-${bed.id}`}>
                {previewGeometry && <div className={`pointer-events-none absolute top-2 z-20 h-[52px] rounded-md border-2 border-dashed shadow-sm transition-all duration-150 ${hasConflict ? "border-red-200 bg-red-600/75" : "border-white/90 bg-emerald-500/65"}`} style={{ left: previewGeometry.left, width: previewGeometry.width }}><div className="truncate px-3 pt-1 text-xs font-semibold text-white">{hasConflict ? "No disponible" : "Disponible"} · {resizeState!.previewStart} → {resizeState!.previewEnd}</div><div className="truncate px-3 text-[10px] text-white/90">{hasConflict ? (resizeConflict?.event_type === "block" ? "Conflicto con bloqueo" : "Conflicto con otra reserva") : "Suelta para confirmar"}</div></div>}
                <button
                  type="button"
                  draggable={!isBlock && !movingReservationId && !isResizing && !confirmingReservationId && !isBulkMode}
                  onDragStart={(dragEvent) => !isBlock && beginReservationDrag(event, dragEvent.dataTransfer)}
                  onDragEnd={finishReservationDrag}
                  onClick={(buttonEvent) => {
                    buttonEvent.stopPropagation()
                    if (draggingEventId || isResizing || confirmingReservationId) return
                    if (!isBlock && (buttonEvent.ctrlKey || buttonEvent.metaKey || isBulkMode)) {
                      toggleSelect(event.event_id, buttonEvent.shiftKey)
                      return
                    }
                    if (isBlock) void openBlock(event); else void openReservation(event)
                  }}
                  className={`group absolute top-2 h-[52px] overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary ${isBulkConflict ? "ring-2 ring-amber-400" : ""} ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-primary brightness-110" : ""} ${isBlock ? "border-zinc-500 bg-zinc-800 text-white" : `${STATUS_STYLES[normalizedStatus(event.status)] ?? "bg-slate-600 text-white border-slate-700"}`} ${isMoving || isConfirmingResize ? "opacity-60" : ""}`}
                  style={{ left: geometry.left, width: geometry.width }}
                  aria-label={`${isBlock ? (BLOCK_LABELS[event.block_type ?? "other"] ?? "Bloqueada") : event.guest_name ?? event.label} ${isBlock ? event.label : `${STATUS_LABELS[event.status] ?? event.status} · ${event.starts_on} → ${event.ends_on}`}`}
                >
                  {!isBlock && (
                    <span
                      className={`absolute left-1 top-1 z-10 transition ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(event.event_id, false) }}
                    >
                      {isSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                    </span>
                  )}
                  {!isBlock && <><span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-white/0 opacity-0 transition hover:bg-white/35 group-hover:opacity-100" onClick={(handleEvent) => { handleEvent.preventDefault(); handleEvent.stopPropagation() }} onPointerDown={(pointerEvent) => beginReservationResize(event, "left", pointerEvent)} onPointerMove={moveReservationResize} onPointerUp={(pointerEvent) => { void finishReservationResize(pointerEvent) }} onPointerCancel={(pointerEvent) => { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); clearResize() }} /><span aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-white/0 opacity-0 transition hover:bg-white/35 group-hover:opacity-100" onClick={(handleEvent) => { handleEvent.preventDefault(); handleEvent.stopPropagation() }} onPointerDown={(pointerEvent) => beginReservationResize(event, "right", pointerEvent)} onPointerMove={moveReservationResize} onPointerUp={(pointerEvent) => { void finishReservationResize(pointerEvent) }} onPointerCancel={(pointerEvent) => { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); clearResize() }} /></>}
                  <div className="truncate font-semibold">{isMoving ? "Validando movimiento…" : isConfirmingResize ? "Confirmando fechas…" : isEventResizing ? "Ajustando fechas…" : isBlock ? BLOCK_LABELS[event.block_type ?? "other"] ?? "Bloqueada" : event.guest_name ?? event.label}</div>
                  <div className="truncate opacity-80">{isBlock ? event.label : `${STATUS_LABELS[normalizedStatus(event.status)] ?? event.status} · ${event.starts_on} → ${event.ends_on}`}</div>
                </button>
              </div>
            })}
          </div>
        </div> })}
      </div></div></CardContent></Card>
  </div>
  <AddReservationDialog open={newReservationOpen} onOpenChange={setNewReservationOpen} onSuccess={loadData} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedLocation={preselectedBed?.room.location_ref?.name} />
  <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}><DialogContent><DialogHeader><DialogTitle>Bloqueo de habitación</DialogTitle></DialogHeader>{selectedBlock && <div className="space-y-4"><Badge variant="secondary">{BLOCK_LABELS[selectedBlock.block_type] ?? selectedBlock.block_type}</Badge><Detail label="Motivo" value={selectedBlock.reason} /><div className="grid grid-cols-2 gap-4"><Detail label="Desde" value={selectedBlock.start_date} /><Detail label="Hasta" value={selectedBlock.end_date} /></div>{selectedBlock.notes && <Detail label="Notas" value={selectedBlock.notes} />}<Button asChild className="w-full"><Link href="/bookings/blocks">Administrar bloqueos</Link></Button></div>}</DialogContent></Dialog>
  <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>{selectedReservation && <div className="space-y-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Huésped</p><p className="text-xl font-semibold">{selectedReservation.guest_name}</p></div><Badge>{STATUS_LABELS[selectedReservation.status] ?? selectedReservation.status}</Badge></div><div className="grid grid-cols-2 gap-4 text-sm"><Detail label="Check-in" value={selectedReservation.check_in} /><Detail label="Check-out" value={selectedReservation.check_out} /><Detail label="Huéspedes" value={String(selectedReservation.num_guests ?? 1)} /><Detail label="Monto registrado" value={formatClp(Number(selectedReservation.total_amount ?? 0))} /></div>{selectedReservation.special_requests && <Detail label="Solicitudes especiales" value={selectedReservation.special_requests} />}<div className="flex flex-wrap justify-end gap-2 border-t pt-4">{normalizedStatus(selectedReservation.status) === "pending" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Confirmar reserva" onClick={() => updateReservationStatus(selectedReservation, "confirmed")} />}{normalizedStatus(selectedReservation.status) === "confirmed" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-in" onClick={() => updateReservationStatus(selectedReservation, "checked_in")} />}{normalizedStatus(selectedReservation.status) === "checked_in" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-out" onClick={() => updateReservationStatus(selectedReservation, "checked_out")} />}</div></div>}</DialogContent></Dialog>
  </div>
}

function ContextMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="flex items-start gap-3"><div className="mt-0.5 text-primary">{icon}</div><div><p className="text-sm font-medium">{label}</p><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div> }
function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card> }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div> }
function StatusButton({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) { return <Button onClick={onClick} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{label}</Button> }

"use client"

import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addDays, format, parseISO, startOfDay } from "date-fns"
import { Ban, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { bookingsCalendarPageCopy } from "@/lib/translations/bookings-calendar-page"
import { type ReservationResizeEdge, useReservationResizeState } from "./use-reservation-resize-state"
import { useFlipAnimation } from "./use-flip-animation"
import { useCalendarInteraction } from "./use-calendar-interaction"
import { TimelineGrid } from "@/components/calendar/timeline-grid"
import { DAY_WIDTH, normalizedStatus, STATUS_LABELS, BLOCK_LABELS } from "@/components/calendar/timeline-row"

interface Location { id: string; name: string }
interface Bed { id: string; bed_number: string; bed_type: string; room: { id: string; room_number: string; room_type?: string; location_id: string; location_ref?: { id: string; name: string } } }
interface CalendarEvent { event_id: string; event_type: "reservation" | "block"; bed_id: string; room_id: string; location_id: string; starts_on: string; ends_on: string; status: string; label: string; guest_name: string | null; block_type: string | null; source: string | null; total_amount: number | null }
interface Reservation { id: string; bed_id: string | null; guest_name: string; guest_email?: string | null; guest_phone?: string | null; check_in: string; check_out: string; status: string; num_guests?: number | null; total_amount?: number | null; special_requests?: string | null }
interface RoomBlock { id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; notes?: string | null; status: string }
interface ResizeRpcResult { success: boolean; message: string; check_in: string; check_out: string }
interface BulkConflict { reservation_id: string; reason: string }

function formatClp(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value) }
function intervalsOverlap(startA: string, endA: string, startB: string, endB: string) { return parseISO(startA) < parseISO(endB) && parseISO(endA) > parseISO(startB) }

export default function BookingsCalendarPage() {
  const { language } = useLanguage()
  const pageCopy = bookingsCalendarPageCopy[language]
  const blocksHref = `/${language}/bookings/blocks`
  const supabase = useMemo(() => createClient(), [])
  const [locations, setLocations] = useState<Location[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [locationId, setLocationId] = useState("all")
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [rangeDays, setRangeDays] = useState(14)
  const [startDate, setStartDate] = useState(startOfDay(new Date()))
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [preselectedBed, setPreselectedBed] = useState<Bed | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null)
  const [preselectedCheckOutDate, setPreselectedCheckOutDate] = useState<Date | null>(null)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<RoomBlock | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const { resizeState, resizingReservationId, confirmingReservationId, isResizing, beginResize, updatePreview, markConfirming, clearResize } = useReservationResizeState()
  const { captureRect, flipTo } = useFlipAnimation()
  const blockRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const pendingFlipIds = useRef<string[]>([])
  const isBulkModeRef = useRef(false)
  const loadEventsRef = useRef<() => Promise<void>>(async () => {})
  const loadInventoryRef = useRef<() => Promise<void>>(async () => {})
  const realtimeEventsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeInventoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (pendingFlipIds.current.length === 0) return
    const ids = pendingFlipIds.current
    pendingFlipIds.current = []
    for (const id of ids) flipTo(id, blockRefs.current.get(id) ?? null)
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkConflicts, setBulkConflicts] = useState<BulkConflict[]>([])
  const [lastOperationId, setLastOperationId] = useState<string | null>(null)
  const [undoExpiry, setUndoExpiry] = useState<Date | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => { setIsTouchDevice(() => window.matchMedia("(hover: none)").matches || "ontouchstart" in window) }, [])

  const endDate = useMemo(() => addDays(startDate, rangeDays), [startDate, rangeDays])
  const dates = useMemo(() => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)), [rangeDays, startDate])
  const timelineWidth = rangeDays * DAY_WIDTH
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(language === "es" ? "es-CL" : language === "de" ? "de-DE" : "en-US", { month: "long", year: "numeric" }).format(startDate), [language, startDate])

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true)
    const result = await supabase.from("beds").select(`id, bed_number, bed_type, room:rooms!inner(id, room_number, room_type, location_id, location_ref:locations!inner(id, name, is_active))`).eq("room.location_ref.is_active", true).order("room_id")
    if (result.error) setError(result.error.message)
    else {
      const loadedBeds = (result.data ?? []) as unknown as Bed[]
      const lodgingLocations = Array.from(new Map(loadedBeds.filter((bed) => bed.room.location_ref).map((bed) => [bed.room.location_ref!.id, { id: bed.room.location_ref!.id, name: bed.room.location_ref!.name }])).values()).sort((a, b) => a.name.localeCompare(b.name))
      setLocations(lodgingLocations)
      setBeds(loadedBeds)
    }
    setInventoryLoading(false)
  }, [supabase])

  const loadEvents = useCallback(async () => {
    setEventsLoading(true)
    const result = await supabase.rpc("get_booking_inventory_events", { p_start_date: format(startDate, "yyyy-MM-dd"), p_end_date: format(endDate, "yyyy-MM-dd"), p_location_id: null })
    if (result.error) setError(result.error.message)
    else setEvents((result.data ?? []) as CalendarEvent[])
    setEventsLoading(false)
  }, [endDate, startDate, supabase])

  loadEventsRef.current = loadEvents
  loadInventoryRef.current = loadInventory

  const {
    draggingEventId,
    dropTargetBedId,
    movingReservationId,
    moveConflict,
    creatingRange,
    draggingEvent,
    beginMove,
    updateMove,
    commitMove,
    cancelMove,
    beginCreation,
    abortCreation,
    commitCreation,
  } = useCalendarInteraction({
    supabase,
    events,
    setEvents,
    isResizing,
    confirmingReservationId,
    isBulkModeRef,
    captureRect,
    pendingFlipIds,
    blockRefs,
    onMoveComplete: () => loadEventsRef.current(),
  })

  useEffect(() => { void loadInventory() }, [loadInventory])
  useEffect(() => { void loadEvents() }, [loadEvents])

  useEffect(() => {
    const queueEvents = () => {
      if (realtimeEventsTimer.current) clearTimeout(realtimeEventsTimer.current)
      realtimeEventsTimer.current = setTimeout(() => void loadEventsRef.current(), 180)
    }
    const queueInventory = () => {
      if (realtimeInventoryTimer.current) clearTimeout(realtimeInventoryTimer.current)
      realtimeInventoryTimer.current = setTimeout(() => {
        void loadInventoryRef.current()
        queueEvents()
      }, 240)
    }
    const channel = supabase.channel("bookings-calendar-v7")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, queueEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, queueEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, queueInventory)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, queueInventory)
      .subscribe()
    return () => {
      if (realtimeEventsTimer.current) clearTimeout(realtimeEventsTimer.current)
      if (realtimeInventoryTimer.current) clearTimeout(realtimeInventoryTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [supabase])

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

  const searchTerm = search.trim().toLowerCase()
  const guestMatchedBedIds = useMemo(() => {
    if (!searchTerm) return new Set<string>()
    return new Set(events.filter((event) => (event.guest_name ?? event.label).toLowerCase().includes(searchTerm)).map((event) => event.bed_id))
  }, [events, searchTerm])
  const visibleBeds = useMemo(() => beds.filter((bed) => {
    if (locationId !== "all" && bed.room.location_id !== locationId) return false
    if (!searchTerm) return true
    const propertyName = bed.room.location_ref?.name?.toLowerCase() ?? ""
    return propertyName.includes(searchTerm) || bed.room.room_number.toLowerCase().includes(searchTerm) || bed.bed_number.toLowerCase().includes(searchTerm) || bed.bed_type.toLowerCase().includes(searchTerm) || guestMatchedBedIds.has(bed.id)
  }), [beds, guestMatchedBedIds, locationId, searchTerm])
  const visibleBedIds = useMemo(() => new Set(visibleBeds.map((bed) => bed.id)), [visibleBeds])
  const bedMatchesStructure = useMemo(() => {
    const result = new Set<string>()
    if (!searchTerm) return result
    for (const bed of beds) {
      const propertyName = bed.room.location_ref?.name?.toLowerCase() ?? ""
      if (propertyName.includes(searchTerm) || bed.room.room_number.toLowerCase().includes(searchTerm) || bed.bed_number.toLowerCase().includes(searchTerm) || bed.bed_type.toLowerCase().includes(searchTerm)) result.add(bed.id)
    }
    return result
  }, [beds, searchTerm])
  const visibleEvents = useMemo(() => events.filter((event) => {
    if (!visibleBedIds.has(event.bed_id)) return false
    if (event.event_type !== "block" && status !== "all" && normalizedStatus(event.status) !== status) return false
    if (!searchTerm) return true
    return bedMatchesStructure.has(event.bed_id) || (event.guest_name ?? event.label).toLowerCase().includes(searchTerm)
  }), [bedMatchesStructure, events, searchTerm, status, visibleBedIds])
  const visibleReservationEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "reservation"), [visibleEvents])
  const visibleBlockEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "block"), [visibleEvents])
  const eventsByBed = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    visibleEvents.forEach((event) => map.set(event.bed_id, [...(map.get(event.bed_id) ?? []), event]))
    return map
  }, [visibleEvents])
  const activeBlockCount = useMemo(() => new Set(visibleBlockEvents.map((event) => event.event_id)).size, [visibleBlockEvents])
  const visibleReservationCount = useMemo(() => new Set(visibleReservationEvents.map((event) => event.event_id)).size, [visibleReservationEvents])
  const resizeConflict = useMemo(() => {
    if (!resizeState) return null
    return events.find((event) => event.bed_id === resizeState.bedId && event.event_id !== resizeState.reservationId && intervalsOverlap(resizeState.previewStart, resizeState.previewEnd, event.starts_on, event.ends_on)) ?? null
  }, [events, resizeState])

  const selectedEvents = useMemo(() => visibleReservationEvents.filter((event) => selectedIds.has(event.event_id)), [visibleReservationEvents, selectedIds])
  const conflictIds = useMemo(() => new Set(bulkConflicts.map((conflict) => conflict.reservation_id)), [bulkConflicts])
  const isBulkMode = selectedIds.size > 0
  isBulkModeRef.current = isBulkMode

  function toggleSelect(eventId: string, _shiftKey: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId)
      return next
    })
    setBulkConflicts([])
  }
  function selectAll() { setSelectedIds(new Set(visibleReservationEvents.map((event) => event.event_id))); setBulkConflicts([]) }
  function clearSelection() { setSelectedIds(new Set()); setBulkConflicts([]) }

  function eventAt(bedId: string, date: Date, type: CalendarEvent["event_type"]) { return (eventsByBed.get(bedId) ?? []).find((event) => event.event_type === type && date >= parseISO(event.starts_on) && date < parseISO(event.ends_on)) }
  function geometryForDates(startsOn: string, endsOn: string) {
    const eventStart = parseISO(startsOn) < startDate ? startDate : parseISO(startsOn)
    const eventEnd = parseISO(endsOn) > endDate ? endDate : parseISO(endsOn)
    const offsetDays = Math.max(0, Math.round((eventStart.getTime() - startDate.getTime()) / 86400000))
    const durationDays = Math.max(1, Math.round((eventEnd.getTime() - eventStart.getTime()) / 86400000))
    return { left: offsetDays * DAY_WIDTH + 4, width: Math.max(24, durationDays * DAY_WIDTH - 8) }
  }
  function eventGeometry(event: CalendarEvent) { return geometryForDates(event.starts_on, event.ends_on) }

  function openNewReservation(bed: Bed, date: Date) {
    if (eventAt(bed.id, date, "block") || eventAt(bed.id, date, "reservation")) return
    setPreselectedBed(bed); setPreselectedDate(date); setPreselectedCheckOutDate(null); setNewReservationOpen(true)
  }
  function openReservationFromTimeline(bed: Bed, clientX: number, currentTarget: HTMLDivElement) {
    if (draggingEventId || isResizing || confirmingReservationId || isBulkMode) return
    const rect = currentTarget.getBoundingClientRect()
    const offset = Math.max(0, Math.min(timelineWidth - 1, clientX - rect.left))
    openNewReservation(bed, addDays(startDate, Math.floor(offset / DAY_WIDTH)))
  }

  function beginReservationResize(event: CalendarEvent, edge: ReservationResizeEdge, pointerEvent: React.PointerEvent<HTMLSpanElement>) {
    if (event.event_type !== "reservation" || movingReservationId || draggingEventId || confirmingReservationId || isBulkMode) return
    pointerEvent.preventDefault(); pointerEvent.stopPropagation(); pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    beginResize({ reservationId: event.event_id, bedId: event.bed_id, edge, pointerId: pointerEvent.pointerId, pointerStartX: pointerEvent.clientX, startsOn: event.starts_on, endsOn: event.ends_on })
  }
  function moveReservationResize(pointerEvent: React.PointerEvent<HTMLSpanElement>) {
    if (!resizeState || resizeState.pointerId !== pointerEvent.pointerId) return
    pointerEvent.preventDefault(); pointerEvent.stopPropagation()
    const deltaDays = Math.round((pointerEvent.clientX - resizeState.pointerStartX) / DAY_WIDTH)
    const originalStart = parseISO(resizeState.originalStart); const originalEnd = parseISO(resizeState.originalEnd)
    if (resizeState.edge === "left") {
      const candidate = addDays(originalStart, deltaDays); const latestStart = addDays(originalEnd, -1)
      updatePreview(format(candidate > latestStart ? latestStart : candidate, "yyyy-MM-dd"), resizeState.originalEnd)
    } else {
      const candidate = addDays(originalEnd, deltaDays); const earliestEnd = addDays(originalStart, 1)
      updatePreview(resizeState.originalStart, format(candidate < earliestEnd ? earliestEnd : candidate, "yyyy-MM-dd"))
    }
  }
  async function finishReservationResize(pointerEvent: React.PointerEvent<HTMLSpanElement>) {
    pointerEvent.preventDefault(); pointerEvent.stopPropagation()
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId)
    if (!resizeState || resizeState.pointerId !== pointerEvent.pointerId) { clearResize(); return }
    const pendingResize = resizeState
    if (pendingResize.previewStart === pendingResize.originalStart && pendingResize.previewEnd === pendingResize.originalEnd) { clearResize(); return }
    if (resizeConflict) { toast.error(resizeConflict.event_type === "block" ? "Las nuevas fechas chocan con un bloqueo" : "Las nuevas fechas chocan con otra reserva"); clearResize(); return }
    const previousEvents = events
    captureRect(pendingResize.reservationId, blockRefs.current.get(pendingResize.reservationId) ?? null)
    pendingFlipIds.current.push(pendingResize.reservationId)
    setEvents((current) => current.map((event) => event.event_type === "reservation" && event.event_id === pendingResize.reservationId ? { ...event, starts_on: pendingResize.previewStart, ends_on: pendingResize.previewEnd } : event))
    markConfirming(pendingResize.reservationId)
    const { data, error: resizeError } = await supabase.rpc("resize_booking_reservation", { p_reservation_id: pendingResize.reservationId, p_check_in: pendingResize.previewStart, p_check_out: pendingResize.previewEnd })
    const result = ((data ?? [])[0] ?? null) as ResizeRpcResult | null
    if (resizeError || !result?.success) {
      setEvents(previousEvents); setError(resizeError?.message ?? result?.message ?? "La disponibilidad cambió antes de confirmar las fechas"); toast.error("El cambio de fechas fue rechazado y se restauró la reserva"); clearResize(); return
    }
    setEvents((current) => current.map((event) => event.event_type === "reservation" && event.event_id === pendingResize.reservationId ? { ...event, starts_on: result.check_in, ends_on: result.check_out } : event))
    toast.success(`Reserva actualizada: ${result.check_in} → ${result.check_out}`); clearResize(); await loadEvents()
  }
  async function openReservation(event: CalendarEvent) {
    setError(null)
    const { data, error: detailError } = await supabase.from("reservations").select("id, bed_id, guest_name, guest_email, guest_phone, check_in, check_out, status, num_guests, total_amount, special_requests").eq("id", event.event_id).single()
    if (detailError) { setError(detailError.message); return }
    setSelectedReservation(data as Reservation)
  }
  async function openBlock(event: CalendarEvent) {
    setError(null)
    const { data, error: detailError } = await supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, notes, status").eq("id", event.event_id).single()
    if (detailError) { setError(detailError.message); return }
    setSelectedBlock(data as RoomBlock)
  }
  async function updateReservationStatus(reservation: Reservation, nextStatus: string) {
    setUpdatingStatus(reservation.id); setError(null)
    const { error: updateError } = await supabase.from("reservations").update({ status: nextStatus }).eq("id", reservation.id)
    if (updateError) setError(updateError.message); else { setSelectedReservation({ ...reservation, status: nextStatus }); await loadEvents() }
    setUpdatingStatus(null)
  }

  function armUndoTimer(operationId: string) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    const expiry = new Date(Date.now() + 30 * 60 * 1000)
    setLastOperationId(operationId); setUndoExpiry(expiry)
    undoTimerRef.current = setTimeout(() => { setLastOperationId(null); setUndoExpiry(null) }, 30 * 60 * 1000)
  }
  async function executeBulkStatus(nextStatus: string) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    try {
      const response = await fetch("/api/bookings/bulk/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], status: nextStatus }) })
      const data = await response.json()
      if (!response.ok || !data.success) { toast.error(data.error ?? "No fue posible actualizar el estado"); return }
      armUndoTimer(data.operation_id); toast.success(`${data.updated_count} reserva${data.updated_count !== 1 ? "s" : ""} actualizadas`); clearSelection(); await loadEvents()
    } catch { toast.error("Error de red al actualizar estado") } finally { setBulkLoading(false) }
  }
  async function executeBulkShift(daysDelta: number) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    const updates = selectedEvents.map((event) => ({ id: event.event_id, bed_id: event.bed_id, check_in: format(addDays(parseISO(event.starts_on), daysDelta), "yyyy-MM-dd"), check_out: format(addDays(parseISO(event.ends_on), daysDelta), "yyyy-MM-dd") }))
    try {
      const response = await fetch("/api/bookings/bulk/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], updates, operation_type: "move" }) })
      const data = await response.json()
      if (response.status === 409) { setBulkConflicts(data.conflicts ?? []); toast.error(data.error ?? "Conflictos detectados"); return }
      if (!response.ok || !data.success) { toast.error(data.error ?? "No fue posible mover las reservas"); return }
      armUndoTimer(data.operation_id); clearSelection(); await loadEvents()
    } catch { toast.error("Error de red al mover reservas") } finally { setBulkLoading(false) }
  }
  async function executeBulkExtend(daysExtend: number) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    const updates = selectedEvents.map((event) => ({ id: event.event_id, bed_id: event.bed_id, check_in: event.starts_on, check_out: format(addDays(parseISO(event.ends_on), daysExtend), "yyyy-MM-dd") }))
    try {
      const response = await fetch("/api/bookings/bulk/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], updates, operation_type: daysExtend > 0 ? "extend" : "reduce" }) })
      const data = await response.json()
      if (response.status === 409) { setBulkConflicts(data.conflicts ?? []); toast.error(data.error ?? "Conflictos detectados"); return }
      if (!response.ok || !data.success) { toast.error(data.error ?? "No fue posible modificar las reservas"); return }
      armUndoTimer(data.operation_id); clearSelection(); await loadEvents()
    } catch { toast.error("Error de red al modificar reservas") } finally { setBulkLoading(false) }
  }
  async function executeBulkDelete() {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    try {
      const response = await fetch("/api/bookings/bulk/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds] }) })
      const data = await response.json()
      if (!response.ok || !data.success) { toast.error(data.error ?? "No fue posible eliminar las reservas"); return }
      clearSelection(); await loadEvents()
    } catch { toast.error("Error de red al eliminar reservas") } finally { setBulkLoading(false) }
  }
  async function undoLastOperation() {
    if (!lastOperationId || bulkLoading) return
    setBulkLoading(true)
    try {
      const response = await fetch("/api/bookings/bulk/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: lastOperationId }) })
      const data = await response.json()
      if (!response.ok || !data.success) { toast.error(data.error ?? "No fue posible deshacer la operación"); return }
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      setLastOperationId(null); setUndoExpiry(null); await loadEvents()
    } catch { toast.error("Error de red al deshacer") } finally { setBulkLoading(false) }
  }

  const loading = inventoryLoading || eventsLoading

  return <div className="min-h-screen bg-background"><div className="mx-auto space-y-2">
    <div className="flex min-h-12 flex-wrap items-center gap-2 border-b px-2 py-2">
      <div className="mr-2 min-w-[180px]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{pageCopy.eyebrow}</p><h1 className="text-lg font-semibold tracking-tight">{pageCopy.title}</h1></div>
      <div className="flex items-center gap-1 border-l pl-2">
        <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, -rangeDays))} aria-label="Previous dates"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="min-w-[150px] px-2 text-center"><div className="text-xs font-semibold capitalize">{monthLabel}</div><div className="text-[10px] text-muted-foreground">{format(startDate, "dd MMM")} — {format(addDays(endDate, -1), "dd MMM")}</div></div>
        <Button variant="outline" size="icon" onClick={() => setStartDate(addDays(startDate, rangeDays))} aria-label="Next dates"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}><CalendarDays className="mr-1.5 h-4 w-4" />{pageCopy.today}</Button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href={blocksHref}><Ban className="mr-1.5 h-4 w-4" />{pageCopy.manageBlocks}</Link></Button>
        <Button onClick={() => { setPreselectedBed(null); setPreselectedDate(null); setPreselectedCheckOutDate(null); setNewReservationOpen(true) }}><Plus className="mr-1.5 h-4 w-4" />{pageCopy.newReservation}</Button>
      </div>
    </div>

    <div className="flex flex-col gap-2 border-b px-2 pb-2 xl:flex-row xl:items-center">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar huésped, propiedad, habitación o cama" /></div>
      <Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="h-9 w-full xl:w-52"><SelectValue placeholder="Alojamiento" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los alojamientos</SelectItem>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-full xl:w-40"><SelectValue placeholder="Estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="confirmed">Confirmada</SelectItem><SelectItem value="checked_in">Check-in</SelectItem><SelectItem value="checked_out">Check-out</SelectItem></SelectContent></Select>
      <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}><SelectTrigger className="h-9 w-full xl:w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 días</SelectItem><SelectItem value="14">14 días</SelectItem><SelectItem value="21">21 días</SelectItem><SelectItem value="30">30 días</SelectItem></SelectContent></Select>
      <div className="whitespace-nowrap px-1 text-[10px] text-muted-foreground">{visibleBeds.length} camas · {visibleReservationCount} reservas · {activeBlockCount} bloqueos</div>
    </div>

    {error && <div className="mx-2 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}
    {bulkConflicts.length > 0 && <div className="mx-2 border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-500">{bulkConflicts.length} conflicto{bulkConflicts.length !== 1 ? "s" : ""} detectado{bulkConflicts.length !== 1 ? "s" : ""}.</div>}
    {lastOperationId && undoSecondsLeft > 0 && <div className="mx-2 flex items-center gap-3 border bg-primary/5 px-3 py-2"><RotateCcw className="h-4 w-4 text-primary" /><p className="flex-1 text-xs">Operación completada · deshacer disponible {undoSecondsLeft}s</p><Button size="sm" variant="outline" onClick={undoLastOperation} disabled={bulkLoading}>Deshacer</Button></div>}

    <Card className="overflow-hidden border-x-0 border-b-0">
      {isBulkMode && <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2">
        <span className="text-sm font-semibold text-primary">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
        <Button size="sm" variant="outline" onClick={selectAll} disabled={bulkLoading}><CheckSquare className="mr-1 h-3.5 w-3.5" />Todas</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkShift(-1)} disabled={bulkLoading}>-1 día</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkShift(1)} disabled={bulkLoading}>+1 día</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkShift(7)} disabled={bulkLoading}>+7 días</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkExtend(1)} disabled={bulkLoading}>Extender +1</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkExtend(-1)} disabled={bulkLoading}>Reducir -1</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkStatus("confirmed")} disabled={bulkLoading}>Confirmar</Button>
        <Button size="sm" variant="outline" onClick={() => executeBulkStatus("checked_in")} disabled={bulkLoading}>Check-in</Button>
        <Button size="sm" variant="destructive" onClick={executeBulkDelete} disabled={bulkLoading}><Trash2 className="mr-1 h-3.5 w-3.5" />Eliminar</Button>
        <div className="ml-auto flex items-center gap-2">{bulkLoading && <Loader2 className="h-4 w-4 animate-spin" />}<Button size="sm" variant="ghost" onClick={clearSelection}><X className="mr-1 h-3.5 w-3.5" />Limpiar</Button></div>
      </div>}

      <TimelineGrid
        dates={dates} rangeDays={rangeDays} timelineWidth={timelineWidth} isTouchDevice={isTouchDevice} visibleBeds={visibleBeds} loading={loading}
        eventsByBed={eventsByBed} selectedIds={selectedIds} conflictIds={conflictIds} isBulkMode={isBulkMode} visibleReservationEvents={visibleReservationEvents}
        onToggleSelect={toggleSelect} onSelectAll={selectAll} onClearSelection={clearSelection}
        draggingEventId={draggingEventId} dropTargetBedId={dropTargetBedId} movingReservationId={movingReservationId} draggingEvent={draggingEvent}
        onEventPointerDown={(event, pointerEvent) => beginMove(event, pointerEvent)} onEventPointerMove={(_event, pointerEvent) => void updateMove(pointerEvent, visibleBeds)} onEventPointerUp={(_event, pointerEvent) => void commitMove(pointerEvent, visibleBeds)} onEventPointerCancel={cancelMove} moveConflict={moveConflict}
        creatingRange={creatingRange} onCreationStart={beginCreation} onCreationAbort={abortCreation} onCreationCommit={(range) => { commitCreation(range); const bed = visibleBeds.find((item) => item.id === range.bedId); if (bed) { setPreselectedBed(bed); setPreselectedDate(parseISO(range.startDate)); setPreselectedCheckOutDate(parseISO(range.endDate)); setNewReservationOpen(true) } }}
        resizeState={resizeState} resizingReservationId={resizingReservationId} confirmingReservationId={confirmingReservationId} isResizing={isResizing} resizeConflict={resizeConflict}
        onBeginResize={beginReservationResize} onMoveResize={moveReservationResize} onFinishResize={finishReservationResize} onClearResize={clearResize}
        blockRefCallback={(eventId, element) => { if (element) blockRefs.current.set(eventId, element); else blockRefs.current.delete(eventId) }}
        eventGeometry={eventGeometry} geometryForDates={geometryForDates} onRowClick={openReservationFromTimeline} onOpenReservation={(event) => void openReservation(event)} onOpenBlock={(event) => void openBlock(event)}
      />
    </Card>

    <AddReservationDialog open={newReservationOpen} onOpenChange={setNewReservationOpen} onSuccess={loadEvents} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedCheckOut={preselectedCheckOutDate ?? undefined} preselectedLocation={preselectedBed?.room.location_ref?.name} />
    <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}><DialogContent><DialogHeader><DialogTitle>Bloqueo de habitación</DialogTitle></DialogHeader>{selectedBlock && <div className="space-y-4"><Badge variant="secondary">{BLOCK_LABELS[selectedBlock.block_type] ?? selectedBlock.block_type}</Badge><Detail label="Motivo" value={selectedBlock.reason} /><div className="grid grid-cols-2 gap-4"><Detail label="Desde" value={selectedBlock.start_date} /><Detail label="Hasta" value={selectedBlock.end_date} /></div>{selectedBlock.notes && <Detail label="Notas" value={selectedBlock.notes} />}<Button asChild className="w-full"><Link href={blocksHref}>Administrar bloqueos</Link></Button></div>}</DialogContent></Dialog>
    <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Detalle de reserva</DialogTitle></DialogHeader>{selectedReservation && <div className="space-y-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Huésped</p><p className="text-xl font-semibold">{selectedReservation.guest_name}</p></div><Badge>{STATUS_LABELS[selectedReservation.status] ?? selectedReservation.status}</Badge></div><div className="grid grid-cols-2 gap-4 text-sm"><Detail label="Check-in" value={selectedReservation.check_in} /><Detail label="Check-out" value={selectedReservation.check_out} /><Detail label="Huéspedes" value={String(selectedReservation.num_guests ?? 1)} /><Detail label="Monto registrado" value={formatClp(Number(selectedReservation.total_amount ?? 0))} /></div>{selectedReservation.special_requests && <Detail label="Solicitudes especiales" value={selectedReservation.special_requests} />}<div className="flex flex-wrap justify-end gap-2 border-t pt-4">{normalizedStatus(selectedReservation.status) === "pending" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Confirmar reserva" onClick={() => updateReservationStatus(selectedReservation, "confirmed")} />}{normalizedStatus(selectedReservation.status) === "confirmed" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-in" onClick={() => updateReservationStatus(selectedReservation, "checked_in")} />}{normalizedStatus(selectedReservation.status) === "checked_in" && <StatusButton loading={updatingStatus === selectedReservation.id} label="Registrar check-out" onClick={() => updateReservationStatus(selectedReservation, "checked_out")} />}</div></div>}</DialogContent></Dialog>
  </div></div>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div> }
function StatusButton({ loading, label, onClick }: { loading: boolean; label: string; onClick: () => void }) { return <Button onClick={onClick} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{label}</Button> }

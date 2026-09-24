"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { Ban, Bell, BedDouble, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Loader2, Plus, Printer, RefreshCw, RotateCcw, Search, Trash2, UserCircle, X } from "lucide-react"
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
import { bookingDateFromKey, bookingTodayDate } from "@/lib/booking/timezone"
import { type ReservationResizeEdge, useReservationResizeState } from "./use-reservation-resize-state"
import { useFlipAnimation } from "./use-flip-animation"
import { useCalendarInteraction } from "./use-calendar-interaction"
import { TimelineGrid } from "@/components/calendar/timeline-grid"
import { normalizedStatus } from "@/components/calendar/timeline-row"

interface Location { id: string; name: string }
interface Bed { id: string; bed_number: string; bed_type: string; room: { id: string; room_number: string; room_type?: string; location_id: string; location_ref?: { id: string; name: string } } }
interface CalendarEvent { event_id: string; event_type: "reservation" | "block"; bed_id: string; room_id: string; location_id: string; starts_on: string; ends_on: string; status: string; label: string; guest_name: string | null; block_type: string | null; source: string | null; total_amount: number | null }
interface RoomBlock { id: string; room_id: string; start_date: string; end_date: string; block_type: string; reason: string; notes?: string | null; status: string }
interface ResizeRpcResult { success: boolean; message: string; check_in: string; check_out: string }
interface BulkConflict { reservation_id: string; reason: string }

const DAY_WIDTH = 46
function intervalsOverlap(startA: string, endA: string, startB: string, endB: string) { return parseISO(startA) < parseISO(endB) && parseISO(endA) > parseISO(startB) }

export default function BookingsCalendarPage() {
  const { language } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pageCopy = bookingsCalendarPageCopy[language]
  const dateLocale = language === "es" ? es : language === "de" ? de : enUS
  const blocksHref = `/${language}/bookings/blocks`
  const supabase = useMemo(() => createClient(), [])
  const [locations, setLocations] = useState<Location[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [locationId, setLocationId] = useState("all")
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [rangeDays, setRangeDays] = useState(33)
  const [startDate, setStartDate] = useState(() => { const requested = searchParams.get("date"); return requested && /^\\d{4}-\\d{2}-\\d{2}$/.test(requested) ? bookingDateFromKey(requested) : bookingTodayDate() })
  const [inventoryReady, setInventoryReady] = useState(false)
  const [eventsReady, setEventsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [preselectedBed, setPreselectedBed] = useState<Bed | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null)
  const [preselectedCheckOutDate, setPreselectedCheckOutDate] = useState<Date | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<RoomBlock | null>(null)
  const { resizeState, resizingReservationId, confirmingReservationId, isResizing, beginResize, updatePreview, markConfirming, clearResize } = useReservationResizeState()
  const { captureRect, flipTo } = useFlipAnimation()
  const blockRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const pendingFlipIds = useRef<string[]>([])
  const isBulkModeRef = useRef(false)
  const loadEventsRef = useRef<() => Promise<void>>(async () => {})
  const realtimeEventsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeInventoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

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
  useEffect(() => { if (searchParams.get("new") === "1") { setPreselectedBed(null); setPreselectedDate(null); setPreselectedCheckOutDate(null); setNewReservationOpen(true) } }, [searchParams])

  const endDate = useMemo(() => addDays(startDate, rangeDays), [startDate, rangeDays])
  const dates = useMemo(() => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)), [rangeDays, startDate])
  const timelineWidth = rangeDays * DAY_WIDTH

  const loadInventory = useCallback(async () => {
    const bedsResult = await supabase.from("beds").select(`id, bed_number, bed_type, room:rooms!inner(id, room_number, room_type, location_id, location_ref:locations!inner(id, name, is_active))`).eq("room.location_ref.is_active", true).order("room_id")
    if (bedsResult.error) { setError(bedsResult.error.message); return }
    const loadedBeds = (bedsResult.data ?? []) as unknown as Bed[]
    const lodgingLocations = Array.from(new Map(loadedBeds.filter((bed) => bed.room.location_ref).map((bed) => [bed.room.location_ref!.id, { id: bed.room.location_ref!.id, name: bed.room.location_ref!.name }])).values()).sort((a, b) => a.name.localeCompare(b.name))
    setLocations(lodgingLocations)
    setBeds(loadedBeds)
  }, [supabase])

  const loadEvents = useCallback(async () => {
    const eventsResult = await supabase.rpc("get_booking_inventory_events", {
      p_start_date: format(startDate, "yyyy-MM-dd"),
      p_end_date: format(endDate, "yyyy-MM-dd"),
      p_location_id: locationId === "all" ? null : locationId,
    })
    if (eventsResult.error) setError(eventsResult.error.message)
    else setEvents((eventsResult.data ?? []) as CalendarEvent[])
  }, [endDate, locationId, startDate, supabase])

  loadEventsRef.current = loadEvents

  const refreshEvents = useCallback(async () => {
    setError(null)
    await loadEvents()
  }, [loadEvents])

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

  useEffect(() => {
    let active = true
    setError(null)
    void loadInventory().finally(() => { if (active) setInventoryReady(true) })
    return () => { active = false }
  }, [loadInventory])

  useEffect(() => {
    let active = true
    setError(null)
    void loadEvents().finally(() => { if (active) setEventsReady(true) })
    return () => { active = false }
  }, [loadEvents])
  useEffect(() => {
    const scheduleEvents = () => {
      if (realtimeEventsTimer.current) clearTimeout(realtimeEventsTimer.current)
      realtimeEventsTimer.current = setTimeout(() => void loadEventsRef.current(), 180)
    }
    const scheduleInventory = () => {
      if (realtimeInventoryTimer.current) clearTimeout(realtimeInventoryTimer.current)
      realtimeInventoryTimer.current = setTimeout(() => { void loadInventory(); void loadEventsRef.current() }, 220)
    }
    const channel = supabase.channel("bookings-calendar-v7")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, scheduleEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, scheduleEvents)
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, scheduleInventory)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, scheduleInventory)
      .subscribe()
    return () => {
      if (realtimeEventsTimer.current) clearTimeout(realtimeEventsTimer.current)
      if (realtimeInventoryTimer.current) clearTimeout(realtimeInventoryTimer.current)
      supabase.removeChannel(channel)
    }
  }, [loadInventory, supabase])

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

  const loading = !inventoryReady || !eventsReady
  const searchTerm = search.trim().toLowerCase()
  const roomMatchedBedIds = useMemo(() => {
    const matched = new Set<string>()
    if (!searchTerm) return matched
    for (const bed of beds) {
      const propertyName = bed.room.location_ref?.name?.toLowerCase() ?? ""
      if (propertyName.includes(searchTerm) || bed.room.room_number.toLowerCase().includes(searchTerm) || bed.bed_number.toLowerCase().includes(searchTerm) || bed.bed_type.toLowerCase().includes(searchTerm)) matched.add(bed.id)
    }
    return matched
  }, [beds, searchTerm])
  const guestMatchedBedIds = useMemo(() => {
    const matched = new Set<string>()
    if (!searchTerm) return matched
    for (const event of events) {
      const searchableLabel = `${event.guest_name ?? ""} ${event.label ?? ""}`.toLowerCase()
      if (searchableLabel.includes(searchTerm)) matched.add(event.bed_id)
    }
    return matched
  }, [events, searchTerm])
  const visibleBeds = useMemo(() => beds.filter((bed) => (locationId === "all" || bed.room.location_id === locationId) && (!searchTerm || roomMatchedBedIds.has(bed.id) || guestMatchedBedIds.has(bed.id))), [beds, guestMatchedBedIds, locationId, roomMatchedBedIds, searchTerm])
  const visibleBedIds = useMemo(() => new Set(visibleBeds.map((bed) => bed.id)), [visibleBeds])
  const visibleEvents = useMemo(() => events.filter((event) => {
    if (!visibleBedIds.has(event.bed_id)) return false
    if (event.event_type !== "block" && status !== "all" && normalizedStatus(event.status) !== status) return false
    if (!searchTerm || roomMatchedBedIds.has(event.bed_id)) return true
    return `${event.guest_name ?? ""} ${event.label ?? ""}`.toLowerCase().includes(searchTerm)
  }), [events, roomMatchedBedIds, searchTerm, status, visibleBedIds])
  const visibleReservationEvents = useMemo(() => visibleEvents.filter((event) => event.event_type === "reservation"), [visibleEvents])
  const eventsByBed = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    visibleEvents.forEach((event) => {
      const list = map.get(event.bed_id)
      if (list) list.push(event)
      else map.set(event.bed_id, [event])
    })
    return map
  }, [visibleEvents])
  const availabilityEventsByBed = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const list = map.get(event.bed_id)
      if (list) list.push(event)
      else map.set(event.bed_id, [event])
    })
    return map
  }, [events])
  const resizeConflict = useMemo(() => {
    if (!resizeState) return null
    return events.find((event) => event.bed_id === resizeState.bedId && event.event_id !== resizeState.reservationId && intervalsOverlap(resizeState.previewStart, resizeState.previewEnd, event.starts_on, event.ends_on)) ?? null
  }, [events, resizeState])

  const selectedEvents = useMemo(() => visibleReservationEvents.filter((event) => selectedIds.has(event.event_id)), [visibleReservationEvents, selectedIds])
  const conflictIds = useMemo(() => new Set(bulkConflicts.map((conflict) => conflict.reservation_id)), [bulkConflicts])
  const isBulkMode = selectedIds.size > 0
  isBulkModeRef.current = isBulkMode

  function toggleSelect(eventId: string) {
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
  function geometryForDates(startsOn: string, endsOn: string) { const eventStart = parseISO(startsOn) < startDate ? startDate : parseISO(startsOn); const eventEnd = parseISO(endsOn) > endDate ? endDate : parseISO(endsOn); const offsetDays = Math.max(0, differenceInCalendarDays(eventStart, startDate)); const durationDays = Math.max(1, differenceInCalendarDays(eventEnd, eventStart)); return { left: offsetDays * DAY_WIDTH + 2, width: Math.max(22, durationDays * DAY_WIDTH - 4) } }
  function eventGeometry(event: CalendarEvent) { return geometryForDates(event.starts_on, event.ends_on) }

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
    if (resizeConflict) { toast.error(resizeConflict.event_type === "block" ? pageCopy.resizeBlockConflict : pageCopy.resizeReservationConflict); clearResize(); return }
    const previousEvents = events
    setError(null)
    captureRect(pendingResize.reservationId, blockRefs.current.get(pendingResize.reservationId) ?? null)
    pendingFlipIds.current.push(pendingResize.reservationId)
    setEvents((current) => current.map((event) => event.event_type === "reservation" && event.event_id === pendingResize.reservationId ? { ...event, starts_on: pendingResize.previewStart, ends_on: pendingResize.previewEnd } : event))
    markConfirming(pendingResize.reservationId)
    const { data, error: resizeError } = await supabase.rpc("resize_booking_reservation", { p_reservation_id: pendingResize.reservationId, p_check_in: pendingResize.previewStart, p_check_out: pendingResize.previewEnd })
    const result = ((data ?? [])[0] ?? null) as ResizeRpcResult | null
    if (resizeError || !result?.success) {
      captureRect(pendingResize.reservationId, blockRefs.current.get(pendingResize.reservationId) ?? null)
      pendingFlipIds.current.push(pendingResize.reservationId)
      setEvents(previousEvents); const message = resizeError?.message ?? result?.message ?? pageCopy.resizeChanged; setError(message); toast.error(pageCopy.resizeRejected); clearResize(); return
    }
    captureRect(pendingResize.reservationId, blockRefs.current.get(pendingResize.reservationId) ?? null)
    pendingFlipIds.current.push(pendingResize.reservationId)
    setEvents((current) => current.map((event) => event.event_type === "reservation" && event.event_id === pendingResize.reservationId ? { ...event, starts_on: result.check_in, ends_on: result.check_out } : event))
    toast.success(`${pageCopy.reservationUpdated}: ${result.check_in} → ${result.check_out}`); clearResize(); await refreshEvents()
  }
  async function openBlock(event: CalendarEvent) { setError(null); const { data, error: detailError } = await supabase.from("room_blocks").select("id, room_id, start_date, end_date, block_type, reason, notes, status").eq("id", event.event_id).single(); if (detailError) { setError(detailError.message); return }; setSelectedBlock(data as RoomBlock) }

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
      if (!res.ok || !data.success) { toast.error(data.error ?? pageCopy.statusUpdateFailed); return }
      const nextLabel = nextStatus === "pending" ? pageCopy.pending : nextStatus === "confirmed" ? pageCopy.confirmed : nextStatus === "checked_in" ? pageCopy.checkedIn : nextStatus === "checked_out" ? pageCopy.completed : nextStatus; armUndoTimer(data.operation_id); toast.success(`${data.updated_count} ${pageCopy.modified} · ${nextLabel}`); clearSelection(); await refreshEvents()
    } catch { toast.error(pageCopy.statusNetworkError) } finally { setBulkLoading(false) }
  }

  async function executeBulkShift(daysDelta: number) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    const updates = selectedEvents.map((event) => ({ id: event.event_id, bed_id: event.bed_id, check_in: format(addDays(parseISO(event.starts_on), daysDelta), "yyyy-MM-dd"), check_out: format(addDays(parseISO(event.ends_on), daysDelta), "yyyy-MM-dd") }))
    try {
      const res = await fetch("/api/bookings/bulk/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], updates, operation_type: "move" }) })
      const data = await res.json()
      if (res.status === 409) { setBulkConflicts(data.conflicts ?? []); toast.error(data.error ?? pageCopy.conflictsDetected); return }
      if (!res.ok || !data.success) { toast.error(data.error ?? pageCopy.moveFailed); return }
      armUndoTimer(data.operation_id); toast.success(`${data.updated_count} ${pageCopy.moved}`); clearSelection(); await refreshEvents()
    } catch { toast.error(pageCopy.moveNetworkError) } finally { setBulkLoading(false) }
  }

  async function executeBulkExtend(daysExtend: number) {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    const updates = selectedEvents.map((event) => ({ id: event.event_id, bed_id: event.bed_id, check_in: event.starts_on, check_out: format(addDays(parseISO(event.ends_on), daysExtend), "yyyy-MM-dd") }))
    try {
      const res = await fetch("/api/bookings/bulk/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds], updates, operation_type: daysExtend > 0 ? "extend" : "reduce" }) })
      const data = await res.json()
      if (res.status === 409) { setBulkConflicts(data.conflicts ?? []); toast.error(data.error ?? pageCopy.conflictsDetected); return }
      if (!res.ok || !data.success) { toast.error(data.error ?? pageCopy.networkModifyError); return }
      armUndoTimer(data.operation_id); toast.success(`${data.updated_count} ${pageCopy.modified}`); clearSelection(); await refreshEvents()
    } catch { toast.error(pageCopy.networkModifyError) } finally { setBulkLoading(false) }
  }

  async function executeBulkDelete() {
    if (selectedIds.size === 0 || bulkLoading) return
    setBulkLoading(true); setBulkConflicts([])
    try {
      const res = await fetch("/api/bookings/bulk/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_ids: [...selectedIds] }) })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? pageCopy.deleteFailed); return }
      toast.success(`${data.deleted_count} ${pageCopy.deleted}`); clearSelection(); await refreshEvents()
    } catch { toast.error(pageCopy.networkDeleteError) } finally { setBulkLoading(false) }
  }

  async function undoLastOperation() {
    if (!lastOperationId || bulkLoading) return
    setBulkLoading(true)
    try {
      const res = await fetch("/api/bookings/bulk/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: lastOperationId }) })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? pageCopy.undoFailed); return }
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      setLastOperationId(null); setUndoExpiry(null); toast.success(`${pageCopy.undo}: ${data.restored_count} ${pageCopy.restored}`); await refreshEvents()
    } catch { toast.error(pageCopy.networkUndoError) } finally { setBulkLoading(false) }
  }

  const rangeLabel = `${format(startDate, "dd MMM", { locale: dateLocale })} - ${format(addDays(endDate, -1), "dd MMM", { locale: dateLocale })}`
  const monthValue = format(startDate, "yyyy-MM")
  const addLabel = language === "es" ? "Agregar" : language === "de" ? "Hinzufügen" : "Add"

  return <div className="min-h-screen bg-[#101314]">
    <div className="sticky top-0 z-50 border-b border-white/10 bg-[#17191a]">
      <div className="flex min-h-12 items-center gap-1.5 overflow-x-auto px-2 py-1.5">
        <Input type="month" value={monthValue} onChange={(event) => { if (event.target.value) setStartDate(bookingDateFromKey(`${event.target.value}-01`)) }} className="h-8 w-[160px] shrink-0 border-white/10 bg-[#111314] text-xs" aria-label={pageCopy.month} />
        <Button variant="outline" size="sm" className="h-8 shrink-0 border-emerald-600 px-3 text-emerald-400 hover:bg-emerald-950" onClick={() => setStartDate(bookingTodayDate())}><CalendarDays className="mr-1.5 h-3.5 w-3.5" />{pageCopy.today}</Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setStartDate(addDays(startDate, -rangeDays))}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="min-w-[108px] shrink-0 text-center text-[11px] font-medium text-white/75">{rangeLabel}</div>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setStartDate(addDays(startDate, rangeDays))}><ChevronRight className="h-4 w-4" /></Button>
        <div className="ml-auto flex items-center gap-1.5" aria-label="Calendar actions">
          <Button size="sm" className="h-8 shrink-0 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500" onClick={() => { setPreselectedBed(null); setPreselectedDate(null); setPreselectedCheckOutDate(null); setNewReservationOpen(true) }}><Plus className="mr-1 h-3.5 w-3.5" />{addLabel}</Button>
          <Button variant="outline" size="icon" className={`h-8 w-8 shrink-0 ${showFilters ? "border-emerald-600 text-emerald-400" : ""}`} title={pageCopy.search} aria-label={pageCopy.search} aria-expanded={showFilters} onClick={() => { setShowFilters((current) => !current); window.setTimeout(() => searchInputRef.current?.focus(), 0) }}><Search className="h-4 w-4" /></Button>
          <Button asChild variant="outline" size="icon" className="relative h-8 w-8 shrink-0" title={pageCopy.tasksAlerts} aria-label={pageCopy.tasksAlerts}><Link href={`/${language}/bookings/operations`}><Bell className="h-4 w-4" /></Link></Button>
          <details className="group relative">
            <summary aria-label={language === "es" ? "Más acciones" : language === "de" ? "Weitere Aktionen" : "More actions"} className="flex h-8 w-8 cursor-pointer list-none items-center justify-center border border-white/10 bg-[#111314] text-lg leading-none text-white/65 hover:bg-white/5 hover:text-white marker:hidden">⋯</summary>
            <div className="absolute right-0 top-9 z-[70] w-48 border border-white/10 bg-[#17191a] p-1 shadow-xl">
              <button type="button" onClick={() => window.print()} className="flex h-8 w-full items-center gap-2 px-2 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"><Printer className="h-3.5 w-3.5" />{pageCopy.print}</button>
              <Link href={`/${language}/bookings/rooms`} className="flex h-8 items-center gap-2 px-2 text-xs text-white/70 hover:bg-white/5 hover:text-white"><BedDouble className="h-3.5 w-3.5" />{pageCopy.roomsBeds}</Link>
              <button type="button" onClick={() => void refreshEvents()} className="flex h-8 w-full items-center gap-2 px-2 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"><RefreshCw className="h-3.5 w-3.5" />{pageCopy.refresh}</button>
              <Link href={`/${language}/bookings/profile`} className="flex h-8 items-center gap-2 px-2 text-xs text-white/70 hover:bg-white/5 hover:text-white"><UserCircle className="h-3.5 w-3.5" />{pageCopy.profile}</Link>
            </div>
          </details>
        </div>
      </div>
{showFilters && <div className="flex min-h-9 items-center gap-1.5 overflow-x-auto border-t border-white/5 px-2 py-1">
        <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1.5 h-4 w-4 text-white/35" /><Input ref={searchInputRef} className="h-7 border-white/10 bg-[#111314] pl-9 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={pageCopy.searchPlaceholder} /></div>
        <Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="h-7 w-44 shrink-0 border-white/10 bg-[#111314] text-xs"><SelectValue placeholder={pageCopy.property} /></SelectTrigger><SelectContent><SelectItem value="all">{pageCopy.allProperties}</SelectItem>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-7 w-36 shrink-0 border-white/10 bg-[#111314] text-xs"><SelectValue placeholder={pageCopy.allStatuses} /></SelectTrigger><SelectContent><SelectItem value="all">{pageCopy.allStatuses}</SelectItem><SelectItem value="pending">{pageCopy.pending}</SelectItem><SelectItem value="confirmed">{pageCopy.confirmed}</SelectItem><SelectItem value="checked_in">{pageCopy.checkedIn}</SelectItem><SelectItem value="checked_out">{pageCopy.completed}</SelectItem></SelectContent></Select>
        <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}><SelectTrigger className="h-7 w-24 shrink-0 border-white/10 bg-[#111314] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 {pageCopy.days}</SelectItem><SelectItem value="14">14 {pageCopy.days}</SelectItem><SelectItem value="19">19 {pageCopy.days}</SelectItem><SelectItem value="30">30 {pageCopy.days}</SelectItem><SelectItem value="33">33 {pageCopy.days}</SelectItem></SelectContent></Select>
      </div>}
    </div>

    {error && <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</div>}
    {bulkConflicts.length > 0 && <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">{bulkConflicts.length} {pageCopy.conflicts}.</div>}
    {lastOperationId && undoSecondsLeft > 0 && <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2"><RotateCcw className="h-4 w-4 text-primary" /><p className="flex-1 text-xs">{pageCopy.operationComplete} · {undoSecondsLeft}s {pageCopy.undoWindow}.</p><Button size="sm" variant="outline" onClick={undoLastOperation} disabled={bulkLoading}>{pageCopy.undo}</Button></div>}

    <Card className="overflow-hidden border-0 bg-transparent shadow-none">
      {isBulkMode && <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-primary/5 px-3 py-2"><span className="mr-1 text-xs font-semibold text-primary">{selectedIds.size} {pageCopy.selected}</span><Button size="sm" variant="outline" onClick={selectAll} disabled={bulkLoading}><CheckSquare className="mr-1.5 h-3.5 w-3.5" />{pageCopy.all}</Button><Button size="sm" variant="outline" onClick={() => executeBulkShift(-1)} disabled={bulkLoading}>-1 {pageCopy.shiftDay}</Button><Button size="sm" variant="outline" onClick={() => executeBulkShift(1)} disabled={bulkLoading}>+1 {pageCopy.shiftDay}</Button><Button size="sm" variant="outline" onClick={() => executeBulkShift(7)} disabled={bulkLoading}>+7 {pageCopy.days}</Button><Button size="sm" variant="outline" onClick={() => executeBulkExtend(1)} disabled={bulkLoading}>{pageCopy.extend} +1</Button><Button size="sm" variant="outline" onClick={() => executeBulkExtend(-1)} disabled={bulkLoading}>{pageCopy.reduce} -1</Button><Button size="sm" variant="outline" onClick={() => executeBulkStatus("confirmed")} disabled={bulkLoading}>{pageCopy.confirmAction}</Button><Button size="sm" variant="outline" onClick={() => executeBulkStatus("checked_in")} disabled={bulkLoading}>{pageCopy.checkInAction}</Button><Button size="sm" variant="outline" onClick={() => executeBulkStatus("cancelled")} disabled={bulkLoading}>{pageCopy.cancel}</Button><Button size="sm" variant="destructive" onClick={executeBulkDelete} disabled={bulkLoading}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{pageCopy.delete}</Button><div className="ml-auto flex items-center gap-2">{bulkLoading && <Loader2 className="h-4 w-4 animate-spin" />}<Button size="sm" variant="ghost" onClick={clearSelection}><X className="mr-1.5 h-3.5 w-3.5" />{pageCopy.clear}</Button></div></div>}

      <TimelineGrid
        dates={dates}
        rangeDays={rangeDays}
        timelineWidth={timelineWidth}
        isTouchDevice={isTouchDevice}
        visibleBeds={visibleBeds}
        loading={loading}
        eventsByBed={eventsByBed}
        availabilityEventsByBed={availabilityEventsByBed}
        selectedIds={selectedIds}
        conflictIds={conflictIds}
        isBulkMode={isBulkMode}
        visibleReservationEvents={visibleReservationEvents}
        onToggleSelect={(eventId) => toggleSelect(eventId)}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        draggingEventId={draggingEventId}
        dropTargetBedId={dropTargetBedId}
        movingReservationId={movingReservationId}
        draggingEvent={draggingEvent}
        onEventPointerDown={(event, pointerEvent) => beginMove(event, pointerEvent)}
        onEventPointerMove={(_, pointerEvent) => void updateMove(pointerEvent, visibleBeds)}
        onEventPointerUp={(_, pointerEvent) => void commitMove(pointerEvent, visibleBeds)}
        onEventPointerCancel={cancelMove}
        moveConflict={moveConflict}
        creatingRange={creatingRange}
        onCreationStart={beginCreation}
        onCreationAbort={abortCreation}
        onCreationCommit={(range) => {
          commitCreation(range)
          const bed = visibleBeds.find((item) => item.id === range.bedId)
          if (bed) { setPreselectedBed(bed); setPreselectedDate(parseISO(range.startDate)); setPreselectedCheckOutDate(parseISO(range.endDate)); setNewReservationOpen(true) }
        }}
        resizeState={resizeState}
        resizingReservationId={resizingReservationId}
        confirmingReservationId={confirmingReservationId}
        isResizing={isResizing}
        resizeConflict={resizeConflict}
        onBeginResize={beginReservationResize}
        onMoveResize={moveReservationResize}
        onFinishResize={finishReservationResize}
        onClearResize={clearResize}
        blockRefCallback={(eventId, element) => { if (element) blockRefs.current.set(eventId, element); else blockRefs.current.delete(eventId) }}
        eventGeometry={eventGeometry}
        geometryForDates={geometryForDates}
        onRowClick={openReservationFromTimeline}
        onOpenReservation={(event) => router.push(`/${language}/bookings/reservations/${event.event_id}`)}
        onOpenBlock={(event) => void openBlock(event)}
      />
    </Card>

    <AddReservationDialog open={newReservationOpen} onOpenChange={setNewReservationOpen} onSuccess={refreshEvents} preselectedBed={preselectedBed?.id} preselectedDate={preselectedDate ?? undefined} preselectedCheckOut={preselectedCheckOutDate ?? undefined} preselectedLocation={preselectedBed?.room.location_ref?.name} />
    <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}><DialogContent><DialogHeader><DialogTitle>{pageCopy.blockTitle}</DialogTitle></DialogHeader>{selectedBlock && <div className="space-y-4"><Badge variant="secondary">{selectedBlock.block_type === "maintenance" ? pageCopy.maintenance : selectedBlock.block_type === "owner_use" ? pageCopy.ownerUse : selectedBlock.block_type === "out_of_service" ? pageCopy.outOfService : pageCopy.blocked}</Badge><Detail label={pageCopy.reason} value={selectedBlock.reason} /><div className="grid grid-cols-2 gap-4"><Detail label={pageCopy.from} value={selectedBlock.start_date} /><Detail label={pageCopy.to} value={selectedBlock.end_date} /></div>{selectedBlock.notes && <Detail label={pageCopy.notes} value={selectedBlock.notes} />}<Button asChild className="w-full"><Link href={blocksHref}>{pageCopy.manageBlocks}</Link></Button></div>}</DialogContent></Dialog>
  </div>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div> }

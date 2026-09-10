"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, format, isSameDay } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import { BedDouble, CheckSquare, CircleDollarSign, ConciergeBell, Flag, Keyboard, Layers3, Rows3, Sparkles, Square, TriangleAlert, Wrench } from "lucide-react"
import { CardContent } from "@/components/ui/card"
import { TimelineRow, DAY_WIDTH, LABEL_WIDTH, type Bed, type CalendarEvent, type ResizeState, type TimelineRowProps } from "./timeline-row"
import { ReservationQuickInspector } from "./reservation-quick-inspector"
import type { ReservationResizeEdge } from "@/app/bookings/calendar/use-reservation-resize-state"
import { useCalendarAutoscroll } from "@/app/bookings/calendar/use-calendar-autoscroll"
import { CalendarDailyOperationsSummary } from "@/components/calendar/calendar-daily-operations-summary"
import type { CalendarLayerKey } from "@/components/calendar/reservation-operational-lanes"
import { useCalendarViewPreferences } from "@/components/calendar/use-calendar-view-preferences"
import { useLanguage, type Language } from "@/lib/hooks/use-language"
import { getBedBookingDisplayIdentity } from "@/lib/bookings/bedbooking-nomenclature"

export interface TimelineGridProps {
  dates: Date[]
  rangeDays: number
  timelineWidth: number
  isTouchDevice: boolean
  visibleBeds: Bed[]
  loading: boolean
  eventsByBed: Map<string, CalendarEvent[]>
  selectedIds: Set<string>
  conflictIds: Set<string>
  isBulkMode: boolean
  visibleReservationEvents: CalendarEvent[]
  onToggleSelect: (eventId: string, shiftKey: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  draggingEventId: string | null
  dropTargetBedId: string | null
  movingReservationId: string | null
  moveConflict: boolean
  draggingEvent: CalendarEvent | null
  onEventPointerDown: (event: CalendarEvent, pe: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerMove: (event: CalendarEvent, pe: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerUp: (event: CalendarEvent, pe: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerCancel: () => void
  resizeState: ResizeState | null
  resizingReservationId: string | null
  confirmingReservationId: string | null
  isResizing: boolean
  resizeConflict: CalendarEvent | null
  onBeginResize: (event: CalendarEvent, edge: ReservationResizeEdge, pe: React.PointerEvent<HTMLSpanElement>) => void
  onMoveResize: (pe: React.PointerEvent<HTMLSpanElement>) => void
  onFinishResize: (pe: React.PointerEvent<HTMLSpanElement>) => Promise<void>
  onClearResize: () => void
  blockRefCallback: (eventId: string, el: HTMLButtonElement | null) => void
  eventGeometry: (event: CalendarEvent) => { left: number; width: number }
  geometryForDates: (startsOn: string, endsOn: string) => { left: number; width: number }
  onRowClick: (bed: Bed, clientX: number, currentTarget: HTMLDivElement) => void
  creatingRange: { bedId: string; startDate: string; endDate: string } | null
  onCreationStart: (range: { bedId: string; startDate: string; endDate: string }) => void
  onCreationAbort: () => void
  onCreationCommit: (range: { bedId: string; startDate: string; endDate: string }) => void
  onOpenReservation: (event: CalendarEvent) => void
  onOpenBlock: (event: CalendarEvent) => void
}

const layerIcons: Array<{ key: CalendarLayerKey; Icon: typeof BedDouble }> = [
  { key: "milestones", Icon: Flag },
  { key: "housekeeping", Icon: BedDouble },
  { key: "hospitality", Icon: ConciergeBell },
  { key: "services", Icon: Sparkles },
  { key: "activities", Icon: Rows3 },
  { key: "payments", Icon: CircleDollarSign },
  { key: "issues", Icon: TriangleAlert },
  { key: "maintenance", Icon: Wrench },
]

const propertyBandClasses = [
  "bg-emerald-950/25",
  "bg-amber-950/25",
  "bg-violet-950/25",
  "bg-cyan-950/25",
  "bg-rose-950/25",
  "bg-slate-950/25",
]

const copy = {
  en: {
    layers: { milestones: "Milestones", housekeeping: "Housekeeping", hospitality: "Hospitality", services: "Services", activities: "Activities", payments: "Payments", issues: "Issues", maintenance: "Maintenance" },
    legend: { pending: "Pending", confirmed: "Confirmed", checkedIn: "Checked in", completed: "Completed", block: "Block" },
    layersButton: "Layers", summary: "Summary", shortcuts: "Shortcuts", interactionHint: "Click: inspect · double-click: edit · drag: move · edges: dates",
    navigate: "navigate", select: "select", help: "help", all: "All", deselectAll: "Deselect all", selectAll: "Select all", rooms: "ROOMS",
    loading: "Loading availability…", empty: "No rooms match the selected filters.",
  },
  es: {
    layers: { milestones: "Hitos", housekeeping: "Limpieza", hospitality: "Hospitalidad", services: "Servicios", activities: "Actividades", payments: "Pagos", issues: "Incidencias", maintenance: "Mantenimiento" },
    legend: { pending: "Pendiente", confirmed: "Confirmada", checkedIn: "Hospedado", completed: "Finalizada", block: "Bloqueo" },
    layersButton: "Capas", summary: "Resumen", shortcuts: "Atajos", interactionHint: "Clic: revisar · doble clic: editar · arrastra: mover · extremos: fechas",
    navigate: "navegar", select: "seleccionar", help: "ayuda", all: "Todo", deselectAll: "Deseleccionar todo", selectAll: "Seleccionar todo", rooms: "HABITACIONES",
    loading: "Cargando disponibilidad…", empty: "No hay habitaciones para los filtros seleccionados.",
  },
  de: {
    layers: { milestones: "Meilensteine", housekeeping: "Zimmerreinigung", hospitality: "Gästeservice", services: "Leistungen", activities: "Aktivitäten", payments: "Zahlungen", issues: "Vorfälle", maintenance: "Wartung" },
    legend: { pending: "Ausstehend", confirmed: "Bestätigt", checkedIn: "Eingecheckt", completed: "Abgeschlossen", block: "Sperre" },
    layersButton: "Ebenen", summary: "Übersicht", shortcuts: "Tastenkürzel", interactionHint: "Klick: prüfen · Doppelklick: bearbeiten · ziehen: verschieben · Ränder: Daten",
    navigate: "navigieren", select: "auswählen", help: "Hilfe", all: "Alle", deselectAll: "Auswahl aufheben", selectAll: "Alle auswählen", rooms: "ZIMMER",
    loading: "Verfügbarkeit wird geladen…", empty: "Keine Zimmer entsprechen den gewählten Filtern.",
  },
} satisfies Record<Language, any>

const dateLocales = { en: enUS, es, de } satisfies Record<Language, typeof enUS>
type InventoryGroup = { locationId: string; locationName: string; rooms: Array<{ roomId: string; roomNumber: string; beds: Bed[] }> }

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB
}

function uniqueRoomEvents(roomBeds: Bed[], eventsByBed: Map<string, CalendarEvent[]>) {
  const events = new Map<string, CalendarEvent>()
  for (const bed of roomBeds) {
    for (const event of eventsByBed.get(bed.id) ?? []) events.set(`${event.event_type}:${event.event_id}`, event)
  }
  return Array.from(events.values())
}

function freeBedForRange(roomBeds: Bed[], eventsByBed: Map<string, CalendarEvent[]>, startsOn: string, endsOn: string, ignoreEventId?: string | null) {
  return roomBeds.find((bed) => !(eventsByBed.get(bed.id) ?? []).some((event) => event.event_id !== ignoreEventId && overlaps(startsOn, endsOn, event.starts_on, event.ends_on))) ?? roomBeds[0]
}

export function TimelineGrid(props: TimelineGridProps) {
  const {
    dates, rangeDays, timelineWidth, isTouchDevice, visibleBeds, loading, eventsByBed, selectedIds, conflictIds, isBulkMode,
    visibleReservationEvents, onToggleSelect, onSelectAll, onClearSelection, draggingEventId, dropTargetBedId,
    movingReservationId, moveConflict, draggingEvent, onEventPointerDown, onEventPointerMove, onEventPointerUp,
    onEventPointerCancel, resizeState, resizingReservationId, confirmingReservationId, isResizing, resizeConflict,
    onBeginResize, onMoveResize, onFinishResize, onClearResize, blockRefCallback, eventGeometry, geometryForDates,
    onRowClick, creatingRange, onCreationStart, onCreationAbort, onCreationCommit, onOpenReservation, onOpenBlock,
  } = props
  const { language } = useLanguage()
  const c = copy[language]
  const dateLocale = dateLocales[language]
  const layers = useMemo(() => layerIcons.map((item) => ({ ...item, label: c.layers[item.key] })), [c.layers])
  const statusLegend = useMemo(() => [
    { label: c.legend.pending, className: "bg-amber-400" },
    { label: c.legend.confirmed, className: "bg-blue-600" },
    { label: c.legend.checkedIn, className: "bg-emerald-600" },
    { label: c.legend.completed, className: "bg-slate-500" },
    { label: c.legend.block, className: "bg-zinc-800" },
  ], [c.legend])
  const totalWidth = LABEL_WIDTH + timelineWidth
  const isInteracting = Boolean(draggingEventId) || isResizing
  const scrollRef = useCalendarAutoscroll({ active: isInteracting })
  const defaultLayers = useMemo(() => layerIcons.map((layer) => layer.key), [])
  const { preferences, setPreferences } = useCalendarViewPreferences(defaultLayers)
  const activeLayers = useMemo(() => new Set(preferences.activeLayers), [preferences.activeLayers])
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [inspectedReservation, setInspectedReservation] = useState<CalendarEvent | null>(null)

  const inventoryGroups = useMemo<InventoryGroup[]>(() => {
    const locations = new Map<string, InventoryGroup>()
    for (const bed of visibleBeds) {
      const locationId = bed.room.location_ref?.id ?? bed.room.location_id ?? "unassigned"
      const locationName = bed.room.location_ref?.name ?? ""
      const location = locations.get(locationId) ?? { locationId, locationName, rooms: [] }
      let room = location.rooms.find((item) => item.roomId === bed.room.id)
      if (!room) { room = { roomId: bed.room.id, roomNumber: bed.room.room_number, beds: [] }; location.rooms.push(room) }
      room.beds.push(bed)
      locations.set(locationId, location)
    }
    return Array.from(locations.values()).sort((a, b) => a.locationName.localeCompare(b.locationName)).map((location) => ({
      ...location,
      rooms: location.rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })).map((room) => ({ ...room, beds: room.beds.sort((a, b) => a.bed_number.localeCompare(b.bed_number, undefined, { numeric: true })) })),
    }))
  }, [visibleBeds])

  const roomCount = useMemo(() => inventoryGroups.reduce((sum, location) => sum + location.rooms.length, 0), [inventoryGroups])

  useEffect(() => {
    if (!scrollRef.current || dates.length === 0) return
    const todayIndex = dates.findIndex((date) => isSameDay(date, new Date()))
    if (todayIndex >= 0) scrollRef.current.scrollLeft = todayIndex * DAY_WIDTH
  }, [dates, scrollRef])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return
      if (event.key === "?") { event.preventDefault(); setShowKeyboardHelp((current) => !current); return }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); setPreferences((current) => ({ ...current, showSummary: !current.showSummary })); return }
      if (event.key.toLowerCase() === "l") { event.preventDefault(); setPreferences((current) => ({ ...current, showLayerToolbar: !current.showLayerToolbar })); return }
      if (event.key.toLowerCase() === "a" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (isBulkMode) onClearSelection(); else onSelectAll(); return }
      if (event.key === "ArrowLeft" && scrollRef.current) { event.preventDefault(); scrollRef.current.scrollBy({ left: -DAY_WIDTH * 2, behavior: "smooth" }); return }
      if (event.key === "ArrowRight" && scrollRef.current) { event.preventDefault(); scrollRef.current.scrollBy({ left: DAY_WIDTH * 2, behavior: "smooth" }) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isBulkMode, onClearSelection, onSelectAll, scrollRef, setPreferences])

  function toggleLayer(key: CalendarLayerKey) {
    setPreferences((current) => {
      const next = new Set(current.activeLayers)
      if (next.has(key)) next.delete(key); else next.add(key)
      return { ...current, activeLayers: Array.from(next) }
    })
  }
  function toggleAllLayers() { setPreferences((current) => ({ ...current, activeLayers: current.activeLayers.length === layers.length ? [] : defaultLayers })) }
  function inspectReservation(event: CalendarEvent) { if (event.event_type === "reservation") setInspectedReservation(event) }

  const sharedRowProps: Omit<TimelineRowProps, "bed" | "bedEvents" | "onRowClick" | "onCreationCommit"> = {
    dates, timelineWidth, isTouchDevice, activeLayers, selectedIds, conflictIds, isBulkMode, onToggleSelect,
    draggingEventId, dropTargetBedId, movingReservationId, moveConflict, draggingEvent, onEventPointerDown,
    onEventPointerMove, onEventPointerUp, onEventPointerCancel, resizeState, resizingReservationId,
    confirmingReservationId, isResizing, resizeConflict, onBeginResize, onMoveResize, onFinishResize, onClearResize,
    blockRefCallback, eventGeometry, geometryForDates, creatingRange, onCreationStart, onCreationAbort,
    onOpenReservation: inspectReservation, onOpenBlock,
  }

  return (
    <CardContent className="p-0">
      <div className="border-b bg-background">
        <div className="flex min-h-9 flex-wrap items-center gap-2 px-3 py-1">
          <button type="button" onClick={() => setPreferences((current) => ({ ...current, showLayerToolbar: !current.showLayerToolbar }))} className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium transition ${preferences.showLayerToolbar ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}><Layers3 className="h-3.5 w-3.5" />{c.layersButton}</button>
          <button type="button" onClick={() => setPreferences((current) => ({ ...current, showSummary: !current.showSummary }))} className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] transition ${preferences.showSummary ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}><Rows3 className="h-3.5 w-3.5" />{c.summary}</button>
          <button type="button" onClick={() => setShowKeyboardHelp((current) => !current)} className="inline-flex items-center gap-1 border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"><Keyboard className="h-3.5 w-3.5" />{c.shortcuts}</button>
          <div className="hidden items-center gap-3 border-l pl-3 xl:flex">{statusLegend.map((item) => <span key={item.label} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className={`h-2.5 w-2.5 ${item.className}`} />{item.label}</span>)}</div>
          <span className="ml-auto text-[10px] text-muted-foreground">{c.interactionHint}</span>
        </div>
        {showKeyboardHelp && <div className="flex flex-wrap gap-x-5 gap-y-1 border-t bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground"><span><kbd>←/→</kbd> {c.navigate}</span><span><kbd>S</kbd> {c.summary.toLowerCase()}</span><span><kbd>L</kbd> {c.layersButton.toLowerCase()}</span><span><kbd>⌘/Ctrl+A</kbd> {c.select}</span><span><kbd>?</kbd> {c.help}</span></div>}
        {preferences.showLayerToolbar && <div className="flex flex-wrap items-center gap-1 border-t bg-muted/20 px-3 py-1.5">
          <button type="button" onClick={toggleAllLayers} className={`border px-2 py-1 text-[11px] font-medium transition ${activeLayers.size === layers.length ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{c.all}</button>
          {layers.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => toggleLayer(key)} className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] transition ${activeLayers.has(key) ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
        </div>}
      </div>

      <div ref={scrollRef} className="overflow-auto bg-[#122526]">
        <div style={{ minWidth: totalWidth }}>
          <div className="sticky top-0 z-30 flex border-b border-white/10 bg-[#17191a] shadow-sm">
            <div className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r border-white/10 bg-[#17191a] px-3 text-[11px] font-medium tracking-wide text-white/65" style={{ width: LABEL_WIDTH, height: 44 }}>
              {visibleReservationEvents.length > 0 && <button type="button" onClick={isBulkMode ? onClearSelection : onSelectAll} className="shrink-0 text-white/50 transition hover:text-white" aria-label={isBulkMode ? c.deselectAll : c.selectAll}>{isBulkMode ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}</button>}
              <span>{c.rooms} ({roomCount})</span>
            </div>
            <div className="grid" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${rangeDays}, ${DAY_WIDTH}px)` }}>
              {dates.map((date, index) => {
                const weekend = date.getDay() === 0 || date.getDay() === 6
                const monthBoundary = index === 0 || date.getDate() === 1
                const today = isSameDay(date, new Date())
                return <div key={date.toISOString()} className={`relative flex flex-col items-center justify-center border-r border-white/10 text-center text-white ${weekend ? "bg-black/10" : ""} ${today ? "bg-emerald-600" : ""} ${monthBoundary ? "border-l border-l-white/20" : ""}`} style={{ height: 44 }}>
                  {monthBoundary && <span className="absolute left-1 top-0 text-[8px] font-medium uppercase tracking-wide text-white/45">{format(date, "MMM", { locale: dateLocale })}</span>}
                  <div className={`text-[9px] ${today ? "text-white" : "text-white/65"}`}>{format(date, "EEE", { locale: dateLocale })}</div><div className="text-sm font-medium leading-none">{format(date, "dd")}</div>
                </div>
              })}
            </div>
          </div>

          {loading ? <div className="p-12 text-center text-white/60">{c.loading}</div> : roomCount === 0 ? <div className="p-12 text-center text-white/60">{c.empty}</div> : inventoryGroups.map((location, locationIndex) => {
            const propertyBand = propertyBandClasses[locationIndex % propertyBandClasses.length]
            return <div key={location.locationId} className={`[content-visibility:auto] [contain-intrinsic-size:180px] ${propertyBand}`} title={location.locationName}>
              {location.rooms.map((room) => {
                const identity = getBedBookingDisplayIdentity({ propertyName: location.locationName, roomNumber: room.roomNumber })
                const roomEvents = uniqueRoomEvents(room.beds, eventsByBed)
                const targetBed = draggingEvent
                  ? freeBedForRange(room.beds, eventsByBed, draggingEvent.starts_on, draggingEvent.ends_on, draggingEvent.event_id)
                  : room.beds[0]
                if (!targetBed) return null
                const displayBed: Bed = { ...targetBed, display_name: identity.displayName, guest_capacity: identity.guestCapacity }
                return <TimelineRow
                  key={room.roomId}
                  bed={displayBed}
                  bedEvents={roomEvents}
                  {...sharedRowProps}
                  onRowClick={(_, clientX, currentTarget) => {
                    const rect = currentTarget.getBoundingClientRect()
                    const offset = Math.max(0, Math.min(timelineWidth - 1, clientX - rect.left))
                    const day = dates[Math.min(dates.length - 1, Math.floor(offset / DAY_WIDTH))]
                    if (!day) return
                    const startsOn = format(day, "yyyy-MM-dd")
                    const endsOn = format(addDays(day, 1), "yyyy-MM-dd")
                    const availableBed = freeBedForRange(room.beds, eventsByBed, startsOn, endsOn)
                    if (availableBed) onRowClick(availableBed, clientX, currentTarget)
                  }}
                  onCreationCommit={(range) => {
                    const availableBed = freeBedForRange(room.beds, eventsByBed, range.startDate, range.endDate)
                    if (availableBed) onCreationCommit({ ...range, bedId: availableBed.id })
                  }}
                />
              })}
            </div>
          })}
          {preferences.showSummary && <CalendarDailyOperationsSummary dates={dates} reservations={visibleReservationEvents} timelineWidth={timelineWidth} />}
        </div>
      </div>

      <ReservationQuickInspector reservation={inspectedReservation} open={Boolean(inspectedReservation)} onOpenChange={(open) => { if (!open) setInspectedReservation(null) }} onOpenFull={(event) => { setInspectedReservation(null); onOpenReservation(event) }} />
    </CardContent>
  )
}

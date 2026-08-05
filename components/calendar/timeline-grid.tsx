"use client"

import { useEffect, useMemo, useState } from "react"
import { format, isSameDay } from "date-fns"
import { BedDouble, Building2, CheckSquare, ChevronDown, ChevronRight, CircleDollarSign, ConciergeBell, DoorOpen, Flag, Rows3, Sparkles, Square, TriangleAlert, Wrench } from "lucide-react"
import { CardContent } from "@/components/ui/card"
import {
  TimelineRow,
  DAY_WIDTH,
  LABEL_WIDTH,
  type Bed,
  type CalendarEvent,
  type ResizeState,
  type TimelineRowProps,
} from "./timeline-row"
import type { ReservationResizeEdge } from "@/app/bookings/calendar/use-reservation-resize-state"
import { useCalendarAutoscroll } from "@/app/bookings/calendar/use-calendar-autoscroll"
import { CalendarDailyOperationsSummary } from "@/components/calendar/calendar-daily-operations-summary"
import type { CalendarLayerKey } from "@/components/calendar/reservation-operational-lanes"

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

const LAYERS: Array<{ key: CalendarLayerKey; label: string; Icon: typeof BedDouble }> = [
  { key: "milestones", label: "Hitos", Icon: Flag },
  { key: "housekeeping", label: "Housekeeping", Icon: BedDouble },
  { key: "hospitality", label: "Hospitality", Icon: ConciergeBell },
  { key: "services", label: "Servicios", Icon: Sparkles },
  { key: "activities", label: "Actividades", Icon: Rows3 },
  { key: "payments", label: "Pagos", Icon: CircleDollarSign },
  { key: "issues", label: "Incidencias", Icon: TriangleAlert },
  { key: "maintenance", label: "Mantenimiento", Icon: Wrench },
]

type InventoryGroup = {
  locationId: string
  locationName: string
  rooms: Array<{ roomId: string; roomNumber: string; beds: Bed[] }>
}

export function TimelineGrid({
  dates,
  rangeDays,
  timelineWidth,
  isTouchDevice,
  visibleBeds,
  loading,
  eventsByBed,
  selectedIds,
  conflictIds,
  isBulkMode,
  visibleReservationEvents,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  draggingEventId,
  dropTargetBedId,
  movingReservationId,
  moveConflict,
  draggingEvent,
  onEventPointerDown,
  onEventPointerMove,
  onEventPointerUp,
  onEventPointerCancel,
  resizeState,
  resizingReservationId,
  confirmingReservationId,
  isResizing,
  resizeConflict,
  onBeginResize,
  onMoveResize,
  onFinishResize,
  onClearResize,
  blockRefCallback,
  eventGeometry,
  geometryForDates,
  onRowClick,
  creatingRange,
  onCreationStart,
  onCreationAbort,
  onCreationCommit,
  onOpenReservation,
  onOpenBlock,
}: TimelineGridProps) {
  const totalWidth = LABEL_WIDTH + timelineWidth
  const isInteracting = Boolean(draggingEventId) || isResizing
  const scrollRef = useCalendarAutoscroll({ active: isInteracting })
  const [activeLayers, setActiveLayers] = useState<Set<CalendarLayerKey>>(() => new Set(LAYERS.map((layer) => layer.key)))
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(new Set())
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set())
  const [showSummary, setShowSummary] = useState(true)

  const inventoryGroups = useMemo<InventoryGroup[]>(() => {
    const locations = new Map<string, InventoryGroup>()
    for (const bed of visibleBeds) {
      const locationId = bed.room.location_ref?.id ?? bed.room.location_id ?? "unassigned"
      const locationName = bed.room.location_ref?.name ?? "Sin propiedad"
      const location = locations.get(locationId) ?? { locationId, locationName, rooms: [] }
      let room = location.rooms.find((item) => item.roomId === bed.room.id)
      if (!room) {
        room = { roomId: bed.room.id, roomNumber: bed.room.room_number, beds: [] }
        location.rooms.push(room)
      }
      room.beds.push(bed)
      locations.set(locationId, location)
    }
    return Array.from(locations.values())
      .sort((a, b) => a.locationName.localeCompare(b.locationName))
      .map((location) => ({
        ...location,
        rooms: location.rooms
          .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
          .map((room) => ({ ...room, beds: room.beds.sort((a, b) => a.bed_number.localeCompare(b.bed_number, undefined, { numeric: true })) })),
      }))
  }, [visibleBeds])

  useEffect(() => {
    if (!scrollRef.current || dates.length === 0) return
    const todayIndex = dates.findIndex((date) => isSameDay(date, new Date()))
    if (todayIndex >= 0) scrollRef.current.scrollLeft = todayIndex * DAY_WIDTH
  }, [dates, scrollRef])

  function toggleLayer(key: CalendarLayerKey) {
    setActiveLayers((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllLayers() {
    setActiveLayers((current) => current.size === LAYERS.length ? new Set() : new Set(LAYERS.map((layer) => layer.key)))
  }

  function toggleSet(id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sharedRowProps: Omit<TimelineRowProps, "bed" | "bedEvents"> = {
    dates,
    timelineWidth,
    isTouchDevice,
    activeLayers,
    selectedIds,
    conflictIds,
    isBulkMode,
    onToggleSelect,
    draggingEventId,
    dropTargetBedId,
    movingReservationId,
    moveConflict,
    draggingEvent,
    onEventPointerDown,
    onEventPointerMove,
    onEventPointerUp,
    onEventPointerCancel,
    resizeState,
    resizingReservationId,
    confirmingReservationId,
    isResizing,
    resizeConflict,
    onBeginResize,
    onMoveResize,
    onFinishResize,
    onClearResize,
    blockRefCallback,
    eventGeometry,
    geometryForDates,
    onRowClick,
    creatingRange,
    onCreationStart,
    onCreationAbort,
    onCreationCommit,
    onOpenReservation,
    onOpenBlock,
  }

  return (
    <CardContent className="p-0">
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-3 py-2">
        <button type="button" onClick={toggleAllLayers} className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${activeLayers.size === LAYERS.length ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
          Todo
        </button>
        {LAYERS.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => toggleLayer(key)} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${activeLayers.has(key) ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
        <button type="button" onClick={() => setShowSummary((current) => !current)} className={`ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${showSummary ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
          <Rows3 className="h-3.5 w-3.5" />Resumen diario
        </button>
      </div>

      <div ref={scrollRef} className="overflow-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="sticky top-0 z-30 flex border-b bg-background">
            <div className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r bg-background px-4 font-medium" style={{ width: LABEL_WIDTH, height: 46 }}>
              {visibleReservationEvents.length > 0 && (
                <button type="button" onClick={isBulkMode ? onClearSelection : onSelectAll} className="shrink-0 text-muted-foreground transition hover:text-foreground" aria-label={isBulkMode ? "Deseleccionar todo" : "Seleccionar todo"}>
                  {isBulkMode ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                </button>
              )}
              <span>Propiedad / habitación / cama</span>
            </div>

            <div className="grid" style={{ width: timelineWidth, gridTemplateColumns: `repeat(${rangeDays}, ${DAY_WIDTH}px)` }}>
              {dates.map((date) => (
                <div key={date.toISOString()} className={`flex flex-col items-center justify-center border-r text-center ${isSameDay(date, new Date()) ? "border-x border-amber-400 bg-amber-50" : ""}`} style={{ height: 46 }}>
                  <div className="text-[10px] uppercase text-muted-foreground">{format(date, "EEE")}</div>
                  <div className="text-sm font-semibold">{format(date, "dd MMM")}</div>
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Cargando Availability Engine…</div>
          ) : visibleBeds.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No hay camas para los filtros seleccionados.</div>
          ) : (
            inventoryGroups.map((location) => {
              const locationCollapsed = collapsedLocations.has(location.locationId)
              const bedCount = location.rooms.reduce((sum, room) => sum + room.beds.length, 0)
              return (
                <div key={location.locationId}>
                  <button type="button" onClick={() => toggleSet(location.locationId, setCollapsedLocations)} className="sticky left-0 z-20 flex h-9 w-full items-center border-b bg-muted/70 text-left text-xs font-semibold backdrop-blur">
                    <span className="sticky left-0 flex h-full items-center gap-2 border-r px-3" style={{ width: LABEL_WIDTH }}>
                      {locationCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="truncate">{location.locationName}</span>
                      <span className="ml-auto rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">{location.rooms.length} hab. · {bedCount} camas</span>
                    </span>
                  </button>
                  {!locationCollapsed && location.rooms.map((room) => {
                    const roomCollapsed = collapsedRooms.has(room.roomId)
                    return (
                      <div key={room.roomId}>
                        <button type="button" onClick={() => toggleSet(room.roomId, setCollapsedRooms)} className="sticky left-0 z-20 flex h-8 w-full items-center border-b bg-background/95 text-left text-[11px] font-medium">
                          <span className="sticky left-0 flex h-full items-center gap-2 border-r pl-6 pr-3" style={{ width: LABEL_WIDTH }}>
                            {roomCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            <DoorOpen className="h-3.5 w-3.5" />
                            <span>Hab. {room.roomNumber}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{room.beds.length} cama{room.beds.length === 1 ? "" : "s"}</span>
                          </span>
                        </button>
                        {!roomCollapsed && room.beds.map((bed) => <TimelineRow key={bed.id} bed={bed} bedEvents={eventsByBed.get(bed.id) ?? []} {...sharedRowProps} />)}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}

          {showSummary && <CalendarDailyOperationsSummary dates={dates} reservations={visibleReservationEvents} timelineWidth={timelineWidth} />}
        </div>
      </div>
    </CardContent>
  )
}

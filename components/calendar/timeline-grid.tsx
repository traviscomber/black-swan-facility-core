"use client"

import { useEffect, useState } from "react"
import { format, isSameDay } from "date-fns"
import { BedDouble, CalendarDays, CheckSquare, CircleDollarSign, ConciergeBell, Flag, Sparkles, Square, TriangleAlert, Wrench } from "lucide-react"
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
  { key: "activities", label: "Actividades", Icon: CalendarDays },
  { key: "payments", label: "Pagos", Icon: CircleDollarSign },
  { key: "maintenance", label: "Mantenimiento", Icon: Wrench },
  { key: "issues", label: "Incidencias", Icon: TriangleAlert },
]

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
        <span className="ml-auto text-[10px] text-muted-foreground">Las capas controlan las sublíneas al expandir una reserva.</span>
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
            visibleBeds.map((bed) => <TimelineRow key={bed.id} bed={bed} bedEvents={eventsByBed.get(bed.id) ?? []} {...sharedRowProps} />)
          )}

          <CalendarDailyOperationsSummary dates={dates} reservations={visibleReservationEvents} timelineWidth={timelineWidth} />
        </div>
      </div>
    </CardContent>
  )
}

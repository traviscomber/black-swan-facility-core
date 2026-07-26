"use client"

import { format, isSameDay } from "date-fns"
import { CheckSquare, Square } from "lucide-react"
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface TimelineGridProps {
  dates: Date[]
  rangeDays: number
  timelineWidth: number
  isTouchDevice: boolean

  visibleBeds: Bed[]
  loading: boolean

  eventsByBed: Map<string, CalendarEvent[]>

  // Selection (Phase B)
  selectedIds: Set<string>
  conflictIds: Set<string>
  isBulkMode: boolean
  visibleReservationEvents: CalendarEvent[]
  onToggleSelect: (eventId: string, shiftKey: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void

  // Move interaction (pointer capture — PR 2)
  draggingEventId: string | null
  dropTargetBedId: string | null
  movingReservationId: string | null
  draggingEvent: CalendarEvent | null
  onEventPointerDown: (event: CalendarEvent, pe: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerMove: (event: CalendarEvent, pe: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerUp: (event: CalendarEvent, pe: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerCancel: () => void

  // Resize
  resizeState: ResizeState | null
  resizingReservationId: string | null
  confirmingReservationId: string | null
  isResizing: boolean
  resizeConflict: CalendarEvent | null
  onBeginResize: (event: CalendarEvent, edge: ReservationResizeEdge, pe: React.PointerEvent<HTMLSpanElement>) => void
  onMoveResize: (pe: React.PointerEvent<HTMLSpanElement>) => void
  onFinishResize: (pe: React.PointerEvent<HTMLSpanElement>) => Promise<void>
  onClearResize: () => void

  // FLIP
  blockRefCallback: (eventId: string, el: HTMLButtonElement | null) => void

  // Geometry
  eventGeometry: (event: CalendarEvent) => { left: number; width: number }
  geometryForDates: (startsOn: string, endsOn: string) => { left: number; width: number }

  // Row interactions
  onRowClick: (bed: Bed, clientX: number, currentTarget: HTMLDivElement) => void

  // Creation (PR 3 task)
  creatingRange: { bedId: string; startDate: string; endDate: string } | null
  onCreationStart: (range: { bedId: string; startDate: string; endDate: string }) => void
  onCreationAbort: () => void
  onCreationCommit: (range: { bedId: string; startDate: string; endDate: string }) => void

  onOpenReservation: (event: CalendarEvent) => void
  onOpenBlock: (event: CalendarEvent) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
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
  const totalWidth  = LABEL_WIDTH + timelineWidth
  const isInteracting = !!draggingEventId || isResizing
  const scrollRef   = useCalendarAutoscroll({ active: isInteracting })

  // Shared props forwarded to every TimelineRow (excludes per-bed fields)
  const sharedRowProps: Omit<TimelineRowProps, "bed" | "bedEvents"> = {
    dates,
    timelineWidth,
    isTouchDevice,
    selectedIds,
    conflictIds,
    isBulkMode,
    onToggleSelect,
    draggingEventId,
    dropTargetBedId,
    movingReservationId,
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
      <div ref={scrollRef} className="overflow-auto">
        <div style={{ minWidth: totalWidth }}>

          {/* Sticky date header */}
          <div className="sticky top-0 z-30 flex border-b bg-background">
            <div
              className="sticky left-0 z-40 flex shrink-0 items-center gap-2 border-r bg-background px-4 font-medium"
              style={{ width: LABEL_WIDTH, height: 58 }}
            >
              {visibleReservationEvents.length > 0 && (
                <button
                  type="button"
                  onClick={isBulkMode ? onClearSelection : onSelectAll}
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label={isBulkMode ? "Deseleccionar todo" : "Seleccionar todo"}
                >
                  {isBulkMode
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4" />}
                </button>
              )}
              <span>Propiedad / habitación / cama</span>
            </div>

            <div
              className="grid"
              style={{ width: timelineWidth, gridTemplateColumns: `repeat(${rangeDays}, ${DAY_WIDTH}px)` }}
            >
              {dates.map((date) => (
                <div
                  key={date.toISOString()}
                  className={`flex flex-col items-center justify-center border-r text-center ${
                    isSameDay(date, new Date()) ? "bg-amber-100" : ""
                  }`}
                  style={{ height: 58 }}
                >
                  <div className="text-xs text-muted-foreground">{format(date, "EEE")}</div>
                  <div className="font-semibold">{format(date, "dd MMM")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Cargando Availability Engine…</div>
          ) : visibleBeds.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No hay camas para los filtros seleccionados.</div>
          ) : (
            visibleBeds.map((bed) => (
              <TimelineRow
                key={bed.id}
                bed={bed}
                bedEvents={eventsByBed.get(bed.id) ?? []}
                {...sharedRowProps}
              />
            ))
          )}
        </div>
      </div>
    </CardContent>
  )
}

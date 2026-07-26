"use client"

import type React from "react"
import { isSameDay } from "date-fns"
import type { CalendarBed, CalendarGeometry, CalendarInventoryEvent } from "@/app/bookings/calendar/calendar-types"
import type { ReservationResizeEdge } from "@/app/bookings/calendar/use-reservation-resize-state"
import { ReservationBlock } from "./reservation-block"

interface TimelineRowProps {
  bed: CalendarBed
  events: CalendarInventoryEvent[]
  dates: Date[]
  dayWidth: number
  labelWidth: number
  rowHeight: number
  timelineWidth: number
  isInteractionTarget: boolean
  isTouchDevice: boolean
  interactionsDisabled: boolean
  selectedIds: Set<string>
  conflictIds: Set<string>
  movingReservationId: string | null
  resizingReservationId: string | null
  confirmingReservationId: string | null
  getGeometry: (event: CalendarInventoryEvent) => CalendarGeometry
  getStatusClassName: (status: string) => string
  getStatusLabel: (status: string) => string
  getBlockLabel: (blockType: string | null) => string
  setBlockRef: (eventId: string, element: HTMLButtonElement | null) => void
  onOpenEvent: (event: CalendarInventoryEvent) => void
  onToggleSelect: (eventId: string, shiftKey: boolean) => void
  onTimelineClick: (bed: CalendarBed, clientX: number, element: HTMLDivElement) => void
  onTimelinePointerDown: (
    bed: CalendarBed,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void
  onTimelinePointerMove: (
    bed: CalendarBed,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void
  onTimelinePointerUp: (
    bed: CalendarBed,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void
  onTimelinePointerCancel: (
    bed: CalendarBed,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void
  onMoveStart: (
    event: CalendarInventoryEvent,
    pointerEvent: React.PointerEvent<HTMLButtonElement>,
  ) => void
  onMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onMoveEnd: (event: React.PointerEvent<HTMLButtonElement>) => void
  onMoveCancel: (event: React.PointerEvent<HTMLButtonElement>) => void
  onResizeStart: (
    event: CalendarInventoryEvent,
    edge: ReservationResizeEdge,
    pointerEvent: React.PointerEvent<HTMLSpanElement>,
  ) => void
  onResizeMove: (event: React.PointerEvent<HTMLSpanElement>) => void
  onResizeEnd: (event: React.PointerEvent<HTMLSpanElement>) => void
  onResizeCancel: (event: React.PointerEvent<HTMLSpanElement>) => void
  renderPreview?: (event: CalendarInventoryEvent) => React.ReactNode
  renderRowPreview?: (bed: CalendarBed) => React.ReactNode
}

export function TimelineRow({
  bed,
  events,
  dates,
  dayWidth,
  labelWidth,
  rowHeight,
  timelineWidth,
  isInteractionTarget,
  isTouchDevice,
  interactionsDisabled,
  selectedIds,
  conflictIds,
  movingReservationId,
  resizingReservationId,
  confirmingReservationId,
  getGeometry,
  getStatusClassName,
  getStatusLabel,
  getBlockLabel,
  setBlockRef,
  onOpenEvent,
  onToggleSelect,
  onTimelineClick,
  onTimelinePointerDown,
  onTimelinePointerMove,
  onTimelinePointerUp,
  onTimelinePointerCancel,
  onMoveStart,
  onMove,
  onMoveEnd,
  onMoveCancel,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeCancel,
  renderPreview,
  renderRowPreview,
}: TimelineRowProps) {
  return (
    <div
      className={`flex border-b transition ${isInteractionTarget ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500" : "hover:bg-muted/20"}`}
      style={{ height: rowHeight }}
      data-bed-id={bed.id}
    >
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background px-4"
        style={{ width: labelWidth, height: rowHeight }}
      >
        <div className="flex-1 overflow-hidden">
          <div className="truncate font-medium">{bed.room.location_ref?.name ?? "Sin propiedad"}</div>
          <div className="truncate text-xs text-muted-foreground">
            Hab. {bed.room.room_number} · {bed.bed_number} · {bed.bed_type}
          </div>
        </div>
      </div>

      <div
        className="relative cursor-crosshair"
        style={{
          width: timelineWidth,
          height: rowHeight,
          touchAction: "none",
          backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${dayWidth - 1}px, hsl(var(--border)) ${dayWidth - 1}px, hsl(var(--border)) ${dayWidth}px)`,
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          onTimelineClick(bed, event.clientX, event.currentTarget)
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget || interactionsDisabled) return
          onTimelinePointerDown(bed, event)
        }}
        onPointerMove={(event) => onTimelinePointerMove(bed, event)}
        onPointerUp={(event) => onTimelinePointerUp(bed, event)}
        onPointerCancel={(event) => onTimelinePointerCancel(bed, event)}
        onLostPointerCapture={(event) => onTimelinePointerCancel(bed, event)}
      >
        {dates.map((date, index) =>
          isSameDay(date, new Date()) ? (
            <div
              key={`today-${bed.id}-${index}`}
              className="pointer-events-none absolute inset-y-0 bg-amber-50/70"
              style={{ left: index * dayWidth, width: dayWidth }}
            />
          ) : null,
        )}

        {renderRowPreview?.(bed)}

        {events.map((event) => {
          const isBlock = event.event_type === "block"
          const isMoving = movingReservationId === event.event_id
          const isResizing = resizingReservationId === event.event_id
          const isConfirming = confirmingReservationId === event.event_id

          return (
            <div key={`${event.event_type}-${event.event_id}-${bed.id}`}>
              {renderPreview?.(event)}
              <ReservationBlock
                event={event}
                geometry={getGeometry(event)}
                statusClassName={getStatusClassName(event.status)}
                statusLabel={getStatusLabel(event.status)}
                blockLabel={getBlockLabel(event.block_type)}
                isMoving={isMoving}
                isResizing={isResizing}
                isConfirming={isConfirming}
                isSelected={!isBlock && selectedIds.has(event.event_id)}
                isBulkConflict={conflictIds.has(event.event_id)}
                isBulkMode={selectedIds.size > 0}
                isTouchDevice={isTouchDevice}
                interactionsDisabled={interactionsDisabled}
                setElementRef={(element) => setBlockRef(event.event_id, element)}
                onOpen={() => onOpenEvent(event)}
                onToggleSelect={(shiftKey) => onToggleSelect(event.event_id, shiftKey)}
                onMoveStart={(pointerEvent) => onMoveStart(event, pointerEvent)}
                onMove={onMove}
                onMoveEnd={onMoveEnd}
                onMoveCancel={onMoveCancel}
                onResizeStart={(edge, pointerEvent) => onResizeStart(event, edge, pointerEvent)}
                onResizeMove={onResizeMove}
                onResizeEnd={onResizeEnd}
                onResizeCancel={onResizeCancel}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { isSameDay, parseISO } from "date-fns"
import { CheckSquare, Square } from "lucide-react"
import type { ReservationResizeEdge } from "@/app/bookings/calendar/use-reservation-resize-state"

// ---------------------------------------------------------------------------
// Shared constants (kept in sync with calendar/page.tsx)
// ---------------------------------------------------------------------------
export const DAY_WIDTH  = 96
export const LABEL_WIDTH = 272
export const ROW_HEIGHT  = 68

export const STATUS_STYLES: Record<string, string> = {
  confirmed:    "bg-violet-600 text-white border-violet-700",
  checked_in:   "bg-emerald-600 text-white border-emerald-700",
  "checked-in": "bg-emerald-600 text-white border-emerald-700",
  checked_out:  "bg-slate-600 text-white border-slate-700",
  "checked-out":"bg-slate-600 text-white border-slate-700",
  pending:      "bg-amber-500 text-white border-amber-600",
  cancelled:    "bg-red-500 text-white border-red-600",
}

export const STATUS_LABELS: Record<string, string> = {
  pending:       "Pendiente",
  confirmed:     "Confirmada",
  checked_in:    "Check-in",
  "checked-in":  "Check-in",
  checked_out:   "Check-out",
  "checked-out": "Check-out",
  cancelled:     "Cancelada",
}

export const BLOCK_LABELS: Record<string, string> = {
  maintenance:     "Mantenimiento",
  owner_use:       "Uso propietario",
  out_of_service:  "Fuera de servicio",
  other:           "Bloqueada",
}

export function normalizedStatus(value: string) {
  return value.replaceAll("-", "_")
}

// ---------------------------------------------------------------------------
// Types (mirrors the interfaces in page.tsx)
// ---------------------------------------------------------------------------
export interface Bed {
  id: string
  bed_number: string
  bed_type: string
  room: {
    id: string
    room_number: string
    room_type?: string
    location_id: string
    location_ref?: { id: string; name: string }
  }
}

export interface CalendarEvent {
  event_id: string
  event_type: "reservation" | "block"
  bed_id: string
  room_id: string
  location_id: string
  starts_on: string
  ends_on: string
  status: string
  label: string
  guest_name: string | null
  block_type: string | null
  source: string | null
  total_amount: number | null
}

export interface ResizeState {
  reservationId: string
  bedId: string
  edge: ReservationResizeEdge
  pointerId: number
  pointerStartX: number
  originalStart: string
  originalEnd: string
  previewStart: string
  previewEnd: string
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface TimelineRowProps {
  bed: Bed
  dates: Date[]
  timelineWidth: number
  isTouchDevice: boolean

  // Events for this row
  bedEvents: CalendarEvent[]

  // Selection (Phase B)
  selectedIds: Set<string>
  conflictIds: Set<string>
  isBulkMode: boolean
  onToggleSelect: (eventId: string, shiftKey: boolean) => void

  // Drag & Drop (HTML DnD — will be replaced in PR 2)
  draggingEventId: string | null
  dropTargetBedId: string | null
  movingReservationId: string | null
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDragEnter: () => void
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onEventDragStart: (event: CalendarEvent, transfer: DataTransfer) => void
  onEventDragEnd: () => void

  // Resize
  resizeState: ResizeState | null
  resizingReservationId: string | null
  confirmingReservationId: string | null
  isResizing: boolean
  resizeConflict: CalendarEvent | null
  onBeginResize: (event: CalendarEvent, edge: ReservationResizeEdge, pointerEvent: React.PointerEvent<HTMLSpanElement>) => void
  onMoveResize: (pointerEvent: React.PointerEvent<HTMLSpanElement>) => void
  onFinishResize: (pointerEvent: React.PointerEvent<HTMLSpanElement>) => Promise<void>
  onClearResize: () => void

  // FLIP
  blockRefCallback: (eventId: string, el: HTMLButtonElement | null) => void

  // Geometry helpers
  eventGeometry: (event: CalendarEvent) => { left: number; width: number }
  geometryForDates: (startsOn: string, endsOn: string) => { left: number; width: number }

  // Row click (create new reservation)
  onRowClick: (bed: Bed, clientX: number, currentTarget: HTMLDivElement) => void

  // Event detail
  onOpenReservation: (event: CalendarEvent) => void
  onOpenBlock: (event: CalendarEvent) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TimelineRow({
  bed,
  dates,
  timelineWidth,
  isTouchDevice,
  bedEvents,
  selectedIds,
  conflictIds,
  isBulkMode,
  onToggleSelect,
  draggingEventId,
  dropTargetBedId,
  movingReservationId,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onEventDragStart,
  onEventDragEnd,
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
  onOpenReservation,
  onOpenBlock,
}: TimelineRowProps) {
  const isDropTarget = dropTargetBedId === bed.id && !!draggingEventId

  return (
    <div
      className={`flex border-b transition ${isDropTarget ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500" : "hover:bg-muted/20"}`}
      style={{ height: ROW_HEIGHT }}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Label */}
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background px-4"
        style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
      >
        <div className="flex-1 overflow-hidden">
          <div className="truncate font-medium">{bed.room.location_ref?.name ?? "Sin propiedad"}</div>
          <div className="truncate text-xs text-muted-foreground">
            Hab. {bed.room.room_number} · {bed.bed_number} · {bed.bed_type}
          </div>
        </div>
      </div>

      {/* Timeline cell */}
      <div
        className="relative cursor-crosshair"
        style={{
          width: timelineWidth,
          height: ROW_HEIGHT,
          backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH - 1}px, hsl(var(--border)) ${DAY_WIDTH}px)`,
        }}
        onClick={(e) => onRowClick(bed, e.clientX, e.currentTarget)}
      >
        {/* Today highlight */}
        {dates.map((date, index) =>
          isSameDay(date, new Date()) ? (
            <div
              key={`today-${bed.id}-${index}`}
              className="pointer-events-none absolute inset-y-0 bg-amber-50/70"
              style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
            />
          ) : null,
        )}

        {/* Events */}
        {bedEvents.map((event) => {
          const geometry             = eventGeometry(event)
          const isBlock              = event.event_type === "block"
          const isMoving             = movingReservationId === event.event_id
          const isEventResizing      = resizingReservationId === event.event_id
          const isConfirmingResize   = confirmingReservationId === event.event_id
          const previewGeometry      = isEventResizing && resizeState
            ? geometryForDates(resizeState.previewStart, resizeState.previewEnd)
            : null
          const hasConflict          = isEventResizing && !!resizeConflict
          const isSelected           = !isBlock && selectedIds.has(event.event_id)
          const isBulkConflict       = conflictIds.has(event.event_id)

          return (
            <div key={`${event.event_type}-${event.event_id}-${bed.id}`}>
              {/* Resize preview pastilla */}
              {previewGeometry && (
                <div
                  className={`pointer-events-none absolute top-2 z-20 h-[52px] rounded-md border-2 border-dashed shadow-sm transition-all duration-150 ${
                    hasConflict
                      ? "border-red-200 bg-red-600/75"
                      : "border-white/90 bg-emerald-500/65"
                  }`}
                  style={{ left: previewGeometry.left, width: previewGeometry.width }}
                >
                  <div className="truncate px-3 pt-1 text-xs font-semibold text-white">
                    {hasConflict ? "No disponible" : "Disponible"} · {resizeState!.previewStart} → {resizeState!.previewEnd}
                  </div>
                  <div className="truncate px-3 text-[10px] text-white/90">
                    {hasConflict
                      ? resizeConflict?.event_type === "block"
                        ? "Conflicto con bloqueo"
                        : "Conflicto con otra reserva"
                      : "Suelta para confirmar"}
                  </div>
                </div>
              )}

              {/* Reservation / Block button */}
              <button
                type="button"
                ref={(el) => blockRefCallback(event.event_id, el)}
                draggable={!isBlock && !movingReservationId && !isResizing && !confirmingReservationId && !isBulkMode}
                onDragStart={(e) => !isBlock && onEventDragStart(event, e.dataTransfer)}
                onDragEnd={onEventDragEnd}
                onClick={(e) => {
                  e.stopPropagation()
                  if (draggingEventId || isResizing || confirmingReservationId) return
                  if (!isBlock && (e.ctrlKey || e.metaKey || isBulkMode)) {
                    onToggleSelect(event.event_id, e.shiftKey)
                    return
                  }
                  if (isBlock) onOpenBlock(event)
                  else onOpenReservation(event)
                }}
                className={`group absolute top-2 h-[52px] overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary ${
                  isBulkConflict ? "ring-2 ring-amber-400" : ""
                } ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-primary brightness-110" : ""} ${
                  isBlock
                    ? "border-zinc-500 bg-zinc-800 text-white"
                    : `${STATUS_STYLES[normalizedStatus(event.status)] ?? "bg-slate-600 text-white border-slate-700"}`
                } ${isMoving || isConfirmingResize ? "opacity-60" : ""}`}
                style={{ left: geometry.left, width: geometry.width }}
                aria-label={`${
                  isBlock
                    ? (BLOCK_LABELS[event.block_type ?? "other"] ?? "Bloqueada")
                    : event.guest_name ?? event.label
                } ${
                  isBlock
                    ? event.label
                    : `${STATUS_LABELS[event.status] ?? event.status} · ${event.starts_on} → ${event.ends_on}`
                }`}
              >
                {/* Bulk select checkbox */}
                {!isBlock && (
                  <span
                    className={`absolute left-1 top-1 z-10 transition ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(event.event_id, false) }}
                  >
                    {isSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                  </span>
                )}

                {/* Resize handles (left / right) */}
                {!isBlock && (
                  <>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 z-10 cursor-ew-resize bg-white/0 opacity-0 transition hover:bg-white/35 group-hover:opacity-100 ${isTouchDevice ? "w-8" : "w-2"}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      onPointerDown={(e) => onBeginResize(event, "left", e)}
                      onPointerMove={onMoveResize}
                      onPointerUp={(e) => void onFinishResize(e)}
                      onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); onClearResize() }}
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 right-0 z-10 cursor-ew-resize bg-white/0 opacity-0 transition hover:bg-white/35 group-hover:opacity-100 ${isTouchDevice ? "w-8" : "w-2"}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      onPointerDown={(e) => onBeginResize(event, "right", e)}
                      onPointerMove={onMoveResize}
                      onPointerUp={(e) => void onFinishResize(e)}
                      onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); onClearResize() }}
                    />
                  </>
                )}

                {/* Text content */}
                <div className="truncate font-semibold">
                  {isMoving
                    ? "Validando movimiento…"
                    : isConfirmingResize
                      ? "Confirmando fechas…"
                      : isEventResizing
                        ? "Ajustando fechas…"
                        : isBlock
                          ? (BLOCK_LABELS[event.block_type ?? "other"] ?? "Bloqueada")
                          : event.guest_name ?? event.label}
                </div>
                <div className="truncate opacity-80">
                  {isBlock
                    ? event.label
                    : `${STATUS_LABELS[normalizedStatus(event.status)] ?? event.status} · ${event.starts_on} → ${event.ends_on}`}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

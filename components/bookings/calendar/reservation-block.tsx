"use client"

import type React from "react"
import { CheckSquare, Square } from "lucide-react"
import type { CalendarGeometry, CalendarInventoryEvent } from "@/app/bookings/calendar/calendar-types"
import type { ReservationResizeEdge } from "@/app/bookings/calendar/use-reservation-resize-state"

interface ReservationBlockProps {
  event: CalendarInventoryEvent
  geometry: CalendarGeometry
  statusClassName: string
  statusLabel: string
  blockLabel: string
  isMoving: boolean
  isResizing: boolean
  isConfirming: boolean
  isSelected: boolean
  isBulkConflict: boolean
  isBulkMode: boolean
  isTouchDevice: boolean
  interactionsDisabled: boolean
  setElementRef: (element: HTMLButtonElement | null) => void
  onOpen: () => void
  onToggleSelect: (shiftKey: boolean) => void
  onMoveStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onMoveEnd: (event: React.PointerEvent<HTMLButtonElement>) => void
  onMoveCancel: (event: React.PointerEvent<HTMLButtonElement>) => void
  onResizeStart: (edge: ReservationResizeEdge, event: React.PointerEvent<HTMLSpanElement>) => void
  onResizeMove: (event: React.PointerEvent<HTMLSpanElement>) => void
  onResizeEnd: (event: React.PointerEvent<HTMLSpanElement>) => void
  onResizeCancel: (event: React.PointerEvent<HTMLSpanElement>) => void
}

export function ReservationBlock({
  event,
  geometry,
  statusClassName,
  statusLabel,
  blockLabel,
  isMoving,
  isResizing,
  isConfirming,
  isSelected,
  isBulkConflict,
  isBulkMode,
  isTouchDevice,
  interactionsDisabled,
  setElementRef,
  onOpen,
  onToggleSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onMoveCancel,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeCancel,
}: ReservationBlockProps) {
  const isBlock = event.event_type === "block"
  const title = isMoving
    ? "Validando movimiento…"
    : isConfirming
      ? "Confirmando fechas…"
      : isResizing
        ? "Ajustando fechas…"
        : isBlock
          ? blockLabel
          : event.guest_name ?? event.label

  const subtitle = isBlock
    ? event.label
    : `${statusLabel} · ${event.starts_on} → ${event.ends_on}`

  const touchHandleClass = isTouchDevice
    ? "w-8 opacity-100 bg-white/10"
    : "w-2 opacity-0 group-hover:opacity-100"

  return (
    <button
      type="button"
      ref={setElementRef}
      onPointerDown={(pointerEvent) => {
        if (isBlock || interactionsDisabled || isBulkMode || pointerEvent.button !== 0) return
        onMoveStart(pointerEvent)
      }}
      onPointerMove={(pointerEvent) => {
        if (!isBlock) onMove(pointerEvent)
      }}
      onPointerUp={(pointerEvent) => {
        if (!isBlock) onMoveEnd(pointerEvent)
      }}
      onPointerCancel={(pointerEvent) => {
        if (!isBlock) onMoveCancel(pointerEvent)
      }}
      onLostPointerCapture={(pointerEvent) => {
        if (!isBlock) onMoveCancel(pointerEvent)
      }}
      onClick={(buttonEvent) => {
        buttonEvent.stopPropagation()
        if (interactionsDisabled || isMoving || isResizing) return
        if (!isBlock && (buttonEvent.ctrlKey || buttonEvent.metaKey || isBulkMode)) {
          onToggleSelect(buttonEvent.shiftKey)
          return
        }
        onOpen()
      }}
      className={`group absolute top-2 h-[52px] overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary ${isBulkConflict ? "ring-2 ring-amber-400" : ""} ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-primary brightness-110" : ""} ${isBlock ? "border-zinc-500 bg-zinc-800 text-white" : statusClassName} ${isMoving || isConfirming ? "opacity-60" : ""}`}
      style={{ left: geometry.left, width: geometry.width, touchAction: "none" }}
      aria-label={`${isBlock ? blockLabel : event.guest_name ?? event.label} ${subtitle}`}
    >
      {!isBlock && (
        <span
          className={`absolute left-1 top-1 z-20 transition ${isSelected || isTouchDevice ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
          onPointerDown={(selectionEvent) => selectionEvent.stopPropagation()}
          onClick={(selectionEvent) => {
            selectionEvent.stopPropagation()
            onToggleSelect(false)
          }}
        >
          {isSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </span>
      )}

      {!isBlock && (
        <>
          <ResizeHandle
            side="left"
            edge="left"
            className={touchHandleClass}
            onStart={onResizeStart}
            onMove={onResizeMove}
            onEnd={onResizeEnd}
            onCancel={onResizeCancel}
          />
          <ResizeHandle
            side="right"
            edge="right"
            className={touchHandleClass}
            onStart={onResizeStart}
            onMove={onResizeMove}
            onEnd={onResizeEnd}
            onCancel={onResizeCancel}
          />
        </>
      )}

      <div className="truncate font-semibold">{title}</div>
      <div className="truncate opacity-80">{subtitle}</div>
    </button>
  )
}

interface ResizeHandleProps {
  side: "left" | "right"
  edge: ReservationResizeEdge
  className: string
  onStart: (edge: ReservationResizeEdge, event: React.PointerEvent<HTMLSpanElement>) => void
  onMove: (event: React.PointerEvent<HTMLSpanElement>) => void
  onEnd: (event: React.PointerEvent<HTMLSpanElement>) => void
  onCancel: (event: React.PointerEvent<HTMLSpanElement>) => void
}

function ResizeHandle({ side, edge, className, onStart, onMove, onEnd, onCancel }: ResizeHandleProps) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 z-10 cursor-ew-resize bg-white/0 transition hover:bg-white/35 ${side === "left" ? "left-0" : "right-0"} ${className}`}
      style={{ touchAction: "none" }}
      onClick={(handleEvent) => {
        handleEvent.preventDefault()
        handleEvent.stopPropagation()
      }}
      onPointerDown={(pointerEvent) => {
        pointerEvent.stopPropagation()
        onStart(edge, pointerEvent)
      }}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
    />
  )
}

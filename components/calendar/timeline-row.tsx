"use client"

import { useState } from "react"
import { isSameDay, parseISO } from "date-fns"
import { CheckSquare, ChevronDown, ChevronRight, Square, Users } from "lucide-react"
import type { ReservationResizeEdge } from "@/app/bookings/calendar/use-reservation-resize-state"
import { ReservationPreview, type PreviewConflict } from "@/components/calendar/reservation-preview"
import { CreationSelection, type CreationRange } from "@/components/calendar/creation-selection"
import { ReservationOperationalLanes, type CalendarLayerKey } from "@/components/calendar/reservation-operational-lanes"
import { ReservationQuickInspector } from "@/components/calendar/reservation-quick-inspector"
import { useLanguage, type Language } from "@/lib/hooks/use-language"

export const DAY_WIDTH = 46
export const LABEL_WIDTH = 176
export const ROW_HEIGHT = 45

export const STATUS_STYLES: Record<string, string> = {
  confirmed: "border-white/35 bg-[#292929] text-white",
  checked_in: "border-emerald-500/70 bg-[#292929] text-white",
  "checked-in": "border-emerald-500/70 bg-[#292929] text-white",
  checked_out: "border-slate-500/60 bg-[#292929] text-white/80",
  "checked-out": "border-slate-500/60 bg-[#292929] text-white/80",
  pending: "border-amber-400/70 bg-[#292929] text-white",
  cancelled: "border-red-500/70 bg-[#292929] text-white/70",
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmada", checked_in: "Check-in", "checked-in": "Check-in",
  checked_out: "Check-out", "checked-out": "Check-out", cancelled: "Cancelada",
}

export const BLOCK_LABELS: Record<string, string> = {
  maintenance: "Mantenimiento", owner_use: "Uso propietario", out_of_service: "Fuera de servicio", other: "Bloqueada",
}

const localizedCopy = {
  en: {
    statuses: { pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Completed", cancelled: "Cancelled" },
    blocks: { maintenance: "Maintenance", owner_use: "Owner use", out_of_service: "Out of service", other: "Blocked" },
    hideOperations: "Hide operations", showOperations: "Show operations", validating: "Validating…", confirming: "Confirming…", resizing: "Adjusting…", checkinToday: "Check-in today", checkoutToday: "Check-out today", unavailable: "Unavailable", moveTo: "Move to",
  },
  es: {
    statuses: { pending: "Pendiente", confirmed: "Confirmada", checked_in: "Hospedado", checked_out: "Finalizada", cancelled: "Cancelada" },
    blocks: { maintenance: "Mantenimiento", owner_use: "Uso propietario", out_of_service: "Fuera de servicio", other: "Bloqueada" },
    hideOperations: "Ocultar operación", showOperations: "Mostrar operación", validating: "Validando…", confirming: "Confirmando…", resizing: "Ajustando…", checkinToday: "Check-in hoy", checkoutToday: "Check-out hoy", unavailable: "No disponible", moveTo: "Mover a",
  },
  de: {
    statuses: { pending: "Ausstehend", confirmed: "Bestätigt", checked_in: "Eingecheckt", checked_out: "Abgeschlossen", cancelled: "Storniert" },
    blocks: { maintenance: "Wartung", owner_use: "Eigentümernutzung", out_of_service: "Außer Betrieb", other: "Gesperrt" },
    hideOperations: "Betrieb ausblenden", showOperations: "Betrieb anzeigen", validating: "Wird geprüft…", confirming: "Wird bestätigt…", resizing: "Wird angepasst…", checkinToday: "Check-in heute", checkoutToday: "Check-out heute", unavailable: "Nicht verfügbar", moveTo: "Verschieben nach",
  },
} satisfies Record<Language, {
  statuses: Record<string, string>
  blocks: Record<string, string>
  hideOperations: string; showOperations: string; validating: string; confirming: string; resizing: string; checkinToday: string; checkoutToday: string; unavailable: string; moveTo: string
}>

export function normalizedStatus(value: string) { return value.replaceAll("-", "_") }

export interface Bed {
  id: string
  bed_number: string
  bed_type: string
  display_name?: string
  guest_capacity?: number | null
  room: { id: string; room_number: string; room_type?: string; location_id: string; location_ref?: { id: string; name: string } }
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

export interface TimelineRowProps {
  bed: Bed
  dates: Date[]
  timelineWidth: number
  isTouchDevice: boolean
  bedEvents: CalendarEvent[]
  activeLayers: Set<CalendarLayerKey>
  selectedIds: Set<string>
  conflictIds: Set<string>
  isBulkMode: boolean
  onToggleSelect: (eventId: string, shiftKey: boolean) => void
  draggingEventId: string | null
  dropTargetBedId: string | null
  movingReservationId: string | null
  moveConflict: boolean
  draggingEvent: CalendarEvent | null
  onEventPointerDown: (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerMove: (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerUp: (event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLButtonElement>) => void
  onEventPointerCancel: () => void
  resizeState: ResizeState | null
  resizingReservationId: string | null
  confirmingReservationId: string | null
  isResizing: boolean
  resizeConflict: CalendarEvent | null
  onBeginResize: (event: CalendarEvent, edge: ReservationResizeEdge, pointerEvent: React.PointerEvent<HTMLSpanElement>) => void
  onMoveResize: (pointerEvent: React.PointerEvent<HTMLSpanElement>) => void
  onFinishResize: (pointerEvent: React.PointerEvent<HTMLSpanElement>) => Promise<void>
  onClearResize: () => void
  blockRefCallback: (eventId: string, element: HTMLButtonElement | null) => void
  eventGeometry: (event: CalendarEvent) => { left: number; width: number }
  geometryForDates: (startsOn: string, endsOn: string) => { left: number; width: number }
  onRowClick: (bed: Bed, clientX: number, currentTarget: HTMLDivElement) => void
  creatingRange: { bedId: string; startDate: string; endDate: string } | null
  onCreationStart: (range: CreationRange) => void
  onCreationAbort: () => void
  onCreationCommit: (range: CreationRange) => void
  onOpenReservation: (event: CalendarEvent) => void
  onOpenBlock: (event: CalendarEvent) => void
}

export function TimelineRow(props: TimelineRowProps) {
  const {
    bed, dates, timelineWidth, isTouchDevice, bedEvents, activeLayers, selectedIds, conflictIds, isBulkMode, onToggleSelect,
    draggingEventId, dropTargetBedId, movingReservationId, moveConflict, draggingEvent, onEventPointerDown,
    onEventPointerMove, onEventPointerUp, onEventPointerCancel, resizeState, resizingReservationId,
    confirmingReservationId, isResizing, resizeConflict, onBeginResize, onMoveResize, onFinishResize,
    onClearResize, blockRefCallback, eventGeometry, geometryForDates, onRowClick,
    onCreationStart, onCreationAbort, onCreationCommit, onOpenReservation, onOpenBlock,
  } = props
  const { language } = useLanguage()
  const c = localizedCopy[language]
  const statusLabels = c.statuses as Record<string, string>
  const blockLabels = c.blocks as Record<string, string>
  const [expandedReservationId, setExpandedReservationId] = useState<string | null>(null)
  const [inspectedReservation, setInspectedReservation] = useState<CalendarEvent | null>(null)
  const isDropTarget = dropTargetBedId === bed.id && Boolean(draggingEventId)
  const expandedReservation = bedEvents.find((event) => event.event_type === "reservation" && event.event_id === expandedReservationId) ?? null

  return (
    <div className={`border-b border-white/5 transition [content-visibility:auto] [contain-intrinsic-size:45px] ${isDropTarget ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500" : ""}`} data-bed-id={bed.id} data-calendar-row>
      <div className="flex" style={{ height: ROW_HEIGHT }}>
        <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-white/10 bg-[#162425] px-2" style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium leading-4 text-white/90">{bed.display_name ?? bed.bed_number}</div>
            <div className="flex items-center gap-1 text-[10px] leading-3 text-white/65">
              {typeof bed.guest_capacity === "number" ? <><Users className="h-3 w-3" /><span>{bed.guest_capacity}</span></> : <span className="truncate">{bed.bed_type}</span>}
            </div>
          </div>
        </div>
        <div className="relative cursor-crosshair" style={{ width: timelineWidth, height: ROW_HEIGHT, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_WIDTH - 1}px, rgba(255,255,255,.06) ${DAY_WIDTH - 1}px, rgba(255,255,255,.06) ${DAY_WIDTH}px)` }} onClick={(event) => onRowClick(bed, event.clientX, event.currentTarget)}>
          <CreationSelection bedId={bed.id} dates={dates} timelineWidth={timelineWidth} isActive={!draggingEventId && !isResizing && !isBulkMode} onCreationStart={onCreationStart} onCreationAbort={onCreationAbort} onCreationCommit={onCreationCommit} />
          {dates.map((date, index) => isSameDay(date, new Date()) ? <div key={`today-${bed.id}-${index}`} className="pointer-events-none absolute inset-y-0 bg-emerald-600/20" style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }} /> : null)}
          {bedEvents.map((event) => {
            const geometry = eventGeometry(event)
            const isBlock = event.event_type === "block"
            const isMoving = movingReservationId === event.event_id
            const isEventResizing = resizingReservationId === event.event_id
            const isConfirmingResize = confirmingReservationId === event.event_id
            const previewGeometry = isEventResizing && resizeState ? geometryForDates(resizeState.previewStart, resizeState.previewEnd) : null
            const hasConflict = isEventResizing && Boolean(resizeConflict)
            const isSelected = !isBlock && selectedIds.has(event.event_id)
            const isBulkConflict = conflictIds.has(event.event_id)
            const isExpanded = expandedReservationId === event.event_id
            const statusKey = normalizedStatus(event.status)
            const blockKey = event.block_type ?? "other"
            return <div key={`${event.event_type}-${event.event_id}-${bed.id}`}>
              {previewGeometry && <ReservationPreview left={previewGeometry.left} width={previewGeometry.width} intent="resize" conflict={!hasConflict ? "none" : (resizeConflict?.event_type === "block" ? "block" : "reservation") satisfies PreviewConflict} label={`${resizeState!.previewStart} → ${resizeState!.previewEnd}`} />}
              <button type="button" ref={(element) => blockRefCallback(event.event_id, element)}
                onPointerDown={(pointerEvent) => { if (!isBlock && !movingReservationId && !isResizing && !confirmingReservationId && !isBulkMode) onEventPointerDown(event, pointerEvent) }}
                onPointerMove={(pointerEvent) => { if (!isBlock) onEventPointerMove(event, pointerEvent) }}
                onPointerUp={(pointerEvent) => { if (!isBlock) onEventPointerUp(event, pointerEvent) }}
                onPointerCancel={() => { if (!isBlock) onEventPointerCancel() }}
                onClick={(clickEvent) => { clickEvent.stopPropagation(); if (draggingEventId || isResizing || confirmingReservationId) return; if (!isBlock && (clickEvent.ctrlKey || clickEvent.metaKey || isBulkMode)) { onToggleSelect(event.event_id, clickEvent.shiftKey); return } if (isBlock) onOpenBlock(event); else setInspectedReservation(event) }}
                onDoubleClick={(doubleClickEvent) => { doubleClickEvent.stopPropagation(); if (!isBlock) onOpenReservation(event) }}
                className={`group absolute top-[5px] h-[35px] overflow-hidden border px-3 text-left text-[11px] shadow-none transition-all duration-100 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isBulkConflict ? "ring-2 ring-amber-400" : ""} ${isSelected ? "ring-2 ring-white" : ""} ${isBlock ? "border-zinc-500/70 bg-zinc-800 text-white" : STATUS_STYLES[statusKey] ?? "border-white/35 bg-[#292929] text-white"} ${isMoving || isConfirmingResize ? "opacity-60" : ""}`}
                style={{ left: geometry.left, width: geometry.width, clipPath: isBlock ? undefined : "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                {!isBlock && <span className={`absolute left-2 top-1 z-10 transition ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} onClick={(clickEvent) => { clickEvent.stopPropagation(); onToggleSelect(event.event_id, false) }}>{isSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}</span>}
                {!isBlock && <><span aria-hidden="true" className={`absolute inset-y-0 left-0 z-10 cursor-ew-resize opacity-0 hover:bg-white/20 group-hover:opacity-100 ${isTouchDevice ? "w-8" : "w-2"}`} onClick={(clickEvent) => { clickEvent.preventDefault(); clickEvent.stopPropagation() }} onPointerDown={(pointerEvent) => onBeginResize(event, "left", pointerEvent)} onPointerMove={onMoveResize} onPointerUp={(pointerEvent) => void onFinishResize(pointerEvent)} onPointerCancel={(pointerEvent) => { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); onClearResize() }} /><span aria-hidden="true" className={`absolute inset-y-0 right-0 z-10 cursor-ew-resize opacity-0 hover:bg-white/20 group-hover:opacity-100 ${isTouchDevice ? "w-8" : "w-2"}`} onClick={(clickEvent) => { clickEvent.preventDefault(); clickEvent.stopPropagation() }} onPointerDown={(pointerEvent) => onBeginResize(event, "right", pointerEvent)} onPointerMove={onMoveResize} onPointerUp={(pointerEvent) => void onFinishResize(pointerEvent)} onPointerCancel={(pointerEvent) => { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); onClearResize() }} /></>}
                {!isBlock && <span role="button" tabIndex={0} aria-label={isExpanded ? c.hideOperations : c.showOperations} className="absolute right-2 top-1 z-30 inline-flex h-4 w-4 items-center justify-center bg-black/20 hover:bg-black/35" onPointerDown={(pointerEvent) => { pointerEvent.preventDefault(); pointerEvent.stopPropagation() }} onClick={(clickEvent) => { clickEvent.preventDefault(); clickEvent.stopPropagation(); setExpandedReservationId((current) => current === event.event_id ? null : event.event_id) }} onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter" || keyEvent.key === " ") { keyEvent.preventDefault(); keyEvent.stopPropagation(); setExpandedReservationId((current) => current === event.event_id ? null : event.event_id) } }}>{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span>}
                <div className="truncate pr-5 font-medium leading-4">{isMoving ? c.validating : isConfirmingResize ? c.confirming : isEventResizing ? c.resizing : isBlock ? blockLabels[blockKey] ?? blockLabels.other : event.guest_name ?? event.label}</div>
                <div className="truncate pr-5 text-[9px] opacity-65">{isBlock ? event.label : statusLabels[statusKey] ?? event.status}</div>
                {!isBlock && isSameDay(parseISO(event.starts_on), new Date()) && <div className="absolute left-0 top-0 h-full w-0.5 bg-emerald-400" title={c.checkinToday} />}
                {!isBlock && isSameDay(parseISO(event.ends_on), new Date()) && <div className="absolute right-0 top-0 h-full w-0.5 bg-amber-300" title={c.checkoutToday} />}
              </button>
            </div>
          })}
          {dropTargetBedId === bed.id && draggingEvent && <ReservationPreview left={eventGeometry(draggingEvent).left} width={eventGeometry(draggingEvent).width} intent="move" conflict={moveConflict ? "reservation" : "none"} label={moveConflict ? c.unavailable : `${c.moveTo}: ${draggingEvent.starts_on} → ${draggingEvent.ends_on}`} />}
        </div>
      </div>
      {expandedReservation && <ReservationOperationalLanes reservation={expandedReservation} timelineWidth={timelineWidth} geometryForDates={geometryForDates} activeLayers={activeLayers} />}
      <ReservationQuickInspector reservation={inspectedReservation} open={Boolean(inspectedReservation)} onOpenChange={(open) => { if (!open) setInspectedReservation(null) }} onOpenFull={(reservation) => { setInspectedReservation(null); onOpenReservation(reservation) }} />
    </div>
  )
}

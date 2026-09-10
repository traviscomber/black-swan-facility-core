"use client"

import { useCallback, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import type { CalendarEvent, Bed } from "@/components/calendar/timeline-row"

export interface MoveState {
  event: CalendarEvent
  pointerId: number
  startX: number
  sourceBedId: string
}

export interface CreatingRange {
  bedId: string
  startDate: string
  endDate: string
}

export interface CalendarInteractionState {
  draggingEventId: string | null
  dropTargetBedId: string | null
  movingReservationId: string | null
  creatingRange: CreatingRange | null
}

export interface UseCalendarInteractionOptions {
  supabase: SupabaseClient
  events: CalendarEvent[]
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>
  isResizing: boolean
  confirmingReservationId: string | null
  isBulkModeRef: React.MutableRefObject<boolean>
  captureRect: (id: string, el: HTMLElement | null) => void
  pendingFlipIds: React.MutableRefObject<string[]>
  blockRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>
  onMoveComplete: () => Promise<void>
}

function overlaps(a: CalendarEvent, b: CalendarEvent) {
  return a.starts_on < b.ends_on && a.ends_on > b.starts_on
}

export function useCalendarInteraction({
  supabase,
  events,
  setEvents,
  isResizing,
  confirmingReservationId,
  isBulkModeRef,
  captureRect,
  pendingFlipIds,
  blockRefs,
  onMoveComplete,
}: UseCalendarInteractionOptions) {
  const [moveState, setMoveState] = useState<MoveState | null>(null)
  const [dropTargetBedId, setDropTargetBedId] = useState<string | null>(null)
  const [movingReservationId, setMovingReservationId] = useState<string | null>(null)
  const [moveConflict, setMoveConflict] = useState(false)
  const [creatingRange, setCreatingRange] = useState<CreatingRange | null>(null)
  const captureElRef = useRef<HTMLElement | null>(null)

  const beginMove = useCallback((event: CalendarEvent, pointerEvent: React.PointerEvent<HTMLElement>) => {
    if (event.event_type !== "reservation" || isResizing || confirmingReservationId || isBulkModeRef.current) return
    pointerEvent.preventDefault()
    pointerEvent.stopPropagation()
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
    captureElRef.current = pointerEvent.currentTarget
    setMoveState({ event, pointerId: pointerEvent.pointerId, startX: pointerEvent.clientX, sourceBedId: event.bed_id })
    setDropTargetBedId(null)
    setMoveConflict(false)
  }, [confirmingReservationId, isBulkModeRef, isResizing])

  // Pointer movement is deliberately local-only. The visible range already has
  // reservations and blocks, so conflict feedback requires no network request.
  // The database remains authoritative and is checked once on pointer-up.
  const updateMove = useCallback((pointerEvent: React.PointerEvent<HTMLElement>, beds: Bed[]) => {
    if (!moveState || moveState.pointerId !== pointerEvent.pointerId) return
    pointerEvent.preventDefault()

    const captured = captureElRef.current
    if (captured?.hasPointerCapture(pointerEvent.pointerId)) captured.releasePointerCapture(pointerEvent.pointerId)
    const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
    if (captured) captured.setPointerCapture(pointerEvent.pointerId)

    let node: Element | null = target
    let foundBedId: string | null = null
    while (node) {
      const value = node.getAttribute("data-bed-id")
      if (value) { foundBedId = value; break }
      node = node.parentElement
    }

    const validTarget = foundBedId && beds.some((bed) => bed.id === foundBedId) ? foundBedId : null
    const nextDropTarget = validTarget !== moveState.sourceBedId ? validTarget : null
    setDropTargetBedId(nextDropTarget)

    if (!nextDropTarget) { setMoveConflict(false); return }
    const conflict = events.some((event) => event.bed_id === nextDropTarget && event.event_id !== moveState.event.event_id && overlaps(event, moveState.event))
    setMoveConflict(conflict)
  }, [events, moveState])

  const cancelMove = useCallback(() => {
    setMoveState(null)
    setDropTargetBedId(null)
    setMoveConflict(false)
    captureElRef.current = null
  }, [])

  const commitMove = useCallback(async (pointerEvent: React.PointerEvent<HTMLElement>, beds: Bed[]) => {
    if (!moveState || moveState.pointerId !== pointerEvent.pointerId) { cancelMove(); return }
    pointerEvent.preventDefault()
    pointerEvent.stopPropagation()

    if (captureElRef.current?.hasPointerCapture(pointerEvent.pointerId)) captureElRef.current.releasePointerCapture(pointerEvent.pointerId)

    const currentDropTarget = dropTargetBedId
    const draggedEvent = moveState.event
    const knownConflict = moveConflict
    setMoveState(null)
    setDropTargetBedId(null)
    setMoveConflict(false)
    captureElRef.current = null

    const targetBed = beds.find((bed) => bed.id === currentDropTarget)
    if (!targetBed || targetBed.id === draggedEvent.bed_id) return
    if (knownConflict) { toast.error("La cama seleccionada tiene un conflicto visible para esas fechas"); return }

    setMovingReservationId(draggedEvent.event_id)

    // One authoritative availability check per completed drag, never per pointer move.
    const { data: available, error: availabilityError } = await supabase.rpc("is_booking_inventory_available", {
      p_bed_id: targetBed.id,
      p_room_id: targetBed.room.id,
      p_location_id: targetBed.room.location_id,
      p_check_in: draggedEvent.starts_on,
      p_check_out: draggedEvent.ends_on,
      p_exclude_reservation_id: draggedEvent.event_id,
    })

    if (availabilityError) {
      toast.error("No fue posible validar la disponibilidad")
      setMovingReservationId(null)
      return
    }
    if (!available) {
      toast.error("La cama seleccionada no está disponible para esas fechas")
      setMovingReservationId(null)
      return
    }

    const previousEvents = events
    captureRect(draggedEvent.event_id, blockRefs.current.get(draggedEvent.event_id) ?? null)
    pendingFlipIds.current.push(draggedEvent.event_id)
    setEvents((current) => current.map((event) => event.event_id === draggedEvent.event_id && event.event_type === "reservation" ? { ...event, bed_id: targetBed.id, room_id: targetBed.room.id, location_id: targetBed.room.location_id } : event))

    const { error: updateError } = await supabase.from("reservations").update({
      bed_id: targetBed.id,
      room_id: targetBed.room.id,
      location_id: targetBed.room.location_id,
      booking_type: "BED",
    }).eq("id", draggedEvent.event_id)

    if (updateError) {
      captureRect(draggedEvent.event_id, blockRefs.current.get(draggedEvent.event_id) ?? null)
      pendingFlipIds.current.push(draggedEvent.event_id)
      setEvents(previousEvents)
      toast.error("El movimiento fue rechazado y se restauró la reserva")
    } else {
      toast.success(`Reserva movida a Hab. ${targetBed.room.room_number} · ${targetBed.bed_number}`)
      await onMoveComplete()
    }
    setMovingReservationId(null)
  }, [blockRefs, cancelMove, captureRect, dropTargetBedId, events, moveConflict, moveState, onMoveComplete, pendingFlipIds, setEvents, supabase])

  const beginCreation = useCallback((range: CreatingRange) => { setCreatingRange(range) }, [])
  const abortCreation = useCallback(() => { setCreatingRange(null) }, [])
  const commitCreation = useCallback((_range: CreatingRange) => { setCreatingRange(null) }, [])
  const draggingEvent = moveState?.event ?? null

  return {
    draggingEventId: moveState?.event.event_id ?? null,
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
  }
}

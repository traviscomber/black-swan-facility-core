"use client"

import { useCallback, useRef, useState } from "react"
import { format } from "date-fns"
import type { SupabaseClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import type { CalendarEvent, Bed } from "@/components/calendar/timeline-row"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface MoveState {
  /** The reservation event being dragged */
  event: CalendarEvent
  /** Pointer id for capture tracking */
  pointerId: number
  /** X where the pointer was pressed (for delta calc) */
  startX: number
  /** Bed the event originated from */
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
  /** Ref so the hook always reads the latest value without needing to be re-created */
  isBulkModeRef: React.MutableRefObject<boolean>
  captureRect: (id: string, el: HTMLElement | null) => void
  pendingFlipIds: React.MutableRefObject<string[]>
  blockRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>
  onMoveComplete: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
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
  const [moveState, setMoveState]             = useState<MoveState | null>(null)
  const [dropTargetBedId, setDropTargetBedId] = useState<string | null>(null)
  const [movingReservationId, setMovingReservationId] = useState<string | null>(null)
  const [creatingRange, setCreatingRange]     = useState<CreatingRange | null>(null)

  // Ref to the source element that holds pointer capture
  const captureElRef = useRef<HTMLElement | null>(null)

  // -------------------------------------------------------------------------
  // beginMove — called from onPointerDown on a reservation button
  // -------------------------------------------------------------------------
  const beginMove = useCallback(
    (
      event: CalendarEvent,
      pointerEvent: React.PointerEvent<HTMLElement>,
    ) => {
      if (
        event.event_type !== "reservation" ||
        isResizing ||
        confirmingReservationId ||
        isBulkModeRef.current
      ) return

      pointerEvent.preventDefault()
      pointerEvent.stopPropagation()
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
      captureElRef.current = pointerEvent.currentTarget

      setMoveState({
        event,
        pointerId: pointerEvent.pointerId,
        startX: pointerEvent.clientX,
        sourceBedId: event.bed_id,
      })
      setDropTargetBedId(null)
    },
    [isResizing, confirmingReservationId, isBulkModeRef],
  )

  // -------------------------------------------------------------------------
  // updateMove — called from onPointerMove on the same element
  // Uses elementFromPoint to detect which bed row the pointer is over
  // -------------------------------------------------------------------------
  const updateMove = useCallback(
    (pointerEvent: React.PointerEvent<HTMLElement>) => {
      if (!moveState || moveState.pointerId !== pointerEvent.pointerId) return
      pointerEvent.preventDefault()

      // Release capture temporarily to hit-test the element underneath
      const el = captureElRef.current
      if (el) el.releasePointerCapture(pointerEvent.pointerId)

      const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)

      if (el) el.setPointerCapture(pointerEvent.pointerId)

      // Walk up DOM looking for data-bed-id
      let node: Element | null = target
      let foundBedId: string | null = null
      while (node) {
        const attr = node.getAttribute("data-bed-id")
        if (attr) { foundBedId = attr; break }
        node = node.parentElement
      }

      setDropTargetBedId(foundBedId !== moveState.sourceBedId ? foundBedId : null)
    },
    [moveState],
  )

  // -------------------------------------------------------------------------
  // commitMove — called from onPointerUp
  // -------------------------------------------------------------------------
  const commitMove = useCallback(
    async (pointerEvent: React.PointerEvent<HTMLElement>, beds: Bed[]) => {
      if (!moveState || moveState.pointerId !== pointerEvent.pointerId) {
        cancelMove()
        return
      }
      pointerEvent.preventDefault()
      pointerEvent.stopPropagation()

      if (captureElRef.current?.hasPointerCapture(pointerEvent.pointerId)) {
        captureElRef.current.releasePointerCapture(pointerEvent.pointerId)
      }

      const currentDropTarget = dropTargetBedId
      const draggedEvent      = moveState.event

      // Clear move state immediately so UI is responsive
      setMoveState(null)
      setDropTargetBedId(null)
      captureElRef.current = null

      // No target or same bed — nothing to do
      const targetBed = beds.find((b) => b.id === currentDropTarget)
      if (!targetBed || targetBed.id === draggedEvent.bed_id) return

      // -----------------------------------------------------------------------
      // Network: check availability then update
      // -----------------------------------------------------------------------
      setMovingReservationId(draggedEvent.event_id)

      const { data: available, error: availabilityError } = await supabase.rpc(
        "is_booking_inventory_available",
        {
          p_bed_id:                   targetBed.id,
          p_room_id:                  targetBed.room.id,
          p_location_id:              targetBed.room.location_id,
          p_check_in:                 draggedEvent.starts_on,
          p_check_out:                draggedEvent.ends_on,
          p_exclude_reservation_id:   draggedEvent.event_id,
        },
      )

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

      // FLIP: capture before optimistic update
      captureRect(draggedEvent.event_id, blockRefs.current.get(draggedEvent.event_id) ?? null)
      pendingFlipIds.current.push(draggedEvent.event_id)

      setEvents((current) =>
        current.map((e) =>
          e.event_id === draggedEvent.event_id && e.event_type === "reservation"
            ? { ...e, bed_id: targetBed.id, room_id: targetBed.room.id, location_id: targetBed.room.location_id }
            : e,
        ),
      )

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          bed_id:       targetBed.id,
          room_id:      targetBed.room.id,
          location_id:  targetBed.room.location_id,
          booking_type: "BED",
        })
        .eq("id", draggedEvent.event_id)

      if (updateError) {
        // FLIP: capture rollback position and animate back
        captureRect(draggedEvent.event_id, blockRefs.current.get(draggedEvent.event_id) ?? null)
        pendingFlipIds.current.push(draggedEvent.event_id)
        setEvents(previousEvents)
        toast.error("El movimiento fue rechazado y se restauró la reserva")
      } else {
        toast.success(
          `Reserva movida a Hab. ${targetBed.room.room_number} · ${targetBed.bed_number}`,
        )
        await onMoveComplete()
      }

      setMovingReservationId(null)
    },
    [
      moveState,
      dropTargetBedId,
      events,
      supabase,
      captureRect,
      pendingFlipIds,
      blockRefs,
      setEvents,
      onMoveComplete,
    ],
  )

  // -------------------------------------------------------------------------
  // cancelMove — pointer cancel or escape
  // -------------------------------------------------------------------------
  const cancelMove = useCallback(() => {
    setMoveState(null)
    setDropTargetBedId(null)
    captureElRef.current = null
  }, [])

  // -------------------------------------------------------------------------
  // Creation callbacks — wired from CreationSelection
  // -------------------------------------------------------------------------
  const beginCreation = useCallback((range: CreatingRange) => {
    setCreatingRange(range)
  }, [])

  const abortCreation = useCallback(() => {
    setCreatingRange(null)
  }, [])

  const commitCreation = useCallback((range: CreatingRange) => {
    setCreatingRange(null)
    // Caller (page.tsx) will handle opening the dialog with preselected dates
  }, [])

  // Expose dragging event for move preview rendering in target bed row
  const draggingEvent = moveState?.event ?? null

  return {
    // State exposed to TimelineGrid/TimelineRow
    draggingEventId:     moveState?.event.event_id ?? null,
    dropTargetBedId,
    movingReservationId,
    creatingRange,
    draggingEvent,

    // Handlers — Move
    beginMove,
    updateMove,
    commitMove,
    cancelMove,

    // Handlers — Creation
    beginCreation,
    abortCreation,
    commitCreation,
  }
}

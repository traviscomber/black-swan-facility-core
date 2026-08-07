"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BookingDragMode } from "@/lib/booking-drag"
import {
  type BookingCalendarBed,
  type BookingCalendarBlock,
  type BookingCalendarReservation,
  type BookingCalendarTransport,
  type CalendarContext,
  type Feedback,
  type Validation,
} from "@/components/booking-calendar-model"
import { useBookingCalendarMutations } from "@/components/use-booking-calendar-mutations"
import { useBookingCalendarDrag } from "@/components/use-booking-calendar-drag"
import { useBookingCalendarCreate } from "@/components/use-booking-calendar-create"
import { useBookingCalendarKeyboard } from "@/components/use-booking-calendar-keyboard"

type DragVisual = { reservationId: string; transform: string; width: number }
type CreateState = { bedId: string; first: number; last: number; state: "valid" | "invalid" }

type UseBookingCalendarInteractionsInput = {
  activeTransport: BookingCalendarTransport
  loadContext: () => Promise<void>
  setContext: React.Dispatch<React.SetStateAction<CalendarContext>>
  onRefresh: () => Promise<void> | void
  scrollRef: React.RefObject<HTMLDivElement | null>
  rowRefs: React.RefObject<Map<string, HTMLDivElement>>
  dates: Date[]
  dayWidth: number
  context: CalendarContext
  blocksForValidation: BookingCalendarBlock[]
  unavailableBedIds: Set<string>
  bedOrder: BookingCalendarBed[]
  pendingIds: Set<string>
  bedAtPoint: (clientY: number) => BookingCalendarBed | null
  validateProposal: (
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    targetBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    mode: BookingDragMode,
  ) => Validation
  onOpenReservation: (reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onOpenNewReservation: (bed: BookingCalendarBed, checkIn: Date, checkOut: Date) => void
}

export function useBookingCalendarInteractions({
  activeTransport,
  loadContext,
  setContext,
  onRefresh,
  scrollRef,
  rowRefs,
  dates,
  dayWidth,
  context,
  blocksForValidation,
  unavailableBedIds,
  bedOrder,
  pendingIds,
  bedAtPoint,
  validateProposal,
  onOpenReservation,
  onOpenNewReservation,
}: UseBookingCalendarInteractionsInput) {
  const suppressClickUntil = useRef(0)
  const cancelDragRef = useRef<() => void>(() => undefined)
  const cancelCreateRef = useRef<() => void>(() => undefined)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const [candidateStates, setCandidateStates] = useState<Record<string, Validation["state"]>>({})
  const [dropTargetBedId, setDropTargetBedId] = useState<string | null>(null)
  const [createState, setCreateState] = useState<CreateState | null>(null)
  const [keyboardReservationId, setKeyboardReservationId] = useState<string | null>(null)

  const clearInteractionState = useCallback(() => {
    setFeedback(null)
    setDragVisual(null)
    setCandidateStates({})
    setDropTargetBedId(null)
    setCreateState(null)
  }, [])

  const updateCandidateStates = useCallback((
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    mode: BookingDragMode,
  ) => {
    const states: Record<string, Validation["state"]> = {}
    bedOrder.forEach((bed) => {
      if (mode !== "move" && bed.id !== sourceBed.id) return
      states[bed.id] = validateProposal(reservation, sourceBed, bed, checkIn, checkOut, mode).state
    })
    setCandidateStates(states)
  }, [bedOrder, validateProposal])

  const { applyProposal } = useBookingCalendarMutations({ activeTransport, loadContext, setContext, onRefresh })

  const drag = useBookingCalendarDrag({
    scrollRef,
    rowRefs,
    dayWidth,
    pendingIds,
    bedAtPoint,
    validateProposal,
    updateCandidateStates,
    clearInteractionState,
    setDragVisual,
    setDropTargetBedId,
    setFeedback,
    suppressClickUntil,
    applyProposal,
    cancelOther: () => cancelCreateRef.current(),
  })
  const create = useBookingCalendarCreate({
    scrollRef,
    dates,
    dayWidth,
    context,
    blocksForValidation,
    unavailableBedIds,
    clearInteractionState,
    setCreateState,
    setFeedback,
    suppressClickUntil,
    onOpenNewReservation,
    cancelOther: () => cancelDragRef.current(),
  })
  const keyboard = useBookingCalendarKeyboard({
    bedOrder,
    pendingIds,
    validateProposal,
    updateCandidateStates,
    clearInteractionState,
    setDropTargetBedId,
    setFeedback,
    setKeyboardReservationId,
    applyProposal,
    onOpenReservation,
  })

  useEffect(() => {
    cancelDragRef.current = drag.cancelDrag
    cancelCreateRef.current = create.cancelCreate
  }, [create.cancelCreate, drag.cancelDrag])

  const cancelAll = useCallback(() => {
    drag.cancelDrag()
    create.cancelCreate()
    keyboard.cancelKeyboard()
    setKeyboardReservationId(null)
  }, [create, drag, keyboard])

  useEffect(() => {
    const onBlur = () => cancelAll()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (drag.dragRef.current || create.createRef.current || keyboard.keyboardRef.current)) cancelAll()
    }
    window.addEventListener("blur", onBlur)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [cancelAll, create.createRef, drag.dragRef, keyboard.keyboardRef])

  const onRootPointerMove = useCallback((event: React.PointerEvent) => {
    if (drag.onPointerMove(event)) return
    create.onPointerMove(event)
  }, [create, drag])

  const onRootPointerUp = useCallback((event: React.PointerEvent) => {
    void (async () => {
      if (await drag.finishDrag(event)) return
      create.finishCreate(event)
    })()
  }, [create, drag])

  const onReservationPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.onPointerMove(event)) return
    event.stopPropagation()
  }, [drag])

  const onReservationPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    void drag.finishDrag(event)
  }, [drag])

  const onReservationPointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    drag.cancelDrag()
  }, [drag])

  const onReservationClick = useCallback((reservation: BookingCalendarReservation, bed: BookingCalendarBed) => {
    if (Date.now() < suppressClickUntil.current) return
    onOpenReservation(reservation, bed)
  }, [onOpenReservation])

  return {
    feedback,
    dragVisual,
    candidateStates,
    dropTargetBedId,
    createState,
    keyboardReservationId,
    cancelAll,
    onRootPointerMove,
    onRootPointerUp,
    onReservationPointerDown: drag.onReservationPointerDown,
    onReservationPointerMove,
    onReservationPointerUp,
    onReservationPointerCancel,
    onReservationKeyDown: keyboard.onReservationKeyDown,
    onReservationClick,
    onCellPointerDown: create.onCellPointerDown,
    onCellClick: create.onCellClick,
  }
}

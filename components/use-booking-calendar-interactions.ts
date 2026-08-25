"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { BookingDragMode } from "@/lib/booking-drag"
import {
  iso,
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
  reservations: BookingCalendarReservation[]
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
  reservations,
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
  const reservationById = useMemo(() => new Map(reservations.map((reservation) => [reservation.id, reservation])), [reservations])
  const bedById = useMemo(() => new Map(bedOrder.map((bed) => [bed.id, bed])), [bedOrder])
  const dateIndexByIso = useMemo(() => new Map(dates.map((date, index) => [iso(date), index])), [dates])

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

  useEffect(() => {
    const onNativePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      const root = event.target.closest<HTMLElement>("[data-testid='booking-calendar-root']")
      if (!root) return
      root.dataset.bookingPointerDebug = `down:${event.pointerId}:entered`

      const reservationElement = event.target.closest<HTMLButtonElement>("[data-booking-reservation='true']")
      if (reservationElement) {
        const reservationId = reservationElement.dataset.bookingReservationId
        const bedId = reservationElement.dataset.bookingBedId
        const reservation = reservationId ? reservationById.get(reservationId) : undefined
        const bed = bedId ? bedById.get(bedId) : undefined
        root.dataset.bookingPointerDebug = `down:${event.pointerId}:reservation:${reservationId ?? "none"}:bed:${bedId ?? "none"}:lookup:${Boolean(reservation)}:${Boolean(bed)}`
        if (reservation && bed) {
          drag.startReservationPointer(event, reservation, bed, reservationElement)
          root.dataset.bookingPointerDebug += `:session:${drag.dragRef.current?.pointerId ?? "none"}`
        }
        return
      }

      const cellElement = event.target.closest<HTMLButtonElement>("button[data-booking-date]")
      if (!cellElement) {
        root.dataset.bookingPointerDebug = `down:${event.pointerId}:no-target`
        return
      }
      const row = cellElement.closest<HTMLElement>("[data-booking-timeline-row='true']")
      const bedId = row?.dataset.bookingBedId
      const date = cellElement.dataset.bookingDate
      const bed = bedId ? bedById.get(bedId) : undefined
      const index = date ? dateIndexByIso.get(date) : undefined
      root.dataset.bookingPointerDebug = `down:${event.pointerId}:cell:${bedId ?? "none"}:${date ?? "none"}:lookup:${Boolean(bed)}:${index ?? "none"}`
      if (bed && index !== undefined) {
        create.startCellPointer(event, bed, index, cellElement)
        root.dataset.bookingPointerDebug += `:session:${create.createRef.current?.pointerId ?? "none"}`
      }
    }

    const onNativePointerMove = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      const root = event.target.closest<HTMLElement>("[data-testid='booking-calendar-root']")
      if (!root) return
      root.dataset.bookingPointerMoveDebug = `move:${event.pointerId}:drag:${drag.dragRef.current?.pointerId ?? "none"}:${drag.dragRef.current?.active ?? false}:create:${create.createRef.current?.pointerId ?? "none"}:${create.createRef.current?.active ?? false}`
    }

    window.addEventListener("pointerdown", onNativePointerDown, { capture: true })
    window.addEventListener("pointermove", onNativePointerMove, { capture: true })
    return () => {
      window.removeEventListener("pointerdown", onNativePointerDown, { capture: true })
      window.removeEventListener("pointermove", onNativePointerMove, { capture: true })
    }
  }, [bedById, create.createRef, create.startCellPointer, dateIndexByIso, drag.dragRef, drag.startReservationPointer, reservationById])

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

"use client"

import type React from "react"
import { useCallback, useRef } from "react"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { toast } from "sonner"
import {
  bookingDragDates,
  bookingDragDayDelta,
  bookingEdgeScrollVelocity,
  type BookingDragMode,
} from "@/lib/booking-drag"
import { bookingSourcePolicy, bookingSourcePolicyLabel } from "@/lib/booking-source-policy"
import {
  defaultValidation,
  futureEditable,
  targetLabel,
  type BookingCalendarBed,
  type BookingCalendarReservation,
  type DragSession,
  type Feedback,
  type Validation,
} from "@/components/booking-calendar-model"

type DragVisual = { reservationId: string; transform: string; width: number }

type UseBookingCalendarDragInput = {
  scrollRef: React.RefObject<HTMLDivElement | null>
  rowRefs: React.RefObject<Map<string, HTMLDivElement>>
  dayWidth: number
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
  updateCandidateStates: (
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    mode: BookingDragMode,
  ) => void
  clearInteractionState: () => void
  setDragVisual: React.Dispatch<React.SetStateAction<DragVisual | null>>
  setDropTargetBedId: React.Dispatch<React.SetStateAction<string | null>>
  setFeedback: React.Dispatch<React.SetStateAction<Feedback | null>>
  suppressClickUntil: React.MutableRefObject<number>
  applyProposal: (
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    targetBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    validation: Validation,
  ) => Promise<void>
  cancelOther: () => void
}

export function useBookingCalendarDrag({
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
  cancelOther,
}: UseBookingCalendarDragInput) {
  const dragRef = useRef<DragSession | null>(null)
  const autoScrollFrame = useRef<number | null>(null)

  const releasePointer = useCallback((element: HTMLElement, pointerId: number) => {
    try { if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId) } catch { /* browser released it */ }
  }, [])
  const capturePointer = useCallback((element: HTMLElement, pointerId: number) => {
    try { element.setPointerCapture(pointerId) } catch { /* root handlers are fallback */ }
  }, [])
  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrame.current !== null) window.cancelAnimationFrame(autoScrollFrame.current)
    autoScrollFrame.current = null
  }, [])
  const cancelDrag = useCallback(() => {
    const session = dragRef.current
    if (session?.longPressTimer !== null) window.clearTimeout(session.longPressTimer)
    if (session) releasePointer(session.element, session.pointerId)
    dragRef.current = null
    stopAutoScroll()
    clearInteractionState()
  }, [clearInteractionState, releasePointer, stopAutoScroll])

  const activateDrag = useCallback((session: DragSession) => {
    session.active = true
    session.touchReady = true
    capturePointer(session.element, session.pointerId)
    updateCandidateStates(session.reservation, session.sourceBed, session.targetCheckIn, session.targetCheckOut, session.mode)
  }, [capturePointer, updateCandidateStates])

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    const session = dragRef.current
    if (!session) return
    session.lastX = clientX
    session.lastY = clientY
    const distance = Math.hypot(clientX - session.startX, clientY - session.startY)
    if (session.pointerType === "touch" && !session.touchReady) {
      if (distance > 10) cancelDrag()
      return
    }
    if (!session.active && distance < 5) return
    if (!session.active) activateDrag(session)

    const scrollDeltaX = scrollRef.current ? scrollRef.current.scrollLeft - session.initialScrollLeft : 0
    const dayDelta = bookingDragDayDelta(clientX - session.startX, scrollDeltaX, dayWidth)
    const targetBed = session.mode === "move" ? bedAtPoint(clientY) ?? session.sourceBed : session.sourceBed
    const nextDates = bookingDragDates(session.mode, session.reservation.check_in, session.reservation.check_out, dayDelta)
    const validation = validateProposal(session.reservation, session.sourceBed, targetBed, nextDates.checkIn, nextDates.checkOut, session.mode)
    const sourceRow = rowRefs.current?.get(session.sourceBed.id)
    const targetRow = rowRefs.current?.get(targetBed.id)
    const translateY = session.mode === "move" && sourceRow && targetRow
      ? targetRow.getBoundingClientRect().top - sourceRow.getBoundingClientRect().top
      : 0
    const translateX = dayDelta * dayWidth
    const width = session.mode === "resize-start"
      ? Math.max(20, session.originalWidth - translateX)
      : session.mode === "resize-end"
        ? Math.max(20, session.originalWidth + translateX)
        : session.originalWidth

    session.targetBed = targetBed
    session.targetCheckIn = nextDates.checkIn
    session.targetCheckOut = nextDates.checkOut
    session.validation = validation
    setDragVisual({
      reservationId: session.reservation.id,
      transform: session.mode === "move" ? `translate(${translateX}px, ${translateY}px)` : session.mode === "resize-start" ? `translateX(${translateX}px)` : "none",
      width,
    })
    updateCandidateStates(session.reservation, session.sourceBed, nextDates.checkIn, nextDates.checkOut, session.mode)
    setDropTargetBedId(targetBed.id)
    setFeedback({
      guestName: session.reservation.guest_name,
      targetLabel: targetLabel(targetBed),
      checkIn: nextDates.checkIn,
      checkOut: nextDates.checkOut,
      nights: Math.max(0, differenceInCalendarDays(parseISO(nextDates.checkOut), parseISO(nextDates.checkIn))),
      mode: validation.intent === "swap" ? "swap" : session.mode,
      valid: validation.valid,
      state: validation.state,
      message: validation.message,
    })
  }, [activateDrag, bedAtPoint, cancelDrag, dayWidth, rowRefs, scrollRef, setDragVisual, setDropTargetBedId, setFeedback, updateCandidateStates, validateProposal])

  const runAutoScroll = useCallback(() => {
    autoScrollFrame.current = null
    const session = dragRef.current
    const scroll = scrollRef.current
    if (!session?.active || !scroll) return
    const rect = scroll.getBoundingClientRect()
    const velocityX = bookingEdgeScrollVelocity(session.lastX, rect.left, rect.right, 84, 22)
    const velocityY = bookingEdgeScrollVelocity(session.lastY, rect.top, rect.bottom, 72, 16)
    const previousLeft = scroll.scrollLeft
    const previousTop = scroll.scrollTop
    if (velocityX !== 0) scroll.scrollBy(velocityX, 0)
    if (velocityY !== 0) {
      if (scroll.scrollHeight > scroll.clientHeight) scroll.scrollBy(0, velocityY)
      else window.scrollBy(0, velocityY)
    }
    if (scroll.scrollLeft !== previousLeft || scroll.scrollTop !== previousTop || velocityY !== 0) updateDrag(session.lastX, session.lastY)
    if (velocityX !== 0 || velocityY !== 0) autoScrollFrame.current = window.requestAnimationFrame(runAutoScroll)
  }, [scrollRef, updateDrag])

  const onReservationPointerDown = useCallback((
    event: React.PointerEvent<HTMLButtonElement>,
    reservation: BookingCalendarReservation,
    bed: BookingCalendarBed,
  ) => {
    if (event.button !== 0) return
    if (pendingIds.has(reservation.id)) return void toast.warning("Este cambio ya está pendiente de aprobación de Santiago")
    if (bookingSourcePolicy(reservation.source) === "external-read-only") return void toast.warning(bookingSourcePolicyLabel(reservation.source))
    if (!futureEditable(reservation)) return
    cancelOther()
    cancelDrag()
    const edge = (event.target as HTMLElement).closest<HTMLElement>("[data-booking-resize-edge]")?.dataset.bookingResizeEdge
    const mode: BookingDragMode = edge === "start" ? "resize-start" : edge === "end" ? "resize-end" : "move"
    const session: DragSession = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      element: event.currentTarget,
      reservation,
      sourceBed: bed,
      targetBed: bed,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      initialScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      initialScrollTop: scrollRef.current?.scrollTop ?? 0,
      originalWidth: event.currentTarget.getBoundingClientRect().width,
      active: false,
      touchReady: event.pointerType !== "touch",
      longPressTimer: null,
      targetCheckIn: reservation.check_in,
      targetCheckOut: reservation.check_out,
      validation: defaultValidation(mode),
    }
    dragRef.current = session
    if (event.pointerType === "touch") {
      session.longPressTimer = window.setTimeout(() => {
        if (dragRef.current !== session) return
        activateDrag(session)
        updateDrag(session.lastX, session.lastY)
        navigator.vibrate?.(18)
      }, 340)
    } else capturePointer(event.currentTarget, event.pointerId)
  }, [activateDrag, cancelDrag, cancelOther, capturePointer, pendingIds, scrollRef, updateDrag])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return false
    updateDrag(event.clientX, event.clientY)
    if (dragRef.current?.active) {
      event.preventDefault()
      if (autoScrollFrame.current === null) autoScrollFrame.current = window.requestAnimationFrame(runAutoScroll)
    }
    return true
  }, [runAutoScroll, updateDrag])

  const finishDrag = useCallback(async (event: React.PointerEvent) => {
    const session = dragRef.current
    if (!session || event.pointerId !== session.pointerId) return false
    if (session.longPressTimer !== null) window.clearTimeout(session.longPressTimer)
    dragRef.current = null
    stopAutoScroll()
    releasePointer(session.element, session.pointerId)
    if (!session.active) return false
    event.preventDefault()
    suppressClickUntil.current = Date.now() + 450
    const changed = session.targetBed.id !== session.sourceBed.id
      || session.targetCheckIn !== session.reservation.check_in
      || session.targetCheckOut !== session.reservation.check_out
    clearInteractionState()
    if (!changed) return true
    if (!session.validation.valid) {
      toast.error(session.validation.message)
      return true
    }
    await applyProposal(session.reservation, session.sourceBed, session.targetBed, session.targetCheckIn, session.targetCheckOut, session.validation)
    return true
  }, [applyProposal, clearInteractionState, releasePointer, stopAutoScroll, suppressClickUntil])

  return { dragRef, cancelDrag, onReservationPointerDown, onPointerMove, finishDrag }
}

"use client"

import type React from "react"
import { useCallback, useEffect, useRef } from "react"
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import { toast } from "sonner"
import { bookingDragDayDelta, bookingEdgeScrollVelocity, bookingStaysOverlap } from "@/lib/booking-drag"
import {
  activeInventoryConflict,
  iso,
  targetLabel,
  type BookingCalendarBed,
  type BookingCalendarBlock,
  type CalendarContext,
  type CreateSession,
  type Feedback,
} from "@/components/booking-calendar-model"

type CreateState = { bedId: string; first: number; last: number; state: "valid" | "invalid" }

type UseBookingCalendarCreateInput = {
  scrollRef: React.RefObject<HTMLDivElement | null>
  dates: Date[]
  dayWidth: number
  context: CalendarContext
  blocksForValidation: BookingCalendarBlock[]
  unavailableBedIds: Set<string>
  clearInteractionState: () => void
  setCreateState: React.Dispatch<React.SetStateAction<CreateState | null>>
  setFeedback: React.Dispatch<React.SetStateAction<Feedback | null>>
  suppressClickUntil: React.MutableRefObject<number>
  onOpenNewReservation: (bed: BookingCalendarBed, checkIn: Date, checkOut: Date) => void
  cancelOther: () => void
}

export function useBookingCalendarCreate({
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
  cancelOther,
}: UseBookingCalendarCreateInput) {
  const createRef = useRef<CreateSession | null>(null)
  const updateCreateRef = useRef<(clientX: number) => void>(() => undefined)
  const autoScrollFrame = useRef<number | null>(null)

  const releasePointer = useCallback((element: HTMLElement, pointerId: number) => {
    try { if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId) } catch { /* released */ }
  }, [])
  const capturePointer = useCallback((element: HTMLElement, pointerId: number) => {
    try { element.setPointerCapture(pointerId) } catch { /* root handlers are fallback */ }
  }, [])
  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrame.current !== null) window.cancelAnimationFrame(autoScrollFrame.current)
    autoScrollFrame.current = null
  }, [])
  const cancelCreate = useCallback(() => {
    const session = createRef.current
    if (session?.longPressTimer !== null) window.clearTimeout(session.longPressTimer)
    if (session) releasePointer(session.element, session.pointerId)
    createRef.current = null
    stopAutoScroll()
    clearInteractionState()
  }, [clearInteractionState, releasePointer, stopAutoScroll])

  const rangeForCreate = useCallback((session: CreateSession) => {
    const first = Math.min(session.startIndex, session.currentIndex)
    const last = Math.max(session.startIndex, session.currentIndex)
    const start = dates[first]
    const end = dates[last]
    if (!start || !end) return null
    return { first, last, checkIn: iso(start), checkOut: iso(addDays(end, 1)) }
  }, [dates])

  const validateCreate = useCallback((bed: BookingCalendarBed, checkIn: string, checkOut: string) => {
    if (!bed.is_available || unavailableBedIds.has(bed.id)) return { valid: false, message: "La cama está deshabilitada" }
    if (["out_of_service", "out_of_inventory"].includes(bed.room.operational_status)) {
      return { valid: false, message: "La habitación no admite nuevas reservas" }
    }
    if (context.activeReservations.some((reservation) => activeInventoryConflict(reservation, bed, checkIn, checkOut))) {
      return { valid: false, message: "El rango cruza una reserva activa" }
    }
    if (blocksForValidation.some(
      (block) => block.room_id === bed.room_id
        && bookingStaysOverlap(checkIn, checkOut, block.start_date, block.end_date),
    )) return { valid: false, message: "El rango cruza un bloqueo operativo" }
    return { valid: true, message: "Rango disponible para crear una reserva" }
  }, [blocksForValidation, context.activeReservations, unavailableBedIds])

  const updateCreate = useCallback((clientX: number) => {
    const session = createRef.current
    if (!session) return
    session.lastX = clientX
    const distance = Math.abs(clientX - session.startX)
    if (session.pointerType === "touch" && !session.touchReady) {
      if (distance > 10) cancelCreate()
      return
    }
    if (!session.active && distance < 6) return
    session.active = true
    const scrollDelta = scrollRef.current ? scrollRef.current.scrollLeft - session.initialScrollLeft : 0
    const delta = bookingDragDayDelta(clientX - session.startX, scrollDelta, dayWidth)
    session.currentIndex = Math.max(0, Math.min(dates.length - 1, session.startIndex + delta))
    const range = rangeForCreate(session)
    if (!range) return
    const validation = validateCreate(session.bed, range.checkIn, range.checkOut)
    session.valid = validation.valid
    session.message = validation.message
    setCreateState({ bedId: session.bed.id, first: range.first, last: range.last, state: validation.valid ? "valid" : "invalid" })
    setFeedback({
      guestName: "Nueva reserva",
      targetLabel: targetLabel(session.bed),
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      nights: differenceInCalendarDays(parseISO(range.checkOut), parseISO(range.checkIn)),
      mode: "create",
      valid: validation.valid,
      state: validation.valid ? "valid" : "invalid",
      message: validation.message,
    })
  }, [cancelCreate, dates.length, dayWidth, rangeForCreate, scrollRef, setCreateState, setFeedback, validateCreate])

  useEffect(() => { updateCreateRef.current = updateCreate }, [updateCreate])

  const runAutoScroll = useCallback(() => {
    autoScrollFrame.current = null
    const session = createRef.current
    const scroll = scrollRef.current
    if (!session?.active || !scroll) return
    const rect = scroll.getBoundingClientRect()
    const velocity = bookingEdgeScrollVelocity(session.lastX, rect.left, rect.right, 84, 22)
    const previousLeft = scroll.scrollLeft
    if (velocity !== 0) scroll.scrollBy(velocity, 0)
    if (scroll.scrollLeft !== previousLeft) updateCreateRef.current(session.lastX)
    if (velocity !== 0) autoScrollFrame.current = window.requestAnimationFrame(runAutoScroll)
  }, [scrollRef])

  const onCellPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>, bed: BookingCalendarBed, index: number) => {
    if (event.button !== 0) return
    cancelOther()
    cancelCreate()
    const session: CreateSession = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      element: event.currentTarget,
      bed,
      startIndex: index,
      currentIndex: index,
      startX: event.clientX,
      lastX: event.clientX,
      initialScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      active: false,
      touchReady: event.pointerType !== "touch",
      longPressTimer: null,
      valid: true,
      message: "",
    }
    createRef.current = session
    if (event.pointerType === "touch") {
      session.longPressTimer = window.setTimeout(() => {
        if (createRef.current !== session) return
        session.touchReady = true
        capturePointer(session.element, session.pointerId)
        updateCreate(session.lastX)
        navigator.vibrate?.(18)
      }, 340)
    } else capturePointer(event.currentTarget, event.pointerId)
  }, [cancelCreate, cancelOther, capturePointer, scrollRef, updateCreate])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!createRef.current || createRef.current.pointerId !== event.pointerId) return false
    updateCreate(event.clientX)
    if (createRef.current?.active) {
      event.preventDefault()
      if (autoScrollFrame.current === null) autoScrollFrame.current = window.requestAnimationFrame(runAutoScroll)
    }
    return true
  }, [runAutoScroll, updateCreate])

  const finishCreate = useCallback((event: React.PointerEvent) => {
    const session = createRef.current
    if (!session || event.pointerId !== session.pointerId) return false
    if (session.longPressTimer !== null) window.clearTimeout(session.longPressTimer)
    createRef.current = null
    stopAutoScroll()
    releasePointer(session.element, session.pointerId)
    if (!session.active) return false
    event.preventDefault()
    suppressClickUntil.current = Date.now() + 450
    const range = rangeForCreate(session)
    clearInteractionState()
    if (!range) return true
    if (!session.valid) {
      toast.error(session.message)
      return true
    }
    onOpenNewReservation(session.bed, parseISO(range.checkIn), parseISO(range.checkOut))
    return true
  }, [clearInteractionState, onOpenNewReservation, rangeForCreate, releasePointer, stopAutoScroll, suppressClickUntil])

  const onCellClick = useCallback((bed: BookingCalendarBed, date: Date) => {
    if (Date.now() < suppressClickUntil.current) return
    const checkIn = iso(date)
    const checkOut = iso(addDays(date, 1))
    const validation = validateCreate(bed, checkIn, checkOut)
    if (!validation.valid) return void toast.error(validation.message)
    onOpenNewReservation(bed, date, addDays(date, 1))
  }, [onOpenNewReservation, suppressClickUntil, validateCreate])

  return { createRef, cancelCreate, onCellPointerDown, onPointerMove, finishCreate, onCellClick }
}

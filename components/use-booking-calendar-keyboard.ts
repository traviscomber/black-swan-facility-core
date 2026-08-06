"use client"

import type React from "react"
import { useCallback, useRef } from "react"
import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import { toast } from "sonner"
import { bookingSourcePolicy, bookingSourcePolicyLabel } from "@/lib/booking-source-policy"
import { type BookingDragMode } from "@/lib/booking-drag"
import {
  futureEditable,
  iso,
  targetLabel,
  type BookingCalendarBed,
  type BookingCalendarReservation,
  type Feedback,
  type KeyboardSession,
  type Validation,
} from "@/components/booking-calendar-model"

type UseBookingCalendarKeyboardInput = {
  bedOrder: BookingCalendarBed[]
  pendingIds: Set<string>
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
  setDropTargetBedId: React.Dispatch<React.SetStateAction<string | null>>
  setFeedback: React.Dispatch<React.SetStateAction<Feedback | null>>
  setKeyboardReservationId: React.Dispatch<React.SetStateAction<string | null>>
  applyProposal: (
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    targetBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    validation: Validation,
  ) => Promise<void>
  onOpenReservation: (reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
}

export function useBookingCalendarKeyboard({
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
}: UseBookingCalendarKeyboardInput) {
  const keyboardRef = useRef<KeyboardSession | null>(null)

  const refreshKeyboardFeedback = useCallback((session: KeyboardSession) => {
    updateCandidateStates(session.reservation, session.sourceBed, session.checkIn, session.checkOut, session.mode)
    setDropTargetBedId(session.targetBed.id)
    setFeedback({
      guestName: session.reservation.guest_name,
      targetLabel: targetLabel(session.targetBed),
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      nights: Math.max(0, differenceInCalendarDays(parseISO(session.checkOut), parseISO(session.checkIn))),
      mode: session.validation.intent === "swap" ? "swap" : session.mode,
      valid: session.validation.valid,
      state: session.validation.state,
      message: `${session.validation.message} Enter confirma; Escape cancela.`,
    })
  }, [setDropTargetBedId, setFeedback, updateCandidateStates])

  const startKeyboardSession = useCallback((
    reservation: BookingCalendarReservation,
    bed: BookingCalendarBed,
    mode: BookingDragMode = "move",
  ) => {
    const session: KeyboardSession = {
      reservation,
      sourceBed: bed,
      targetBed: bed,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      mode,
      validation: validateProposal(reservation, bed, bed, reservation.check_in, reservation.check_out, mode),
    }
    keyboardRef.current = session
    setKeyboardReservationId(reservation.id)
    refreshKeyboardFeedback(session)
    return session
  }, [refreshKeyboardFeedback, setKeyboardReservationId, validateProposal])

  const cancelKeyboard = useCallback(() => {
    keyboardRef.current = null
    setKeyboardReservationId(null)
    clearInteractionState()
  }, [clearInteractionState, setKeyboardReservationId])

  const onReservationKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    reservation: BookingCalendarReservation,
    bed: BookingCalendarBed,
  ) => {
    const pending = pendingIds.has(reservation.id)
    const policy = bookingSourcePolicy(reservation.source)
    let session = keyboardRef.current

    if (!session || session.reservation.id !== reservation.id) {
      if (event.key === "Enter") return void onOpenReservation(reservation, bed)
      if (event.key !== " " && !event.key.startsWith("Arrow")) return
      if (pending) return void toast.warning("Este cambio ya está pendiente de aprobación")
      if (policy === "external-read-only") return void toast.warning(bookingSourcePolicyLabel(reservation.source))
      if (!futureEditable(reservation)) return
      event.preventDefault()
      session = startKeyboardSession(reservation, bed)
      if (event.key === " ") return
    }

    if (!session || session.reservation.id !== reservation.id) return
    if (event.key === "Escape") {
      event.preventDefault()
      cancelKeyboard()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const proposal = { ...session }
      cancelKeyboard()
      if (!proposal.validation.valid) return void toast.error(proposal.validation.message)
      void applyProposal(proposal.reservation, proposal.sourceBed, proposal.targetBed, proposal.checkIn, proposal.checkOut, proposal.validation)
      return
    }
    if (event.key === " ") {
      event.preventDefault()
      return
    }

    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault()
      const currentIndex = bedOrder.findIndex((item) => item.id === session!.targetBed.id)
      const nextIndex = Math.max(0, Math.min(bedOrder.length - 1, currentIndex + direction))
      session.targetBed = bedOrder[nextIndex] ?? session.targetBed
      session.mode = "move"
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      if (event.altKey) {
        session.mode = "resize-start"
        session.checkIn = iso(addDays(parseISO(session.checkIn), direction))
      } else if (event.shiftKey) {
        session.mode = "resize-end"
        session.checkOut = iso(addDays(parseISO(session.checkOut), direction))
      } else {
        session.mode = "move"
        session.checkIn = iso(addDays(parseISO(session.checkIn), direction))
        session.checkOut = iso(addDays(parseISO(session.checkOut), direction))
      }
    } else return

    session.validation = validateProposal(
      session.reservation,
      session.sourceBed,
      session.targetBed,
      session.checkIn,
      session.checkOut,
      session.mode,
    )
    keyboardRef.current = { ...session }
    refreshKeyboardFeedback(session)
  }, [
    applyProposal,
    bedOrder,
    cancelKeyboard,
    onOpenReservation,
    pendingIds,
    refreshKeyboardFeedback,
    startKeyboardSession,
    validateProposal,
  ])

  return { keyboardRef, cancelKeyboard, onReservationKeyDown }
}

"use client"

import type React from "react"
import { useCallback } from "react"
import { toast } from "sonner"
import {
  stableContextReservation,
  targetLabel,
  type BookingCalendarBed,
  type BookingCalendarReservation,
  type BookingCalendarTransport,
  type CalendarContext,
  type MutationResult,
  type Validation,
} from "@/components/booking-calendar-model"

type UseBookingCalendarMutationsInput = {
  activeTransport: BookingCalendarTransport
  loadContext: () => Promise<void>
  setContext: React.Dispatch<React.SetStateAction<CalendarContext>>
  onRefresh: () => Promise<void> | void
}

export function useBookingCalendarMutations({
  activeTransport,
  loadContext,
  setContext,
  onRefresh,
}: UseBookingCalendarMutationsInput) {
  const showUndo = useCallback((result: MutationResult) => {
    if (!result.change_id) return
    toast.success(result.message ?? "Reserva actualizada", {
      duration: 12_000,
      action: {
        label: "Deshacer",
        onClick: () => {
          void (async () => {
            try {
              const undoResult = await activeTransport.undoChange(result.change_id!)
              toast.success(undoResult.message ?? "Cambio deshecho")
              await onRefresh()
              await loadContext()
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "No fue posible deshacer el cambio")
            }
          })()
        },
      },
    })
  }, [activeTransport, loadContext, onRefresh])

  const handleMutationResult = useCallback(async (result: MutationResult, reservationId: string) => {
    if (result.result === "queued") {
      setContext((current) => ({
        ...current,
        pendingReservationIds: Array.from(new Set([...current.pendingReservationIds, reservationId])),
      }))
      toast.warning(result.message ?? "Cambio enviado a Santiago para aprobación")
    } else if (result.result === "applied") {
      showUndo(result)
    } else {
      toast.info(result.message ?? "La reserva no cambió")
    }
    await onRefresh()
    await loadContext()
  }, [loadContext, onRefresh, setContext, showUndo])

  const applyProposal = useCallback(async (
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    targetBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    validation: Validation,
  ) => {
    try {
      if (validation.intent === "swap" && validation.swapReservation) {
        const confirmed = window.confirm(
          `Intercambiar ${reservation.guest_name} con ${validation.swapReservation.guest_name}? Ambas reservas conservarán sus fechas.`,
        )
        if (!confirmed) return
        const result = await activeTransport.applySwap({
          reservationAId: reservation.id,
          reservationBId: validation.swapReservation.id,
          expectedA: stableContextReservation(reservation),
          expectedB: validation.swapReservation,
          reason: `Intercambio controlado desde el calendario: ${targetLabel(sourceBed)} ↔ ${targetLabel(targetBed)}.`,
        })
        await handleMutationResult(result, reservation.id)
        return
      }

      const result = await activeTransport.applyChange({
        reservationId: reservation.id,
        targetBedId: targetBed.id,
        checkIn,
        checkOut,
        expectedBedId: sourceBed.id,
        expectedCheckIn: reservation.check_in,
        expectedCheckOut: reservation.check_out,
        reason: `Ajuste desde el calendario: ${reservation.check_in}–${reservation.check_out} → ${checkIn}–${checkOut}; ${targetLabel(sourceBed)} → ${targetLabel(targetBed)}.`,
      })
      await handleMutationResult(result, reservation.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible actualizar la reserva")
    }
  }, [activeTransport, handleMutationResult])

  return { applyProposal }
}

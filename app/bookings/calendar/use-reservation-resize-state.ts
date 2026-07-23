"use client"

import { useCallback, useState } from "react"

export type ReservationResizeEdge = "left" | "right"

export interface ReservationResizeState {
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

interface BeginReservationResizeInput {
  reservationId: string
  bedId: string
  edge: ReservationResizeEdge
  pointerId: number
  pointerStartX: number
  startsOn: string
  endsOn: string
}

export function useReservationResizeState() {
  const [resizeState, setResizeState] = useState<ReservationResizeState | null>(null)
  const [resizingReservationId, setResizingReservationId] = useState<string | null>(null)
  const [confirmingReservationId, setConfirmingReservationId] = useState<string | null>(null)

  const beginResize = useCallback((input: BeginReservationResizeInput) => {
    setResizeState({
      reservationId: input.reservationId,
      bedId: input.bedId,
      edge: input.edge,
      pointerId: input.pointerId,
      pointerStartX: input.pointerStartX,
      originalStart: input.startsOn,
      originalEnd: input.endsOn,
      previewStart: input.startsOn,
      previewEnd: input.endsOn,
    })
    setResizingReservationId(input.reservationId)
    setConfirmingReservationId(null)
  }, [])

  const updatePreview = useCallback((previewStart: string, previewEnd: string) => {
    setResizeState((current) => current
      ? { ...current, previewStart, previewEnd }
      : current)
  }, [])

  const markConfirming = useCallback((reservationId: string) => {
    setConfirmingReservationId(reservationId)
    setResizingReservationId(null)
  }, [])

  const clearResize = useCallback(() => {
    setResizeState(null)
    setResizingReservationId(null)
    setConfirmingReservationId(null)
  }, [])

  return {
    resizeState,
    resizingReservationId,
    confirmingReservationId,
    isResizing: resizeState !== null,
    beginResize,
    updatePreview,
    markConfirming,
    clearResize,
  }
}

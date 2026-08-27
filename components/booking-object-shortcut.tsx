"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { BOOKING_COMMAND_SELECTION_EVENT } from "@/components/booking-calendar-timeline"

type BookingSelectionDetail = { reservationId?: string | null }

export function BookingObjectShortcut() {
  const [reservationId, setReservationId] = useState<string | null>(null)

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<BookingSelectionDetail>).detail
      setReservationId(detail?.reservationId ?? null)
    }
    window.addEventListener(BOOKING_COMMAND_SELECTION_EVENT, listener)
    return () => window.removeEventListener(BOOKING_COMMAND_SELECTION_EVENT, listener)
  }, [])

  if (!reservationId) return null

  return (
    <Link
      href={`/bookings/reservations/${reservationId}`}
      className="fixed bottom-4 right-4 z-[70] inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/35 bg-background/95 px-4 py-2.5 text-sm font-semibold text-primary shadow-xl backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
      aria-label="Abrir objeto completo de la reserva seleccionada"
    >
      <ExternalLink className="h-4 w-4" />
      Abrir objeto completo
    </Link>
  )
}

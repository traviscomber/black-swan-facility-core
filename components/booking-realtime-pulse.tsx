"use client"

import { useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

export const BOOKING_REALTIME_EVENT = "booking:realtime-pulse"

export type BookingRealtimeDetail = {
  table: string
  eventType: "INSERT" | "UPDATE" | "DELETE"
  occurredAt: string
}

const TABLES = [
  "reservations",
  "rooms",
  "housekeeping",
  "hospitality_requests",
  "incidents",
  "reservation_extras",
  "reservation_payments",
  "reservation_adjustments",
  "messages",
  "booking_shift_handovers",
] as const

export function BookingRealtimePulse() {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const channel = supabase.channel("booking-os-pulse")

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          window.dispatchEvent(new CustomEvent<BookingRealtimeDetail>(BOOKING_REALTIME_EVENT, {
            detail: {
              table,
              eventType: payload.eventType as BookingRealtimeDetail["eventType"],
              occurredAt: new Date().toISOString(),
            },
          }))
        },
      )
    }

    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase])

  return null
}

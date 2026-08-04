"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingArrivalQueue } from "@/components/booking-arrival-queue"
import { BookingPrearrivalControl } from "@/components/booking-prearrival-control"

export default function BookingsPage() {
  return (
    <>
      <BookingOperationsTimelinePage />
      <BookingPrearrivalControl />
      <BookingArrivalQueue />
    </>
  )
}

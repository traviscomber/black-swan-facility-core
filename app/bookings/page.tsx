"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingArrivalQueue } from "@/components/booking-arrival-queue"

export default function BookingsPage() {
  return (
    <>
      <BookingOperationsTimelinePage />
      <BookingArrivalQueue />
    </>
  )
}

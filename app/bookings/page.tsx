"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { BookingTimelineDomIdentity } from "@/components/booking-timeline-dom-identity"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"

export default function BookingsPage() {
  return (
    <>
      <BookingRealtimePulse />
      <BookingTimelineDomIdentity />
      <BookingTimelineAlertNavigator />
      <ReservationLogisticsEditor />
      <BookingOperationsTimelinePage />
    </>
  )
}

"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingOperationsBar } from "@/components/booking-operations-bar"
import { BookingOperationsWorkspace } from "@/components/booking-operations-workspace"
import { BookingSystemHealth } from "@/components/booking-system-health"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { BookingTimelineDomIdentity } from "@/components/booking-timeline-dom-identity"

export default function BookingsPage() {
  return (
    <>
      <BookingTimelineDomIdentity />
      <BookingTimelineAlertNavigator />
      <BookingOperationsBar />
      <BookingSystemHealth />
      <BookingOperationsTimelinePage />
      <BookingOperationsWorkspace />
    </>
  )
}

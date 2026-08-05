"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingOperationsBar } from "@/components/booking-operations-bar"
import { BookingOperationsWorkspace } from "@/components/booking-operations-workspace"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingSystemHealth } from "@/components/booking-system-health"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { BookingTimelineDomIdentity } from "@/components/booking-timeline-dom-identity"
import { OperationalCalendar } from "@/components/operational-calendar"

export default function BookingsPage() {
  return (
    <>
      <BookingRealtimePulse />
      <BookingTimelineDomIdentity />
      <BookingTimelineAlertNavigator />
      <BookingOperationsBar />
      <BookingSystemHealth />
      <div className="border-b border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <OperationalCalendar days={30} title="Calendario completo de próximas acciones" />
      </div>
      <BookingOperationsTimelinePage />
      <BookingOperationsWorkspace />
    </>
  )
}

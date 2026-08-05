"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingOperationsBar } from "@/components/booking-operations-bar"
import { BookingOperationsWorkspace } from "@/components/booking-operations-workspace"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingSystemHealth } from "@/components/booking-system-health"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { BookingTimelineDomIdentity } from "@/components/booking-timeline-dom-identity"
import { LogisticsGroupControl } from "@/components/logistics-group-control"
import { OperationalCalendar } from "@/components/operational-calendar"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"

export default function BookingsPage() {
  return (
    <>
      <BookingRealtimePulse />
      <BookingTimelineDomIdentity />
      <BookingTimelineAlertNavigator />
      <BookingOperationsBar />
      <BookingSystemHealth />
      <ReservationLogisticsEditor />
      <div className="border-b border-border/30 bg-background px-4 py-6 sm:px-6 lg:px-8">
        <LogisticsGroupControl days={30} />
      </div>
      <div className="border-b border-border/30 bg-background px-4 py-6 sm:px-6 lg:px-8">
        <OperationalCalendar days={30} title="Calendario completo de próximas acciones" />
      </div>
      <BookingOperationsTimelinePage />
      <BookingOperationsWorkspace />
    </>
  )
}

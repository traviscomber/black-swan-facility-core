"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingArrivalQueue } from "@/components/booking-arrival-queue"
import { BookingFolioControl } from "@/components/booking-folio-control"
import { BookingHousekeepingControl } from "@/components/booking-housekeeping-control"
import { BookingInvoiceCloseControl } from "@/components/booking-invoice-close-control"
import { BookingOperationsBar } from "@/components/booking-operations-bar"
import { BookingPrearrivalControl } from "@/components/booking-prearrival-control"
import { BookingRoomStatusControl } from "@/components/booking-room-status-control"
import { BookingServicesControl } from "@/components/booking-services-control"
import { BookingStayTimeline } from "@/components/booking-stay-timeline"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { GuidedCheckInPanel } from "@/components/guided-check-in-panel"

export default function BookingsPage() {
  return (
    <>
      <BookingTimelineAlertNavigator />
      <BookingOperationsBar />
      <BookingOperationsTimelinePage />
      <BookingPrearrivalControl />
      <GuidedCheckInPanel />
      <BookingHousekeepingControl />
      <BookingServicesControl />
      <BookingFolioControl />
      <BookingInvoiceCloseControl />
      <BookingStayTimeline />
      <BookingArrivalQueue />
      <BookingRoomStatusControl />
    </>
  )
}

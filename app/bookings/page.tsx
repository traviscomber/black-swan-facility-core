"use client"

import BookingOperationsTimelinePage from "./operations/page"
import { BookingArrivalQueue } from "@/components/booking-arrival-queue"
import { BookingExceptionsControl } from "@/components/booking-exceptions-control"
import { BookingFinancialOperations } from "@/components/booking-financial-operations"
import { BookingFolioControl } from "@/components/booking-folio-control"
import { BookingHospitalityControl } from "@/components/booking-hospitality-control"
import { BookingHousekeepingControl } from "@/components/booking-housekeeping-control"
import { BookingInvoiceCloseControl } from "@/components/booking-invoice-close-control"
import { BookingMaintenanceOperations } from "@/components/booking-maintenance-operations"
import { BookingOperationsBar } from "@/components/booking-operations-bar"
import { BookingPrearrivalControl } from "@/components/booking-prearrival-control"
import { BookingReassignmentControl } from "@/components/booking-reassignment-control"
import { BookingRoomStatusControl } from "@/components/booking-room-status-control"
import { BookingServicesControl } from "@/components/booking-services-control"
import { BookingStayTimeline } from "@/components/booking-stay-timeline"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { BookingTimelineDomIdentity } from "@/components/booking-timeline-dom-identity"
import { GuidedCheckInPanel } from "@/components/guided-check-in-panel"

export default function BookingsPage() {
  return (
    <>
      <BookingTimelineDomIdentity />
      <BookingTimelineAlertNavigator />
      <BookingOperationsBar />
      <BookingOperationsTimelinePage />
      <BookingPrearrivalControl />
      <GuidedCheckInPanel />
      <BookingHousekeepingControl />
      <BookingHospitalityControl />
      <BookingMaintenanceOperations />
      <BookingFinancialOperations />
      <BookingServicesControl />
      <BookingFolioControl />
      <BookingInvoiceCloseControl />
      <BookingStayTimeline />
      <BookingArrivalQueue />
      <BookingRoomStatusControl />
      <BookingReassignmentControl />
      <BookingExceptionsControl />
    </>
  )
}

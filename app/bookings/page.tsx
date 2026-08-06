"use client"

import "./booking-workspace.css"
import BookingOperationsTimelinePage from "./operations/page"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { BookingTimelineDomIdentity } from "@/components/booking-timeline-dom-identity"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"
import { DailyOperationsPanel } from "@/components/daily-operations-panel"
import { HospitalityCommandCenter } from "@/components/hospitality-command-center"
import { OperationalApprovalQueue } from "@/components/operational-approval-queue"

export default function BookingsPage() {
  return (
    <div className="booking-workspace">
      <BookingRealtimePulse />
      <BookingTimelineDomIdentity />
      <BookingTimelineAlertNavigator />
      <ReservationLogisticsEditor />
      <BookingOperationsTimelinePage />
      <OperationalApprovalQueue />
      <HospitalityCommandCenter />
      <DailyOperationsPanel />
    </div>
  )
}

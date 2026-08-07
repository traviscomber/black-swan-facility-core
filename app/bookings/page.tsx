"use client"

import "./booking-workspace.css"
import BookingOperationsTimelinePage from "./operations/page"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"
import { DailyOperationsPanel } from "@/components/daily-operations-panel"
import { HospitalityCommandCenter } from "@/components/hospitality-command-center"
import { OperationalApprovalQueue } from "@/components/operational-approval-queue"
import { BookingsLegacyLocalizationBridge } from "@/components/bookings-legacy-localization-bridge"

export default function BookingsPage() {
  return (
    <div className="booking-workspace">
      <BookingsLegacyLocalizationBridge />
      <BookingRealtimePulse />
      <BookingTimelineAlertNavigator />
      <ReservationLogisticsEditor />
      <BookingOperationsTimelinePage />
      <OperationalApprovalQueue />
      <HospitalityCommandCenter />
      <DailyOperationsPanel />
    </div>
  )
}

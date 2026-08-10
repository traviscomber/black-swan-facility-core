"use client"

import "./booking-workspace.css"
import BookingOperationsTimelinePage from "./operations/page"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"
import { DailyOperationsPanel } from "@/components/daily-operations-panel"
import { GuestStayStatusStrip } from "@/components/guest-stay-status-strip"
import { SantiagoHospitalityQuickTasks } from "@/components/santiago-hospitality-quick-tasks"

export default function BookingsPage() {
  return (
    <>
      <BookingRealtimePulse />
      <BookingTimelineAlertNavigator />
      <ReservationLogisticsEditor />
      <GuestStayStatusStrip />
      <SantiagoHospitalityQuickTasks />
      <DailyOperationsPanel />
      <BookingOperationsTimelinePage />
    </>
  )
}

"use client"

import "./booking-workspace.css"
import BookingOperationsTimelinePage from "./operations/page"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"
import { DailyOperationsPanel } from "@/components/daily-operations-panel"
import { HospitalityCommandCenter } from "@/components/hospitality-command-center"
import { SantiagoTodayCommandCenter } from "@/components/santiago-today-command-center"

export default function BookingsPage() {
  return (
    <>
      <BookingRealtimePulse />
      <BookingTimelineAlertNavigator />
      <ReservationLogisticsEditor />
      <SantiagoTodayCommandCenter />
      <BookingOperationsTimelinePage />
      <HospitalityCommandCenter />
      <DailyOperationsPanel />
    </>
  )
}

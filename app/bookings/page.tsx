"use client"

import "./booking-workspace.css"
import BookingOperationsTimelinePage from "./operations/page"
import { BookingRealtimePulse } from "@/components/booking-realtime-pulse"
import { BookingTimelineAlertNavigator } from "@/components/booking-timeline-alert-navigator"
import { ReservationLogisticsEditor } from "@/components/reservation-logistics-editor"
import { GuestStayStatusStrip } from "@/components/guest-stay-status-strip"
import { HospitalityCommandStrip } from "@/components/hospitality-command-strip"

export default function BookingsPage() {
  return (
    <>
      <BookingRealtimePulse />
      <BookingTimelineAlertNavigator />
      <ReservationLogisticsEditor />
      <GuestStayStatusStrip />
      <HospitalityCommandStrip />
      <BookingOperationsTimelinePage />
    </>
  )
}

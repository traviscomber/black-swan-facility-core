"use client"

import type { CalendarGeometry, CalendarInteractionPreview } from "@/app/bookings/calendar/calendar-types"

interface ReservationPreviewProps {
  preview: CalendarInteractionPreview
  geometry: CalendarGeometry
}

const AVAILABILITY_STYLES = {
  idle: "border-sky-200 bg-sky-600/70",
  validating: "border-sky-200 bg-sky-600/70",
  available
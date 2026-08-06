import { notFound } from "next/navigation"
import { BookingCalendarE2EHarness } from "@/components/booking-calendar-e2e-harness"

export default function BookingCalendarE2EPage() {
  if (process.env.E2E_CALENDAR_HARNESS !== "1") notFound()
  return <BookingCalendarE2EHarness />
}

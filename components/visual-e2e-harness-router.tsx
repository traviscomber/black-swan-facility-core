"use client"

import { useSearchParams } from "next/navigation"
import { BookingCalendarE2EHarness } from "@/components/booking-calendar-e2e-harness"
import { OrchardShellE2EHarness } from "@/components/orchard/orchard-shell-e2e-harness"

export function VisualE2EHarnessRouter() {
  const searchParams = useSearchParams()
  return searchParams.get("surface") === "orchard"
    ? <OrchardShellE2EHarness />
    : <BookingCalendarE2EHarness />
}

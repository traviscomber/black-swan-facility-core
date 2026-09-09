"use client"

import { useSearchParams } from "next/navigation"
import { BookingCalendarE2EHarness } from "@/components/booking-calendar-e2e-harness"
import { OrchardShellE2EHarness } from "@/components/orchard/orchard-shell-e2e-harness"

export function VisualE2EHarnessRouter() {
  const searchParams = useSearchParams()
  if (searchParams.get("surface") !== "orchard") return <BookingCalendarE2EHarness />

  const priority = searchParams.get("priority")
  const prioritySurface = priority === "crop-map" || priority === "work" ? priority : null
  return <OrchardShellE2EHarness prioritySurface={prioritySurface} />
}

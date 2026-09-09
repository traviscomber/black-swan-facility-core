import { notFound } from "next/navigation"
import { VisualE2EHarnessRouter } from "@/components/visual-e2e-harness-router"

export default function BookingCalendarE2EPage() {
  if (process.env.E2E_CALENDAR_HARNESS !== "1") notFound()
  return <VisualE2EHarnessRouter />
}

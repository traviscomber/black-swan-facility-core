import { notFound } from "next/navigation"
import { BookingCalendarE2EHarness } from "@/components/booking-calendar-e2e-harness"
import { OrchardShellE2EHarness } from "@/components/orchard/orchard-shell-e2e-harness"

export default async function BookingCalendarE2EPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>
}) {
  if (process.env.E2E_CALENDAR_HARNESS !== "1") notFound()
  const params = await searchParams
  if (params.surface === "orchard") return <OrchardShellE2EHarness />
  return <BookingCalendarE2EHarness />
}

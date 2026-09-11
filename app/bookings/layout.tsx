"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AccessGate } from "@/components/access/access-gate"
import { AppLayout } from "@/components/app-layout"
import { BookingsLegacyLocalizationBridge } from "@/components/bookings-legacy-localization-bridge"
import "./booking-bedbooking.css"
import "./booking-workspace.css"
import "./booking-section-polish.css"
import "./booking-subsections-v2.css"
import "./calendar/bedbooking-density.css"

const ROUTE_LOCALES = new Set(["en", "es", "de"])

function stripLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (ROUTE_LOCALES.has(segments[0])) segments.shift()
  return `/${segments.join("/")}` || "/"
}

function bookingSection(pathname: string) {
  const segment = pathname.replace(/^\/bookings\/?/, "").split("/")[0]
  return segment || "reservations"
}

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const internalPathname = stripLocale(pathname)

  if (internalPathname === "/bookings/e2e-harness") return <>{children}</>

  return (
    <AccessGate action="booking.modify" department="booking">
      <div className="booking-workspace contents" data-booking-section={bookingSection(internalPathname)}>
        <BookingsLegacyLocalizationBridge />
        <AppLayout>{children}</AppLayout>
      </div>
    </AccessGate>
  )
}

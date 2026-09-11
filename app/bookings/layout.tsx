"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AccessGate } from "@/components/access/access-gate"
import { BookingsLegacyLocalizationBridge } from "@/components/bookings-legacy-localization-bridge"
import { BookingReferenceSidebar } from "@/components/calendar/booking-reference-sidebar"
import { useLanguage } from "@/lib/hooks/use-language"
import "./booking-bedbooking.css"
import "./booking-workspace.css"
import "./calendar/bedbooking-density.css"

const ROUTE_LOCALES = new Set(["en", "es", "de"])
const BOOKING_LAYOUT_LOCALE = { en: "en", es: "es", de: "de" } as const

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
  const { language } = useLanguage()
  const internalPathname = stripLocale(pathname)

  if (internalPathname === "/bookings/e2e-harness") return <>{children}</>

  return (
    <AccessGate action="booking.modify" department="booking">
      <div className="booking-workspace contents" data-locale={BOOKING_LAYOUT_LOCALE[language]} data-booking-section={bookingSection(internalPathname)}>
        <BookingsLegacyLocalizationBridge />
        <div className="booking-calendar-reference-frame">
          <BookingReferenceSidebar />
          <main className="booking-calendar-bedbooking-shell min-w-0">{children}</main>
        </div>
      </div>
    </AccessGate>
  )
}

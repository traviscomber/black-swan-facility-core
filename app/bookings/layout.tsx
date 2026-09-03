"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AccessGate } from "@/components/access/access-gate"
import { BookingsLegacyLocalizationBridge } from "@/components/bookings-legacy-localization-bridge"

const ROUTE_LOCALES = new Set(["en", "es", "de"])

function stripLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (ROUTE_LOCALES.has(segments[0])) segments.shift()
  return `/${segments.join("/")}` || "/"
}

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const internalPathname = stripLocale(pathname)

  if (internalPathname === "/bookings/e2e-harness") return <>{children}</>

  return (
    <AccessGate action="booking.modify" department="booking">
      <div className="booking-workspace contents">
        <BookingsLegacyLocalizationBridge />
        {children}
      </div>
    </AccessGate>
  )
}

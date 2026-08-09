"use client"

import { Suspense } from "react"
import { GuestRequestForm } from "@/components/guest-request-form"
import { GuestHouseQrAuto } from "@/components/guest-house-qr-auto"

export default function GuestRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <GuestRequestForm />
      <GuestHouseQrAuto />
    </Suspense>
  )
}

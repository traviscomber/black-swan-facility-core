"use client"

import { Suspense } from "react"
import { GuestHouseQrAuto } from "@/components/guest-house-qr-auto"
import { GuestStayPortal } from "@/components/guest-stay-portal"

export default function GuestAccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>}>
      <GuestHouseQrAuto />
      <GuestStayPortal />
    </Suspense>
  )
}

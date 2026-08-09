"use client"

import { Suspense } from "react"
import { GuestStayPortal } from "@/components/guest-stay-portal"

export default function GuestAccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>}>
      <GuestStayPortal />
    </Suspense>
  )
}

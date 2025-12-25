"use client"

import { Suspense } from "react"
import { GuestRequestForm } from "@/components/guest-request-form"

export default function GuestRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="text-white text-lg">Loading...</div>
        </div>
      }
    >
      <GuestRequestForm />
    </Suspense>
  )
}

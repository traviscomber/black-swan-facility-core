"use client"

import { Suspense } from "react"
import { GuestRequestForm } from "@/components/guest-request-form"
import { GuestHouseQrAuto } from "@/components/guest-house-qr-auto"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = { en: "Loading…", es: "Cargando…", de: "Wird geladen…" } as const

export default function GuestRequestsPage() {
  const { language } = useLanguage()
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{copy[language]}</div>}>
      <GuestRequestForm />
      <GuestHouseQrAuto />
    </Suspense>
  )
}

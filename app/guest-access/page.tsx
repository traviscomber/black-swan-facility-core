"use client"

import { Suspense } from "react"
import { GuestHouseQrAuto } from "@/components/guest-house-qr-auto"
import { GuestStayPortal } from "@/components/guest-stay-portal"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = { en: "Loading…", es: "Cargando…", de: "Wird geladen…" } as const

export default function GuestAccessPage() {
  const { language } = useLanguage()
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{copy[language]}</div>}>
      <GuestHouseQrAuto />
      <GuestStayPortal />
    </Suspense>
  )
}

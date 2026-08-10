"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { GuestHouseQr } from "@/components/guest-house-qr"

type Language = "es" | "en" | "de"

function localeFromPath(pathname: string): Language {
  const locale = pathname.split("/")[1]
  return locale === "en" || locale === "de" ? locale : "es"
}

export function GuestHouseQrAuto() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const language = localeFromPath(pathname)
  const access = searchParams.get("access")

  if (access) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-6 md:pt-8">
      <GuestHouseQr language={language} />
    </div>
  )
}

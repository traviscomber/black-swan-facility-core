"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "react-qr-code"
import { QrCode } from "lucide-react"

type Props = {
  locationId: string
  locationName: string
  deviceId: string
  language: "es" | "en" | "de"
}

const COPY = {
  es: { title: "Pedir desde tu celular", detail: "Escanea este QR y selecciona tu nombre. El mismo QR funciona en todas las tablets." },
  en: { title: "Request from your phone", detail: "Scan this QR and select your name. The same QR works on every tablet." },
  de: { title: "Vom Handy anfragen", detail: "Scannen Sie diesen QR-Code und wählen Sie Ihren Namen. Derselbe QR-Code funktioniert auf allen Tablets." },
} as const

export function GuestHouseQr({ locationName, language }: Props) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[language]
  const locale = useMemo(() => language, [language])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch("/api/guest-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "QR unavailable")
        if (cancelled) return
        setUrl(`${window.location.origin}/${locale}/guest-access?access=${encodeURIComponent(payload.token)}`)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "QR unavailable")
      }
    }
    void load()
    return () => { cancelled = true }
  }, [locale])

  return (
    <section className="mt-5 border border-border bg-card p-5">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <QrCode className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">{copy.title}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.detail}</p>
          <p className="mt-2 text-xs font-medium text-foreground">Black Swan · {locationName}</p>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
        {url && (
          <div className="bg-white p-3" aria-label="QR global de huéspedes Black Swan">
            <QRCode value={url} size={132} level="M" />
          </div>
        )}
      </div>
    </section>
  )
}

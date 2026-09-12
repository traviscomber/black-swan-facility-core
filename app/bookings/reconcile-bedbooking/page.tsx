"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type RepairStatus = "pending" | "fixed" | "already_correct" | "skipped" | "failed"
type RepairResult = {
  guest: string
  status: RepairStatus
  detail: string
}

const corrections = [
  { guest: "Santiago Colvin y Javiera Gonzalez", oldIn: "2026-09-11", oldOut: "2026-09-19", newIn: "2026-09-12", newOut: "2026-09-20" },
  { guest: "sara colvin", oldIn: "2026-09-11", oldOut: "2026-09-19", newIn: "2026-09-12", newOut: "2026-09-20" },
  { guest: "Raimundo Amenabar", oldIn: "2026-09-12", oldOut: "2026-09-19", newIn: "2026-09-13", newOut: "2026-09-20" },
  { guest: "Paola Mondiglio y Camila valdez", oldIn: "2026-09-13", oldOut: "2026-09-16", newIn: "2026-09-14", newOut: "2026-09-17" },
  { guest: "Paul Baghai y Camila de la Fuente", oldIn: "2026-09-15", oldOut: "2026-09-18", newIn: "2026-09-16", newOut: "2026-09-19" },
  { guest: "sik y hittokiri", oldIn: "2026-09-15", oldOut: "2026-09-18", newIn: "2026-09-16", newOut: "2026-09-19" },
  { guest: "felipe ateaga y geronimo ateaga y Maite rocio", oldIn: "2026-09-16", oldOut: "2026-09-17", newIn: "2026-09-17", newOut: "2026-09-18" },
  { guest: "JP y Pame e hijos", oldIn: "2026-09-16", oldOut: "2026-09-17", newIn: "2026-09-17", newOut: "2026-09-18" },
] as const

const copy = {
  en: {
    eyebrow: "Black Swan · Booking reconciliation",
    title: "BedBooking date offset repair",
    body: "Authenticated, idempotent repair of the verified September 2026 BedBooking import batch.",
    waiting: "Waiting",
    auth: "Authenticated session required",
    expected: (count: number) => `Expected one BedBooking reservation, found ${count}`,
    unexpected: (checkIn: string, checkOut: string) => `Unexpected current dates ${checkIn} → ${checkOut}`,
    failed: "Resize failed",
    done: "Repair finished. Return to Calendar and refresh.",
    working: "Repairing canonical reservations…",
  },
  es: {
    eyebrow: "Black Swan · Reconciliación de reservas",
    title: "Corrección de desfase de fechas BedBooking",
    body: "Corrección autenticada e idempotente del lote BedBooking verificado de septiembre de 2026.",
    waiting: "En espera",
    auth: "Se requiere sesión autenticada",
    expected: (count: number) => `Se esperaba una reserva BedBooking; se encontraron ${count}`,
    unexpected: (checkIn: string, checkOut: string) => `Fechas actuales inesperadas ${checkIn} → ${checkOut}`,
    failed: "No fue posible cambiar las fechas",
    done: "Corrección terminada. Vuelve al Calendario y actualiza.",
    working: "Corrigiendo reservas canónicas…",
  },
  de: {
    eyebrow: "Black Swan · Buchungsabgleich",
    title: "Korrektur des BedBooking-Datumsversatzes",
    body: "Authentifizierte, idempotente Korrektur des geprüften BedBooking-Imports vom September 2026.",
    waiting: "Wartet",
    auth: "Authentifizierte Sitzung erforderlich",
    expected: (count: number) => `Eine BedBooking-Reservierung erwartet, ${count} gefunden`,
    unexpected: (checkIn: string, checkOut: string) => `Unerwartete aktuelle Daten ${checkIn} → ${checkOut}`,
    failed: "Datumsänderung fehlgeschlagen",
    done: "Korrektur abgeschlossen. Zum Kalender zurückkehren und aktualisieren.",
    working: "Kanonische Reservierungen werden korrigiert…",
  },
} as const

export default function ReconcileBedBookingPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const [results, setResults] = useState<RepairResult[]>(corrections.map((item) => ({ guest: item.guest, status: "pending", detail: c.waiting })))
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function run() {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        if (!cancelled) {
          setResults(corrections.map((item) => ({ guest: item.guest, status: "failed", detail: c.auth })))
          setDone(true)
        }
        return
      }

      const next: RepairResult[] = []
      for (const item of corrections) {
        const { data: rows, error: readError } = await supabase
          .from("reservations")
          .select("id, guest_name, bed_id, check_in, check_out, source, status")
          .eq("source", "bedbooking")
          .eq("guest_name", item.guest)
          .limit(2)

        if (readError) {
          next.push({ guest: item.guest, status: "failed", detail: readError.message })
          continue
        }
        if (!rows || rows.length !== 1) {
          next.push({ guest: item.guest, status: "skipped", detail: c.expected(rows?.length ?? 0) })
          continue
        }

        const row = rows[0]
        if (row.check_in === item.newIn && row.check_out === item.newOut) {
          next.push({ guest: item.guest, status: "already_correct", detail: `${item.newIn} → ${item.newOut}` })
          continue
        }
        if (row.check_in !== item.oldIn || row.check_out !== item.oldOut) {
          next.push({ guest: item.guest, status: "skipped", detail: c.unexpected(row.check_in, row.check_out) })
          continue
        }

        const { data: resized, error: resizeError } = await supabase.rpc("resize_booking_reservation", {
          p_reservation_id: row.id,
          p_check_in: item.newIn,
          p_check_out: item.newOut,
        })

        if (resizeError) {
          next.push({ guest: item.guest, status: "failed", detail: resizeError.message })
          continue
        }

        const result = Array.isArray(resized) ? resized[0] : resized
        if (!result?.success) {
          next.push({ guest: item.guest, status: "failed", detail: result?.message ?? c.failed })
          continue
        }

        next.push({ guest: item.guest, status: "fixed", detail: `${item.newIn} → ${item.newOut}` })
      }

      if (!cancelled) {
        setResults(next)
        setDone(true)
      }
    }

    void run()
    return () => { cancelled = true }
  }, [c])

  return (
    <div className="min-h-screen bg-[#171512] p-8 text-[#e7e1d8]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-xs uppercase tracking-[0.18em] text-[#9d958b]">{c.eyebrow}</div>
        <h1 className="mb-2 text-2xl font-medium">{c.title}</h1>
        <p className="mb-6 text-sm text-[#b9b0a4]">{c.body}</p>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {results.map((result) => (
            <div key={result.guest} className="grid grid-cols-[1fr_150px_220px] gap-4 py-3 text-sm">
              <div>{result.guest}</div>
              <div className="text-[#b9b0a4]">{result.status}</div>
              <div className="text-right text-[#9d958b]">{result.detail}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-sm text-[#b9b0a4]">{done ? c.done : c.working}</div>
      </div>
    </div>
  )
}

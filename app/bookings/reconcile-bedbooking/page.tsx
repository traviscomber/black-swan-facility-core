"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

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

export default function ReconcileBedBookingPage() {
  const [results, setResults] = useState<RepairResult[]>(corrections.map((item) => ({ guest: item.guest, status: "pending", detail: "Waiting" })))
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function run() {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        if (!cancelled) {
          setResults(corrections.map((item) => ({ guest: item.guest, status: "failed", detail: "Authenticated session required" })))
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
          next.push({ guest: item.guest, status: "skipped", detail: `Expected one BedBooking reservation, found ${rows?.length ?? 0}` })
          continue
        }

        const row = rows[0]
        if (row.check_in === item.newIn && row.check_out === item.newOut) {
          next.push({ guest: item.guest, status: "already_correct", detail: `${item.newIn} → ${item.newOut}` })
          continue
        }
        if (row.check_in !== item.oldIn || row.check_out !== item.oldOut) {
          next.push({ guest: item.guest, status: "skipped", detail: `Unexpected current dates ${row.check_in} → ${row.check_out}` })
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
          next.push({ guest: item.guest, status: "failed", detail: result?.message ?? "Resize failed" })
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
  }, [])

  return (
    <div className="min-h-screen bg-[#171512] p-8 text-[#e7e1d8]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-xs uppercase tracking-[0.18em] text-[#9d958b]">Black Swan · Booking reconciliation</div>
        <h1 className="mb-2 text-2xl font-medium">BedBooking date offset repair</h1>
        <p className="mb-6 text-sm text-[#b9b0a4]">Authenticated, idempotent repair of the verified September 2026 BedBooking import batch.</p>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {results.map((result) => (
            <div key={result.guest} className="grid grid-cols-[1fr_150px_220px] gap-4 py-3 text-sm">
              <div>{result.guest}</div>
              <div className="text-[#b9b0a4]">{result.status}</div>
              <div className="text-right text-[#9d958b]">{result.detail}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-sm text-[#b9b0a4]">{done ? "Repair finished. Return to Calendar and refresh." : "Repairing canonical reservations…"}</div>
      </div>
    </div>
  )
}

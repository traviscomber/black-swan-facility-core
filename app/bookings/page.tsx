"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, Search, Plus, RefreshCw, Users, BedDouble } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { title: "Reservation list", search: "Search guest, room or property", all: "All statuses", guest: "Guest", stay: "Stay", room: "Room", guests: "Guests", status: "Status", amount: "Amount", empty: "No reservations found", refresh: "Refresh", add: "Add", calendar: "Calendar" },
  es: { title: "Lista de reservas", search: "Buscar huésped, habitación o propiedad", all: "Todos los estados", guest: "Huésped", stay: "Estadía", room: "Habitación", guests: "Huéspedes", status: "Estado", amount: "Monto", empty: "No se encontraron reservas", refresh: "Actualizar", add: "Agregar", calendar: "Calendario" },
  de: { title: "Reservierungsliste", search: "Gast, Zimmer oder Unterkunft suchen", all: "Alle Status", guest: "Gast", stay: "Aufenthalt", room: "Zimmer", guests: "Gäste", status: "Status", amount: "Betrag", empty: "Keine Reservierungen gefunden", refresh: "Aktualisieren", add: "Hinzufügen", calendar: "Kalender" },
} as const

type ReservationRow = {
  id: string
  guest_name: string
  guest_email: string | null
  check_in: string
  check_out: string
  status: string
  num_guests: number | null
  total_amount: number | null
  room: { room_number: string | null; location: { name: string | null } | null } | null
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ")
}

export default function BookingsPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("reservations")
      .select("id, guest_name, guest_email, check_in, check_out, status, num_guests, total_amount, room:rooms(room_number, location:locations(name))")
      .order("check_in", { ascending: false })
      .limit(500)

    if (loadError) setError(loadError.message)
    else setRows((data ?? []) as unknown as ReservationRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.status))).sort(), [rows])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false
      if (!term) return true
      const haystack = [row.guest_name, row.guest_email, row.room?.room_number, row.room?.location?.name].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(term)
    })
  }, [query, rows, status])

  return (
    <section className="min-h-screen bg-[#111213] text-white">
      <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-white/10 bg-[#17191a] px-3">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-medium">{c.title}</h1>
          <p className="text-[11px] text-white/45">{filtered.length} / {rows.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${language}/bookings/calendar`} className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-white/10 bg-[#111314] px-3 text-xs hover:bg-white/5"><CalendarDays className="h-4 w-4" />{c.calendar}</Link>
          <button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-[4px] border border-white/10 bg-[#111314]" aria-label={c.refresh}><RefreshCw className="h-4 w-4" /></button>
          <Link href={`/${language}/bookings/calendar?new=1`} className="inline-flex h-9 items-center gap-2 rounded-[5px] bg-[#04b958] px-4 text-xs font-medium text-white"><Plus className="h-4 w-4" />{c.add}</Link>
        </div>
      </header>

      <div className="flex min-h-[44px] items-center gap-2 border-b border-white/10 bg-[#151718] px-3 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} className="h-8 w-full rounded-[3px] border border-white/10 bg-[#111314] pl-9 pr-3 text-xs outline-none placeholder:text-white/30 focus:border-[#04b958]/70" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 min-w-44 rounded-[3px] border border-white/10 bg-[#111314] px-2 text-xs">
          <option value="all">{c.all}</option>
          {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
        </select>
      </div>

      {error ? <div className="m-3 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div> : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#17191a] text-[10px] uppercase tracking-[.08em] text-white/45">
            <tr>
              <th className="border-b border-white/10 px-4 py-3 font-medium">{c.guest}</th>
              <th className="border-b border-white/10 px-3 py-3 font-medium">{c.stay}</th>
              <th className="border-b border-white/10 px-3 py-3 font-medium">{c.room}</th>
              <th className="border-b border-white/10 px-3 py-3 font-medium">{c.guests}</th>
              <th className="border-b border-white/10 px-3 py-3 font-medium">{c.status}</th>
              <th className="border-b border-white/10 px-4 py-3 text-right font-medium">{c.amount}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={6} className="border-b border-white/5 px-4 py-5"><div className="h-3 w-2/3 bg-white/5" /></td></tr>) : null}
            {!loading && filtered.map((row) => (
              <tr key={row.id} className="border-b border-white/[.06] hover:bg-white/[.025]">
                <td className="px-4 py-3"><div className="font-medium text-white/92">{row.guest_name}</div><div className="mt-1 text-[10px] text-white/35">{row.guest_email ?? "—"}</div></td>
                <td className="px-3 py-3 text-white/70">{row.check_in} → {row.check_out}</td>
                <td className="px-3 py-3"><div className="flex items-center gap-2 text-white/75"><BedDouble className="h-3.5 w-3.5 text-white/35" />{row.room?.room_number ?? "—"}</div><div className="mt-1 text-[10px] text-white/30">{row.room?.location?.name ?? ""}</div></td>
                <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-white/65"><Users className="h-3.5 w-3.5" />{row.num_guests ?? 1}</span></td>
                <td className="px-3 py-3"><span className="rounded-[3px] border border-white/10 bg-white/[.035] px-2 py-1 capitalize text-white/70">{statusLabel(row.status)}</span></td>
                <td className="px-4 py-3 text-right tabular-nums text-white/75">{new Intl.NumberFormat(language === "de" ? "de-DE" : language === "es" ? "es-CL" : "en-US", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(row.total_amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-white/35"><CalendarDays className="h-6 w-6" /><p className="text-xs">{c.empty}</p></div> : null}
      </div>
    </section>
  )
}

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("reservations")
      .select("id, guest_name, guest_email, check_in, check_out, status, num_guests, total_amount, room:rooms(room_number, location:locations(name))")
      .order("check_in", { ascending: false })
      .limit(500)

    if (loadError) setError(loadError.message)
    else setRows((data ?? []) as unknown as ReservationRow[])
    if (!silent) setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("booking-reservation-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load(true))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

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
    <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
      <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-3">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-medium">{c.title}</h1>
          <p className="text-[11px] text-[#8f867b]">{filtered.length} / {rows.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${language}/bookings/calendar`} prefetch={false} className="inline-flex h-9 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><CalendarDays className="h-4 w-4" />{c.calendar}</Link>
          <button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center bg-[#2b2722]" aria-label={c.refresh}><RefreshCw className="h-4 w-4" /></button>
          <Link href={`/${language}/bookings/calendar?new=1`} prefetch={false} className="inline-flex h-9 items-center gap-2 bg-[#6f8373] px-4 text-xs font-medium text-[#171512]"><Plus className="h-4 w-4" />{c.add}</Link>
        </div>
      </header>

      <div className="flex min-h-[44px] items-center gap-2 bg-[#211e1a] px-3 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f867b]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none placeholder:text-[#8f867b] focus:ring-1 focus:ring-[#6f8373]" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 min-w-44 bg-[#171512] px-2 text-xs outline-none focus:ring-1 focus:ring-[#6f8373]">
          <option value="all">{c.all}</option>
          {statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
        </select>
      </div>

      {error ? <div className="m-3 bg-[#3a2522] p-3 text-xs text-[#e1a79c]">{error}</div> : null}

      <div className="overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#211e1a] text-[10px] uppercase tracking-[.08em] text-[#8f867b]">
            <tr>
              <th className="px-4 py-3 font-medium">{c.guest}</th>
              <th className="px-3 py-3 font-medium">{c.stay}</th>
              <th className="px-3 py-3 font-medium">{c.room}</th>
              <th className="px-3 py-3 font-medium">{c.guests}</th>
              <th className="px-3 py-3 font-medium">{c.status}</th>
              <th className="px-4 py-3 text-right font-medium">{c.amount}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={6} className="px-4 py-5"><div className="h-3 w-2/3 bg-[#2b2722]" /></td></tr>) : null}
            {!loading && filtered.map((row) => (
              <tr key={row.id} className="hover:bg-[#211e1a]">
                <td className="px-4 py-3"><Link href={`/${language}/bookings/reservations/${row.id}`} prefetch={false} className="block outline-none focus-visible:ring-1 focus-visible:ring-[#6f8373]"><div className="font-medium text-[#e7e1d8] hover:text-[#a9b7aa]">{row.guest_name}</div><div className="mt-1 text-[10px] text-[#8f867b]">{row.guest_email ?? "—"}</div></Link></td>
                <td className="px-3 py-3 text-[#b9b0a4]">{row.check_in} → {row.check_out}</td>
                <td className="px-3 py-3"><div className="flex items-center gap-2 text-[#b9b0a4]"><BedDouble className="h-3.5 w-3.5 text-[#8f867b]" />{row.room?.room_number ?? "—"}</div><div className="mt-1 text-[10px] text-[#8f867b]">{row.room?.location?.name ?? ""}</div></td>
                <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-[#b9b0a4]"><Users className="h-3.5 w-3.5" />{row.num_guests ?? 1}</span></td>
                <td className="px-3 py-3"><span className="bg-[#2b2722] px-2 py-1 capitalize text-[#b9b0a4]">{statusLabel(row.status)}</span></td>
                <td className="px-4 py-3 text-right tabular-nums text-[#b9b0a4]">{new Intl.NumberFormat(language === "de" ? "de-DE" : language === "es" ? "es-CL" : "en-US", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(row.total_amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-[#8f867b]"><CalendarDays className="h-6 w-6" /><p className="text-xs">{c.empty}</p></div> : null}
      </div>
    </section>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, Download, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type RegistrationRow = {
  id: string
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string | null
  source: string | null
  num_guests: number | null
  guest: { name: string | null; email: string | null; phone: string | null; address: string | null; company_name: string | null } | null
  room: { room_number: string | null; location: { name: string | null } | null } | null
}

const copy = {
  en: {
    title: "Registration book", subtitle: "Canonical guest-stay register", search: "Search guest, contact, room or property", all: "All statuses", guest: "Guest", contact: "Contact", property: "Property / room", stay: "Stay", party: "Guests", status: "Status", source: "Source", empty: "No registered stays found", calendar: "Calendar", export: "Export CSV", address: "Address not recorded",
  },
  es: {
    title: "Libro de registro", subtitle: "Registro canónico de huéspedes y estadías", search: "Buscar huésped, contacto, habitación o propiedad", all: "Todos los estados", guest: "Huésped", contact: "Contacto", property: "Propiedad / habitación", stay: "Estadía", party: "Huéspedes", status: "Estado", source: "Origen", empty: "No hay estadías registradas", calendar: "Calendario", export: "Exportar CSV", address: "Dirección no registrada",
  },
  de: {
    title: "Melderegister", subtitle: "Kanonisches Gäste- und Aufenthaltsregister", search: "Gast, Kontakt, Zimmer oder Unterkunft suchen", all: "Alle Status", guest: "Gast", contact: "Kontakt", property: "Unterkunft / Zimmer", stay: "Aufenthalt", party: "Gäste", status: "Status", source: "Quelle", empty: "Keine registrierten Aufenthalte", calendar: "Kalender", export: "CSV exportieren", address: "Adresse nicht erfasst",
  },
} as const

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replaceAll("-", " ") : "—"
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
  return `"${text.replaceAll('"', '""')}"`
}

export default function RegistrationBookPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<RegistrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("reservations")
      .select("id, guest_name, guest_email, guest_phone, check_in, check_out, status, source, num_guests, guest:guests(name,email,phone,address,company_name), room:rooms(room_number, location:locations(name))")
      .order("check_in", { ascending: false })
      .limit(1000)

    if (loadError) {
      setError(loadError.message)
      setRows([])
    } else {
      setRows((data ?? []) as unknown as RegistrationRow[])
    }
    if (!silent) setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("booking-registration-book")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load(true))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.status).filter(Boolean) as string[])).sort(), [rows])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false
      if (!term) return true
      const guestName = row.guest?.name || row.guest_name || ""
      const guestEmail = row.guest?.email || row.guest_email || ""
      const guestPhone = row.guest?.phone || row.guest_phone || ""
      const haystack = [guestName, guestEmail, guestPhone, row.guest?.address, row.guest?.company_name, row.room?.room_number, row.room?.location?.name, row.source].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(term)
    })
  }, [query, rows, status])

  function exportCsv() {
    const header = ["reservation_id", "guest", "email", "phone", "address", "company", "property", "room", "check_in", "check_out", "guests", "status", "source"]
    const lines = filtered.map((row) => [
      row.id,
      row.guest?.name || row.guest_name,
      row.guest?.email || row.guest_email,
      row.guest?.phone || row.guest_phone,
      row.guest?.address,
      row.guest?.company_name,
      row.room?.location?.name,
      row.room?.room_number,
      row.check_in,
      row.check_out,
      row.num_guests ?? 1,
      row.status,
      row.source,
    ].map(csvCell).join(","))
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `booking-registration-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 bg-[#211e1a] px-3 py-2">
      <div><h1 className="text-[15px] font-normal">{c.title}</h1><p className="text-[11px] text-[#8f867b]">{c.subtitle} · {filtered.length} / {rows.length}</p></div>
      <div className="flex items-center gap-2">
        <Link href={`/${language}/bookings/calendar`} className="inline-flex h-9 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><CalendarDays className="h-4 w-4" />{c.calendar}</Link>
        <button type="button" onClick={exportCsv} disabled={!filtered.length} className="inline-flex h-9 items-center gap-2 bg-[#6f8373] px-3 text-xs font-medium text-[#171512] disabled:opacity-40"><Download className="h-4 w-4" />{c.export}</button>
      </div>
    </header>

    <div className="flex min-h-[44px] items-center gap-2 bg-[#211e1a] px-3 py-1.5">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f867b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none placeholder:text-[#8f867b] focus:ring-1 focus:ring-[#6f8373]" /></div>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 min-w-44 bg-[#171512] px-2 text-xs outline-none focus:ring-1 focus:ring-[#6f8373]"><option value="all">{c.all}</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
    </div>

    {error ? <div className="m-3 bg-[#3a2522] p-3 text-xs text-[#e1a79c]">{error}</div> : null}

    <div className="overflow-auto">
      <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[#211e1a] text-[10px] uppercase tracking-[.08em] text-[#8f867b]"><tr><th className="px-4 py-3 font-medium">{c.guest}</th><th className="px-3 py-3 font-medium">{c.contact}</th><th className="px-3 py-3 font-medium">{c.property}</th><th className="px-3 py-3 font-medium">{c.stay}</th><th className="px-3 py-3 font-medium">{c.party}</th><th className="px-3 py-3 font-medium">{c.status}</th><th className="px-4 py-3 font-medium">{c.source}</th></tr></thead>
        <tbody>
          {loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={7} className="px-4 py-5"><div className="h-3 w-2/3 bg-[#2b2722]" /></td></tr>) : null}
          {!loading && filtered.map((row) => {
            const guestName = row.guest?.name || row.guest_name || "—"
            const guestEmail = row.guest?.email || row.guest_email || "—"
            const guestPhone = row.guest?.phone || row.guest_phone || "—"
            return <tr key={row.id} className="border-t border-white/[.045] hover:bg-[#211e1a]">
              <td className="px-4 py-3"><Link href={`/${language}/bookings/reservations/${row.id}`} className="font-medium text-[#e7e1d8] hover:text-[#a9b7aa]">{guestName}</Link><div className="mt-1 text-[10px] text-[#8f867b]">{row.guest?.company_name || row.guest?.address || c.address}</div></td>
              <td className="px-3 py-3 text-[#b9b0a4]"><div>{guestEmail}</div><div className="mt-1 text-[10px] text-[#8f867b]">{guestPhone}</div></td>
              <td className="px-3 py-3 text-[#b9b0a4]"><div>{row.room?.location?.name || "—"}</div><div className="mt-1 text-[10px] text-[#8f867b]">{row.room?.room_number || "—"}</div></td>
              <td className="px-3 py-3 tabular-nums text-[#b9b0a4]">{row.check_in} → {row.check_out}</td>
              <td className="px-3 py-3 tabular-nums text-[#b9b0a4]">{row.num_guests ?? 1}</td>
              <td className="px-3 py-3"><span className="bg-[#2b2722] px-2 py-1 capitalize text-[#b9b0a4]">{label(row.status)}</span></td>
              <td className="px-4 py-3 capitalize text-[#8f867b]">{label(row.source)}</td>
            </tr>
          })}
        </tbody>
      </table>
      {!loading && filtered.length === 0 ? <div className="flex min-h-56 items-center justify-center text-xs text-[#8f867b]">{c.empty}</div> : null}
    </div>
  </section>
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { downloadCsv } from "@/lib/client-csv"

type CancelledRow = {
  external_ref: string
  source_period: string | null
  payload: { client?: string; room?: string; start?: string; end?: string; nights?: number; amount?: string; status?: string; added_date?: string } | null
}

const copy = {
  en: { title:"Cancelled reservations", subtitle:"Historical BedBooking cancellations preserved outside the active reservation ledger.", search:"Search guest, room or BedBooking ID", empty:"No cancelled reservations found.", guest:"Guest", room:"Room", stay:"Stay", nights:"Nights", amount:"Amount", added:"Added", source:"BedBooking ID", export:"Export CSV" },
  es: { title:"Reservas canceladas", subtitle:"Cancelaciones históricas de BedBooking preservadas fuera del libro activo de reservas.", search:"Buscar huésped, habitación o ID BedBooking", empty:"No hay reservas canceladas.", guest:"Huésped", room:"Habitación", stay:"Estadía", nights:"Noches", amount:"Monto", added:"Agregada", source:"ID BedBooking", export:"Exportar CSV" },
  de: { title:"Stornierte Buchungen", subtitle:"Historische BedBooking-Stornierungen außerhalb des aktiven Buchungsbestands.", search:"Gast, Zimmer oder BedBooking-ID suchen", empty:"Keine stornierten Buchungen.", guest:"Gast", room:"Zimmer", stay:"Aufenthalt", nights:"Nächte", amount:"Betrag", added:"Erstellt", source:"BedBooking-ID", export:"CSV exportieren" },
} as const

export default function CancelledReservationsPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const supabase = useMemo(() => createClient(), [])
  const [rows,setRows]=useState<CancelledRow[]>([])
  const [query,setQuery]=useState("")
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  const load=useCallback(async()=>{
    setLoading(true); setError(null)
    const { data,error:loadError } = await supabase.from("booking_import_records")
      .select("external_ref, source_period, payload")
      .eq("source_system","bedbooking")
      .eq("entity_type","cancelled_reservation")
      .order("source_period",{ascending:false})
      .order("external_ref",{ascending:false})
    if(loadError){ setError(loadError.message); setRows([]) } else setRows((data ?? []) as CancelledRow[])
    setLoading(false)
  },[supabase])

  useEffect(()=>{ void load() },[load])

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase()
    if(!term) return rows
    return rows.filter(row=>[row.external_ref,row.payload?.client,row.payload?.room,row.payload?.start,row.payload?.end,row.payload?.amount].filter(Boolean).join(" ").toLowerCase().includes(term))
  },[query,rows])

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-4 py-2"><div><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle} · {filtered.length}</p></div><button type="button" onClick={()=>downloadCsv(`cancelled-reservations-${new Date().toISOString().slice(0,10)}.csv`,[c.guest,c.room,c.stay,c.nights,c.amount,c.added,c.source],filtered.map(row=>[row.payload?.client??"",row.payload?.room??"",`${row.payload?.start??""} → ${row.payload?.end??""}`,row.payload?.nights??"",row.payload?.amount??"",row.payload?.added_date??"",row.external_ref]))} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><Download className="h-3.5 w-3.5"/>{c.export}</button></header>
    <div className="bg-[#211e1a] px-3 py-2"><div className="relative max-w-2xl"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f867b]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={c.search} className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none"/></div></div>
    {error ? <div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div> : null}
    <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-xs"><thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.guest}</th><th className="px-3 py-2">{c.room}</th><th className="px-3 py-2">{c.stay}</th><th className="px-3 py-2">{c.nights}</th><th className="px-3 py-2">{c.amount}</th><th className="px-3 py-2">{c.added}</th><th className="px-3 py-2">{c.source}</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[#8f867b]">Loading…</td></tr> : filtered.length===0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[#8f867b]">{c.empty}</td></tr> : filtered.map(row=><tr key={row.external_ref} className="border-t border-white/[.05] hover:bg-[#211e1a]"><td className="px-3 py-2">{row.payload?.client || "—"}</td><td className="px-3 py-2 text-[#b9b0a4]">{row.payload?.room || "—"}</td><td className="px-3 py-2 tabular-nums text-[#b9b0a4]">{row.payload?.start || "—"} → {row.payload?.end || "—"}</td><td className="px-3 py-2">{row.payload?.nights ?? "—"}</td><td className="px-3 py-2">{row.payload?.amount || "—"}</td><td className="px-3 py-2">{row.payload?.added_date || "—"}</td><td className="px-3 py-2 font-mono text-[11px] text-[#8f867b]">{row.external_ref}</td></tr>)}
    </tbody></table></div>
  </section>
}
"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { downloadCsv } from "@/lib/client-csv"

type Reservation={ id:string; guest_name:string; check_in:string; check_out:string; total_amount:number|null }
type Settings={ lodging_tax_rate:number|null; currency:string|null }

const copy={
  en:{title:"Local tax report",subtitle:"Tax estimate derived from canonical reservation amounts and the configured lodging-tax rate.",guest:"Guest",stay:"Stay",gross:"Recorded amount",tax:"Estimated local tax",rate:"Configured lodging tax",note:"Historical BedBooking Local Tax Report was empty; this report applies to canonical Black Swan amounts going forward.",export:"Export CSV",search:"Search guest or date",total:"Estimated tax total"},
  es:{title:"Reporte de impuesto local",subtitle:"Estimación tributaria derivada de los montos canónicos y la tasa de alojamiento configurada.",guest:"Huésped",stay:"Estadía",gross:"Monto registrado",tax:"Impuesto local estimado",rate:"Impuesto de alojamiento configurado",note:"El Local Tax Report histórico de BedBooking estaba vacío; este reporte aplica a los montos canónicos de Black Swan hacia adelante.",export:"Exportar CSV",search:"Buscar huésped o fecha",total:"Impuesto estimado total"},
  de:{title:"Lokaler Steuerbericht",subtitle:"Steuerschätzung aus kanonischen Buchungsbeträgen und konfiguriertem Unterkunftssteuersatz.",guest:"Gast",stay:"Aufenthalt",gross:"Erfasster Betrag",tax:"Geschätzte lokale Steuer",rate:"Konfigurierter Steuersatz",note:"Der historische BedBooking-Bericht war leer; dieser Bericht gilt künftig für kanonische Black-Swan-Beträge.",export:"CSV exportieren",search:"Gast oder Datum suchen",total:"Geschätzte Steuer gesamt"},
} as const

export default function LocalTaxReportPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [rows,setRows]=useState<Reservation[]>([]); const [settings,setSettings]=useState<Settings>({lodging_tax_rate:0,currency:"CLP"}); const [error,setError]=useState<string|null>(null); const [query,setQuery]=useState("")
  useEffect(()=>{ void (async()=>{
    const [rr,ss]=await Promise.all([
      supabase.from("reservations").select("id,guest_name,check_in,check_out,total_amount").gt("total_amount",0).order("check_in",{ascending:false}).limit(500),
      supabase.from("booking_settings").select("lodging_tax_rate,currency").eq("id","default").maybeSingle(),
    ])
    const first=rr.error||ss.error; if(first)setError(first.message); else { setRows((rr.data??[]) as Reservation[]); if(ss.data)setSettings(ss.data as Settings) }
  })() },[supabase])
  const rate=Number(settings.lodging_tax_rate??0)
  const currency=settings.currency||"CLP"
  const format=(v:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency,maximumFractionDigits:0}).format(v)
  const visible=useMemo(()=>{const term=query.trim().toLowerCase();return rows.filter(row=>!term||`${row.guest_name} ${row.check_in} ${row.check_out}`.toLowerCase().includes(term))},[query,rows])
  const estimatedTotal=useMemo(()=>visible.reduce((sum,row)=>sum+Number(row.total_amount??0)*(rate/100),0),[rate,visible])

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]"><header className="flex items-center justify-between gap-3 bg-[#211e1a] px-4 py-3"><div><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></div><button type="button" onClick={()=>downloadCsv(`local-tax-${new Date().toISOString().slice(0,10)}.csv`,[c.guest,c.stay,c.gross,c.tax],visible.map(row=>{const gross=Number(row.total_amount??0);return [row.guest_name,`${row.check_in} → ${row.check_out}`,gross,gross*(rate/100)]}))} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs"><Download className="h-3.5 w-3.5"/>{c.export}</button></header>
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#2b2722] px-4 py-2 text-xs text-[#b9b0a4]"><span>{c.rate}: {rate.toFixed(2)}% · {c.note}</span><strong className="font-medium text-[#e7e1d8]">{c.total}: {format(estimatedTotal)}</strong></div>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="bg-[#211e1a] px-3 py-1"><div className="relative max-w-2xl"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f867b]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={c.search} className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none"/></div></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-xs"><thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.guest}</th><th className="px-3 py-2">{c.stay}</th><th className="px-3 py-2">{c.gross}</th><th className="px-3 py-2">{c.tax}</th></tr></thead><tbody>{rows.map(row=>{const gross=Number(row.total_amount??0);return <tr key={row.id} className="border-t border-white/[.05]"><td className="px-3 py-2">{row.guest_name}</td><td className="px-3 py-2 text-[#b9b0a4]">{row.check_in} → {row.check_out}</td><td className="px-3 py-2">{format(gross)}</td><td className="px-3 py-2">{format(gross*(rate/100))}</td></tr>})}</tbody></table></div>
  </section>
}
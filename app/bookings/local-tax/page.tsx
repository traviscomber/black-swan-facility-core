"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Reservation={ id:string; guest_name:string; check_in:string; check_out:string; total_amount:number|null }
type Settings={ lodging_tax_rate:number|null; currency:string|null }

const copy={
  en:{title:"Local tax report",subtitle:"Tax estimate derived from canonical reservation amounts and the configured lodging-tax rate.",guest:"Guest",stay:"Stay",gross:"Recorded amount",tax:"Estimated local tax",rate:"Configured lodging tax",note:"Historical BedBooking Local Tax Report was empty; this report applies to canonical Black Swan amounts going forward."},
  es:{title:"Reporte de impuesto local",subtitle:"Estimación tributaria derivada de los montos canónicos y la tasa de alojamiento configurada.",guest:"Huésped",stay:"Estadía",gross:"Monto registrado",tax:"Impuesto local estimado",rate:"Impuesto de alojamiento configurado",note:"El Local Tax Report histórico de BedBooking estaba vacío; este reporte aplica a los montos canónicos de Black Swan hacia adelante."},
  de:{title:"Lokaler Steuerbericht",subtitle:"Steuerschätzung aus kanonischen Buchungsbeträgen und konfiguriertem Unterkunftssteuersatz.",guest:"Gast",stay:"Aufenthalt",gross:"Erfasster Betrag",tax:"Geschätzte lokale Steuer",rate:"Konfigurierter Steuersatz",note:"Der historische BedBooking-Bericht war leer; dieser Bericht gilt künftig für kanonische Black-Swan-Beträge."},
} as const

export default function LocalTaxReportPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [rows,setRows]=useState<Reservation[]>([]); const [settings,setSettings]=useState<Settings>({lodging_tax_rate:0,currency:"CLP"}); const [error,setError]=useState<string|null>(null)
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

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]"><header className="bg-[#211e1a] px-4 py-3"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    <div className="bg-[#2b2722] px-4 py-3 text-xs text-[#b9b0a4]">{c.rate}: {rate.toFixed(2)}% · {c.note}</div>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-xs"><thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.guest}</th><th className="px-3 py-2">{c.stay}</th><th className="px-3 py-2">{c.gross}</th><th className="px-3 py-2">{c.tax}</th></tr></thead><tbody>{rows.map(row=>{const gross=Number(row.total_amount??0);return <tr key={row.id} className="border-t border-white/[.05]"><td className="px-3 py-2">{row.guest_name}</td><td className="px-3 py-2 text-[#b9b0a4]">{row.check_in} → {row.check_out}</td><td className="px-3 py-2">{format(gross)}</td><td className="px-3 py-2">{format(gross*(rate/100))}</td></tr>})}</tbody></table></div>
  </section>
}
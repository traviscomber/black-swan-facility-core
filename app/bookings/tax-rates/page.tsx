"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type TaxRate={ id:string; source_system:string; external_ref:string; label:string|null; rate:number|null; tax_treatment:string|null; is_active:boolean|null }

const copy={
  en:{title:"Tax rates",subtitle:"Preserved InvoiceOcean / BedBooking tax treatments.",label:"Label",rate:"Rate",treatment:"Treatment",source:"Source",status:"Status",active:"Active",inactive:"Inactive"},
  es:{title:"Tasas de impuesto",subtitle:"Tratamientos tributarios preservados desde InvoiceOcean / BedBooking.",label:"Etiqueta",rate:"Tasa",treatment:"Tratamiento",source:"Origen",status:"Estado",active:"Activo",inactive:"Inactivo"},
  de:{title:"Steuersätze",subtitle:"Aus InvoiceOcean / BedBooking erhaltene Steuerbehandlungen.",label:"Bezeichnung",rate:"Satz",treatment:"Behandlung",source:"Quelle",status:"Status",active:"Aktiv",inactive:"Inaktiv"},
} as const

export default function TaxRatesPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [rows,setRows]=useState<TaxRate[]>([]); const [error,setError]=useState<string|null>(null)
  useEffect(()=>{ void (async()=>{
    const {data,error:loadError}=await supabase.from("booking_external_tax_rates").select("id,source_system,external_ref,label,rate,tax_treatment,is_active").order("rate",{ascending:false})
    if(loadError)setError(loadError.message); else setRows((data??[]) as TaxRate[])
  })() },[supabase])

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]"><header className="bg-[#211e1a] px-4 py-3"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle} · {rows.length}</p></header>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.label}</th><th className="px-3 py-2">{c.rate}</th><th className="px-3 py-2">{c.treatment}</th><th className="px-3 py-2">{c.source}</th><th className="px-3 py-2">{c.status}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-white/[.05]"><td className="px-3 py-2">{row.label||row.external_ref}</td><td className="px-3 py-2">{row.rate===null?"—":`${Number(row.rate).toFixed(2)}%`}</td><td className="px-3 py-2 text-[#b9b0a4]">{row.tax_treatment||"—"}</td><td className="px-3 py-2">{row.source_system}</td><td className="px-3 py-2">{row.is_active===false?c.inactive:c.active}</td></tr>)}</tbody></table></div>
  </section>
}
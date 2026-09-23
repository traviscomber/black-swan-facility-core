"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type TemplateRow={ external_ref:string; payload:{ message_title?:string; language?:string; body?:string } | null }

const copy={
  en:{title:"Message templates",subtitle:"Guest communication templates migrated from BedBooking.",copied:"Copied",copy:"Copy",empty:"No templates available."},
  es:{title:"Plantillas de mensajes",subtitle:"Plantillas de comunicación con huéspedes migradas desde BedBooking.",copied:"Copiado",copy:"Copiar",empty:"No hay plantillas disponibles."},
  de:{title:"Nachrichtenvorlagen",subtitle:"Aus BedBooking migrierte Vorlagen für Gästekommunikation.",copied:"Kopiert",copy:"Kopieren",empty:"Keine Vorlagen verfügbar."},
} as const

export default function MessageTemplatesPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [rows,setRows]=useState<TemplateRow[]>([])
  const [copied,setCopied]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{ void (async()=>{
    const {data,error:loadError}=await supabase.from("booking_import_records").select("external_ref,payload").eq("source_system","bedbooking").eq("entity_type","message_template").order("external_ref")
    if(loadError)setError(loadError.message); else setRows((data??[]) as TemplateRow[])
  })() },[supabase])

  async function copyBody(row:TemplateRow){
    await navigator.clipboard.writeText((row.payload?.body||"").replaceAll("\\\\n","\n"))
    setCopied(row.external_ref); window.setTimeout(()=>setCopied(null),1200)
  }

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="bg-[#211e1a] px-4 py-3"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="grid gap-px bg-[#39342d] md:grid-cols-2">
      {rows.length===0?<div className="bg-[#171512] p-8 text-sm text-[#8f867b]">{c.empty}</div>:rows.map(row=><article key={row.external_ref} className="bg-[#211e1a] p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-medium">{row.payload?.message_title||row.external_ref}</h2><p className="mt-1 text-[11px] text-[#8f867b]">{row.payload?.language||"—"} · {row.external_ref}</p></div><button onClick={()=>void copyBody(row)} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><Copy className="h-3.5 w-3.5"/>{copied===row.external_ref?c.copied:c.copy}</button></div>
        <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-[#b9b0a4]">{(row.payload?.body||"").replaceAll("\\\\n","\n")}</pre>
      </article>)}
    </div>
  </section>
}
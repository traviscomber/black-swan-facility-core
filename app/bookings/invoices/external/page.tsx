"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type ExternalDoc={ id:string; source_system:string; external_ref:string; document_type:string|null; currency:string|null; net_amount:number|null; gross_amount:number|null; client_name:string|null; issue_date:string|null; payment_date:string|null; product_service:string|null; status:string|null; reconciliation_status:string|null }

const copy={
  en:{title:"Historical invoices",subtitle:"InvoiceOcean documents preserved from the BedBooking accounting module.",back:"Invoices",type:"Type",client:"Client",issued:"Issued",payment:"Payment",service:"Product / service",net:"Net",gross:"Gross",status:"Status",source:"Source ID"},
  es:{title:"Facturación histórica",subtitle:"Documentos InvoiceOcean preservados desde el módulo contable de BedBooking.",back:"Facturas",type:"Tipo",client:"Cliente",issued:"Emisión",payment:"Pago",service:"Producto / servicio",net:"Neto",gross:"Bruto",status:"Estado",source:"ID origen"},
  de:{title:"Historische Rechnungen",subtitle:"Aus dem BedBooking-Abrechnungsmodul erhaltene InvoiceOcean-Dokumente.",back:"Rechnungen",type:"Typ",client:"Kunde",issued:"Ausgestellt",payment:"Zahlung",service:"Produkt / Leistung",net:"Netto",gross:"Brutto",status:"Status",source:"Quell-ID"},
} as const

export default function ExternalInvoicesPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [rows,setRows]=useState<ExternalDoc[]>([])
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{ void (async()=>{
    const {data,error:loadError}=await supabase.from("booking_external_financial_documents")
      .select("id,source_system,external_ref,document_type,currency,net_amount,gross_amount,client_name,issue_date,payment_date,product_service,status,reconciliation_status")
      .order("issue_date",{ascending:false})
    if(loadError)setError(loadError.message); else setRows((data??[]) as ExternalDoc[])
  })() },[supabase])

  const format=(value:number|null,currency:string|null)=>value===null?"—":new Intl.NumberFormat("es-CL",{style:"currency",currency:currency||"CLP",maximumFractionDigits:2}).format(Number(value))

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-4 py-3"><div><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle} · {rows.length}</p></div><Link href={`/${language}/bookings/invoices`} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs"><ArrowLeft className="h-3.5 w-3.5"/>{c.back}</Link></header>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-xs"><thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.type}</th><th className="px-3 py-2">{c.client}</th><th className="px-3 py-2">{c.issued}</th><th className="px-3 py-2">{c.payment}</th><th className="px-3 py-2">{c.service}</th><th className="px-3 py-2">{c.net}</th><th className="px-3 py-2">{c.gross}</th><th className="px-3 py-2">{c.status}</th><th className="px-3 py-2">{c.source}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-white/[.05] hover:bg-[#211e1a]"><td className="px-3 py-2">{row.document_type||"—"}</td><td className="px-3 py-2">{row.client_name||"—"}</td><td className="px-3 py-2">{row.issue_date||"—"}</td><td className="px-3 py-2">{row.payment_date||"—"}</td><td className="px-3 py-2 text-[#b9b0a4]">{row.product_service||"—"}</td><td className="px-3 py-2">{format(row.net_amount,row.currency)}</td><td className="px-3 py-2">{format(row.gross_amount,row.currency)}</td><td className="px-3 py-2">{row.status||row.reconciliation_status||"—"}</td><td className="px-3 py-2 font-mono text-[11px] text-[#8f867b]">{row.external_ref}</td></tr>)}</tbody></table></div>
  </section>
}
"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { OccupancyHeatmap } from "./occupancy-heatmap"

type Location={ id:string; name:string }

const copy={
  en:{title:"Occupancy report",subtitle:"Monthly occupancy, blocks, availability and revenue by property."},
  es:{title:"Reporte de ocupación",subtitle:"Ocupación mensual, bloqueos, disponibilidad e ingresos por propiedad."},
  de:{title:"Belegungsbericht",subtitle:"Monatliche Belegung, Sperren, Verfügbarkeit und Umsatz pro Unterkunft."},
} as const

export default function OccupancyReportPage(){
  const {language}=useLanguage()
  const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [locations,setLocations]=useState<Location[]>([])
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{ void (async()=>{
    const {data,error:loadError}=await supabase.from("locations").select("id,name").eq("is_active",true).order("name")
    if(loadError)setError(loadError.message); else setLocations((data??[]) as Location[])
  })() },[supabase])

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="bg-[#211e1a] px-4 py-3"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="p-4"><OccupancyHeatmap locations={locations}/></div>
  </section>
}

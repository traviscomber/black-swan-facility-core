"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Download, ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type EventRow = {
  id:string
  event_code:string
  name:string
  start_date:string
  end_date:string
  location_name:string|null
  status:string
  participant_count:number
  person_days:number|string|null
  estimated_total_clp:number|string|null
  source_status:string|null
  source_event_id:string|null
}

const COPY = {
  en:{title:"Canonical event workbooks",subtitle:"Replicate a proven event baseline and export the complete eight-tab XLSX at any time.",event:"Event",dates:"Dates",people:"People",budget:"Estimated budget",status:"Status",actions:"Actions",view:"Open",export:"Export XLSX",replicate:"Replicate",refresh:"Refresh",dialogTitle:"Replicate event",dialogHelp:"Budget lines retain the current baseline quantities and prices. Copied participants are reset to pending confirmation.",name:"New event name",start:"New start date",participants:"Copy participants as pending confirmation",budgetLines:"Copy budget, staffing and current prices",create:"Create replicated event",cancel:"Cancel",source:"Baseline"},
  es:{title:"Workbooks canónicos de eventos",subtitle:"Replica un evento probado y exporta en cualquier momento el XLSX completo de 8 tabs.",event:"Evento",dates:"Fechas",people:"Personas",budget:"Presupuesto estimado",status:"Estado",actions:"Acciones",view:"Abrir",export:"Exportar XLSX",replicate:"Replicar",refresh:"Actualizar",dialogTitle:"Replicar evento",dialogHelp:"El presupuesto conserva cantidades y precios actuales como baseline. Los participantes copiados vuelven a estado pendiente de confirmación.",name:"Nombre del nuevo evento",start:"Nueva fecha de inicio",participants:"Copiar participantes como pendientes",budgetLines:"Copiar presupuesto, personal y precios actuales",create:"Crear evento replicado",cancel:"Cancelar",source:"Baseline"},
  de:{title:"Kanonische Event-Workbooks",subtitle:"Bewährte Event-Baselines replizieren und jederzeit das vollständige XLSX mit 8 Tabs exportieren.",event:"Event",dates:"Daten",people:"Personen",budget:"Budget",status:"Status",actions:"Aktionen",view:"Öffnen",export:"XLSX exportieren",replicate:"Replizieren",refresh:"Aktualisieren",dialogTitle:"Event replizieren",dialogHelp:"Budgetpositionen behalten aktuelle Baseline-Mengen und Preise. Kopierte Teilnehmende werden auf ausstehende Bestätigung gesetzt.",name:"Name des neuen Events",start:"Neues Startdatum",participants:"Teilnehmende als ausstehend kopieren",budgetLines:"Budget, Personal und aktuelle Preise kopieren",create:"Repliziertes Event erstellen",cancel:"Abbrechen",source:"Baseline"},
} as const

export function OperationalEventWorkbooks() {
  const {language}=useLanguage()
  const c=COPY[language]
  const supabase=useMemo(()=>createClient(),[])
  const money=useMemo(()=>new Intl.NumberFormat(language==="es"?"es-CL":language==="de"?"de-DE":"en-US",{style:"currency",currency:"CLP",maximumFractionDigits:0}),[language])
  const [events,setEvents]=useState<EventRow[]>([])
  const [source,setSource]=useState<EventRow|null>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({name:"",start_date:"",include_participants:true,include_budget:true})

  const load=useCallback(async()=>{
    setLoading(true)
    const {data,error}=await supabase.from("operational_events")
      .select("id,event_code,name,start_date,end_date,location_name,status,participant_count,person_days,estimated_total_clp,source_status,source_event_id")
      .order("start_date",{ascending:false})
    if(error) toast.error(error.message)
    else setEvents((data??[]) as EventRow[])
    setLoading(false)
  },[supabase])

  useEffect(()=>{void load()},[load])

  function startReplication(event:EventRow){
    setSource(event)
    setForm({
      name:event.name.replace(/\s+\(copy\)$/i,"") + " — copia",
      start_date:"",
      include_participants:true,
      include_budget:true,
    })
  }

  async function replicate(){
    if(!source||!form.name.trim()||!form.start_date) return
    setSaving(true)
    const {data,error}=await supabase.rpc("replicate_operational_event",{
      p_source_event_id:source.id,
      p_name:form.name.trim(),
      p_start_date:form.start_date,
      p_include_participants:form.include_participants,
      p_include_budget:form.include_budget,
    })
    setSaving(false)
    if(error){toast.error(error.message);return}
    const payload=data as {id?:string}|null
    toast.success(language==="es"?"Evento replicado":"Event replicated")
    setSource(null)
    await load()
    if(payload?.id) window.location.href=`/${language}/events/${payload.id}`
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-semibold">{c.title}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{c.subtitle}</p></div>
      <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?"animate-spin":""}`}/>{c.refresh}</Button>
    </div>
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted/35 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">{c.event}</th><th className="px-3 py-2">{c.dates}</th><th className="px-3 py-2">{c.people}</th><th className="px-3 py-2">{c.budget}</th><th className="px-3 py-2">{c.status}</th><th className="px-3 py-2 text-right">{c.actions}</th></tr></thead>
        <tbody>{events.map(event=><tr key={event.id} className="border-t align-top">
          <td className="px-3 py-3"><div className="font-medium">{event.name}</div><div className="mt-1 font-mono text-[11px] text-muted-foreground">{event.event_code}</div>{event.source_event_id?<div className="mt-1 text-[11px] text-muted-foreground">{c.source}: {event.source_status||"replicated"}</div>:null}</td>
          <td className="px-3 py-3">{event.start_date} → {event.end_date}<div className="text-xs text-muted-foreground">{event.location_name||"—"}</div></td>
          <td className="px-3 py-3 tabular-nums">{event.participant_count}</td>
          <td className="px-3 py-3 tabular-nums">{money.format(Number(event.estimated_total_clp??0))}</td>
          <td className="px-3 py-3">{event.status}</td>
          <td className="px-3 py-3"><div className="flex justify-end gap-1">
            <Button asChild size="sm" variant="outline"><Link href={`/${language}/events/${event.id}`}><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>{c.view}</Link></Button>
            <Button asChild size="sm" variant="outline"><a href={`/api/events/${event.id}/export`}><Download className="mr-1.5 h-3.5 w-3.5"/>{c.export}</a></Button>
            <Button size="sm" onClick={()=>startReplication(event)}><Copy className="mr-1.5 h-3.5 w-3.5"/>{c.replicate}</Button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>

    <Dialog open={Boolean(source)} onOpenChange={(open)=>{if(!open)setSource(null)}}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{c.dialogTitle}</DialogTitle><DialogDescription>{c.dialogHelp}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="font-medium">{source?.name}</div><div className="mt-1 text-xs text-muted-foreground">{source?.start_date} → {source?.end_date} · {source?.participant_count} personas</div></div>
          <label className="space-y-1.5 text-sm"><Label>{c.name}</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label className="space-y-1.5 text-sm"><Label>{c.start}</Label><Input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
          <label className="flex items-center gap-3 rounded-md border p-3 text-sm"><input type="checkbox" checked={form.include_participants} onChange={e=>setForm({...form,include_participants:e.target.checked})}/><span>{c.participants}</span></label>
          <label className="flex items-center gap-3 rounded-md border p-3 text-sm"><input type="checkbox" checked={form.include_budget} onChange={e=>setForm({...form,include_budget:e.target.checked})}/><span>{c.budgetLines}</span></label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setSource(null)}>{c.cancel}</Button><Button disabled={saving||!form.name.trim()||!form.start_date} onClick={()=>void replicate()}>{saving?"…":c.create}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  </section>
}

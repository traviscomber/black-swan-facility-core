"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Ruler } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;status:string;start_date:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;variety:string|null}
type SourceSnapshot={code?:string;beds_10m?:number|string|null;source_file?:string}|null
type Succession={
 id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string|null;planned_transplant_date:string|null;
 planned_first_harvest_date:string|null;planned_last_harvest_date:string|null;planned_bed_m:number|string|null;
 planned_plants:number|null;planned_area_sqm:number|string|null;status:string;knowledge_source_snapshot:SourceSnapshot
}

const copy={
 en:{eyebrow:"Game Plan · unresolved source",title:"Bed metres requiring a planning decision",description:"Only source values that remain genuinely unresolved belong here. Enter approved bed metres from a human planning decision; this screen never estimates or auto-fills a value.",back:"Back to Crop Map",plan:"Game plan",planting:"Planting",dates:"Field window",context:"Planning context",source:"Source evidence",sourceUnknown:"XLS bed metres unresolved",sourceCode:"Source code",bedMeters:"Approved bed metres",save:"Save",saving:"Saving…",remaining:"unresolved",readyAfter:"Ready for physical assignment after save",stillBlocked:"Dates are still incomplete after bed metres are saved",none:"No plantings require a manual bed-metre decision in this game plan.",loadError:"Could not load unresolved planning inputs.",saveError:"Could not save planned bed metres.",invalid:"Enter a value greater than zero.",changed:"This planting changed before your save. The list has been refreshed.",operator:"Human decision only",operatorHelp:"Use an approved Game Plan or explicit field-planning decision. Do not infer metres from plants, area, yield, cultivar, another crop, or another season.",sourceBacked:"Source-backed rows are not editable here; they must be recovered by canonical reconciliation."},
 es:{eyebrow:"Plan de Cultivo · fuente no resuelta",title:"Metros de cama que requieren decisión de planificación",description:"Aquí aparecen sólo valores de fuente realmente no resueltos. Ingresa metros aprobados por una decisión humana de planificación; esta pantalla nunca estima ni autocompleta un valor.",back:"Volver al Crop Map",plan:"Plan de cultivo",planting:"Plantación",dates:"Ventana de campo",context:"Contexto de planificación",source:"Evidencia fuente",sourceUnknown:"Metros de cama no resueltos en XLS",sourceCode:"Código fuente",bedMeters:"Metros de cama aprobados",save:"Guardar",saving:"Guardando…",remaining:"sin resolver",readyAfter:"Quedará lista para asignación física después de guardar",stillBlocked:"Las fechas siguen incompletas después de guardar los metros",none:"No hay plantaciones que requieran decisión manual de metros de cama en este plan.",loadError:"No fue posible cargar los datos de planificación no resueltos.",saveError:"No fue posible guardar los metros de cama.",invalid:"Ingresa un valor mayor que cero.",changed:"Esta plantación cambió antes de guardar. La lista fue actualizada.",operator:"Sólo decisión humana",operatorHelp:"Usa un Plan de Cultivo aprobado o una decisión explícita de planificación de terreno. No infieras metros desde plantas, superficie, rendimiento, cultivar, otro cultivo u otra temporada.",sourceBacked:"Las filas con fuente explícita no se editan aquí; deben recuperarse por reconciliación canónica."},
 de:{eyebrow:"Game Plan · ungelöste Quelle",title:"Beetmeter mit erforderlicher Planungsentscheidung",description:"Hier erscheinen nur tatsächlich ungelöste Quellenwerte. Genehmigte Beetmeter aus einer menschlichen Planungsentscheidung eingeben; diese Ansicht schätzt oder füllt niemals automatisch aus.",back:"Zurück zur Crop Map",plan:"Game Plan",planting:"Pflanzung",dates:"Feldfenster",context:"Planungskontext",source:"Quellnachweis",sourceUnknown:"XLS-Beetmeter ungelöst",sourceCode:"Quellcode",bedMeters:"Genehmigte Beetmeter",save:"Speichern",saving:"Speichert…",remaining:"ungelöst",readyAfter:"Nach dem Speichern bereit für die physische Zuordnung",stillBlocked:"Nach dem Speichern fehlen weiterhin Termine",none:"In diesem Game Plan benötigt keine Pflanzung eine manuelle Beetmeter-Entscheidung.",loadError:"Ungelöste Planungseingaben konnten nicht geladen werden.",saveError:"Geplante Beetmeter konnten nicht gespeichert werden.",invalid:"Einen Wert größer als null eingeben.",changed:"Diese Pflanzung wurde vor dem Speichern geändert. Die Liste wurde aktualisiert.",operator:"Nur menschliche Entscheidung",operatorHelp:"Einen genehmigten Game Plan oder eine ausdrückliche Feldplanungsentscheidung verwenden. Keine Meter aus Pflanzen, Fläche, Ertrag, Sorte, anderer Kultur oder Saison ableiten.",sourceBacked:"Zeilen mit expliziter Quelle werden hier nicht bearbeitet; sie müssen durch kanonische Abstimmung wiederhergestellt werden."}
} as const

const displayDate=(value:string|null)=>value??"—"
const numericSourceBed=(snapshot:SourceSnapshot)=>{
 const raw=snapshot?.beds_10m
 if(typeof raw==="number")return Number.isFinite(raw)&&raw>0?raw:null
 if(typeof raw==="string"&&raw.trim()!==""){const value=Number(raw);return Number.isFinite(value)&&value>0?value:null}
 return null
}

export default function OrchardBedMetersPage(){
 const supabase=useMemo(()=>createBrowserClient(),[])
 const {language}=useLanguage();const lang:Locale=language;const text=copy[lang]
 const [plans,setPlans]=useState<Plan[]>([]);const [cycles,setCycles]=useState<Cycle[]>([]);const [successions,setSuccessions]=useState<Succession[]>([])
 const [values,setValues]=useState<Record<string,string>>({});const [savingId,setSavingId]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null)

 const load=useCallback(async()=>{
  setLoading(true);setError(null)
  const [p,c,s]=await Promise.all([
   supabase.from("orchard_game_plans").select("id,name,season,status,start_date").order("start_date",{ascending:false}),
   supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety"),
   supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_bed_m,planned_plants,planned_area_sqm,status,knowledge_source_snapshot").neq("status","cancelled").order("planned_sow_date"),
  ])
  const firstError=p.error??c.error??s.error
  if(firstError){setError(`${text.loadError} ${firstError.message}`);setLoading(false);return}
  setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setLoading(false)
 },[supabase,text.loadError])
 useEffect(()=>{void load()},[load])

 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(item=>item.id===requested)??plans.find(item=>item.status==="active")??plans.find(item=>item.status==="draft")??plans[0]??null
 const planCycles=cycles.filter(cycle=>cycle.game_plan_id===plan?.id);const cycleIds=new Set(planCycles.map(cycle=>cycle.id));const cycleById=new Map(cycles.map(cycle=>[cycle.id,cycle]))
 const allMissing=successions.filter(item=>cycleIds.has(item.crop_cycle_id)&&!(Number(item.planned_bed_m)>0))
 const sourceBackedMissing=allMissing.filter(item=>numericSourceBed(item.knowledge_source_snapshot)!==null)
 const missing=allMissing.filter(item=>numericSourceBed(item.knowledge_source_snapshot)===null)
 const cropMapHref=`/${language}/orchard/crop-map/overview${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

 const save=async(item:Succession)=>{
  if(numericSourceBed(item.knowledge_source_snapshot)!==null){setError(text.sourceBacked);return}
  const value=Number(values[item.id]);if(!Number.isFinite(value)||value<=0){setError(text.invalid);return}
  setSavingId(item.id);setError(null)
  const result=await supabase.from("orchard_crop_successions").update({planned_bed_m:value}).eq("id",item.id).is("planned_bed_m",null).select("id,planned_bed_m").maybeSingle()
  setSavingId(null)
  if(result.error){setError(`${text.saveError} ${result.error.message}`);return}
  if(!result.data){setError(text.changed);await load();return}
  setValues(current=>{const next={...current};delete next[item.id];return next});await load()
 }

 return <AppLayout><OrchardNavigation/><main className="min-h-screen bg-[var(--orchard-canvas,#171512)] text-foreground">
  <header className="border-b border-[var(--orchard-line)] px-4 py-5 sm:px-6 lg:px-8"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-1 text-2xl font-medium tracking-[-.03em] sm:text-3xl">{text.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{text.description}</p></div><Link href={cropMapHref} className="inline-flex h-10 items-center gap-2 border border-[var(--orchard-line)] px-4 text-sm hover:bg-white/[.04]"><ArrowLeft className="h-4 w-4"/>{text.back}</Link></div></header>
  <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
   <div className="mb-5 grid gap-3 border border-[var(--orchard-line)] bg-white/[.025] p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{text.plan}</p><p className="mt-1 text-sm font-medium">{plan?.name??"—"}{plan?.season?` · ${plan.season}`:""}</p></div><div className="flex items-center gap-2 text-sm text-[#b9a57a]"><Ruler className="h-4 w-4"/><strong>{missing.length}</strong> {text.remaining}</div></div>
   <div className="mb-5 flex items-start gap-3 border border-[#8f7c50]/35 bg-[#8f7c50]/[.08] p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c7ae73]"/><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#c7ae73]">{text.operator}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.operatorHelp}</p>{sourceBackedMissing.length?<p className="mt-1 text-xs leading-5 text-[#b9a57a]">{sourceBackedMissing.length} · {text.sourceBacked}</p>:null}</div></div>
   {error?<div role="alert" className="mb-4 border border-red-400/25 bg-red-950/20 px-4 py-3 text-sm text-red-200">{error}</div>:null}
   {loading?<p className="py-12 text-sm text-muted-foreground">…</p>:missing.length===0?<div className="flex items-center gap-3 border border-[var(--orchard-line)] p-5 text-sm text-[var(--orchard-green)]"><CheckCircle2 className="h-5 w-5"/>{text.none}</div>:<div className="space-y-2">{missing.map(item=>{
    const cycle=cycleById.get(item.crop_cycle_id);const start=item.planned_transplant_date??item.planned_sow_date;const end=item.planned_last_harvest_date??item.planned_first_harvest_date;const datesComplete=Boolean(start&&end);const sourceCode=item.knowledge_source_snapshot?.code??"—"
    return <article key={item.id} className="grid gap-4 border border-[var(--orchard-line)] p-4 lg:grid-cols-[minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(170px,1fr)_minmax(170px,1fr)_220px] lg:items-end">
     <div><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{text.planting}</p><p className="mt-1 font-medium">{cycle?.crop_name??"Crop"} #{item.sequence_no}</p><p className="mt-1 text-xs text-muted-foreground">{cycle?.variety??"Generic"}</p></div>
     <div><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{text.dates}</p><p className="mt-1 text-sm tabular-nums">{displayDate(start)} → {displayDate(end)}</p><p className={`mt-1 text-[11px] ${datesComplete?"text-[var(--orchard-green)]":"text-[#c7ae73]"}`}>{datesComplete?text.readyAfter:text.stillBlocked}</p></div>
     <div><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{text.context}</p><p className="mt-1 text-xs text-muted-foreground">{item.planned_plants!=null?`${item.planned_plants} plants`:"—"} · {item.planned_area_sqm!=null?`${Number(item.planned_area_sqm)} m²`:"—"}</p></div>
     <div><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{text.source}</p><p className="mt-1 text-xs text-[#c7ae73]">{text.sourceUnknown}</p><p className="mt-1 text-[11px] text-muted-foreground">{text.sourceCode}: <code>{sourceCode}</code></p></div>
     <div><label className="block text-[10px] uppercase tracking-[.12em] text-muted-foreground" htmlFor={`bed-m-${item.id}`}>{text.bedMeters}</label><div className="mt-1 flex"><input id={`bed-m-${item.id}`} inputMode="decimal" type="number" min="0.1" step="0.1" value={values[item.id]??""} onChange={event=>setValues(current=>({...current,[item.id]:event.target.value}))} className="h-10 min-w-0 flex-1 border border-[var(--orchard-line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--orchard-green)]"/><button type="button" onClick={()=>void save(item)} disabled={savingId===item.id||!(values[item.id]??"").trim()} className="h-10 border border-l-0 border-[var(--orchard-line)] bg-[var(--orchard-green)] px-4 text-xs font-semibold text-[#102018] disabled:opacity-40">{savingId===item.id?text.saving:text.save}</button></div></div>
    </article>})}</div>}
  </section>
 </main></AppLayout>
}

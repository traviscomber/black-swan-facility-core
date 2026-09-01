"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarRange, CheckCircle2, ExternalLink, MapPinned, RefreshCw, Route, Sprout, WandSparkles } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Plan={id:string;name:string;season:string|null;status:string;start_date:string;end_date:string}
type Plot={id:string;name:string;status:string|null;plot_type:string}
type Bed={id:string;plot_id:string;name:string;code:string|null;area_sqm:number|null;length_m:number|null;width_m:number|null;status:string;planning_order:number|null}
type Allocation={bed_id:string;crop_succession_id:string;planned_start_date:string;planned_end_date:string;allocated_area_sqm:number|null}
type Succession={id:string;crop_cycle_id:string;sequence_no:number;planned_sow_date:string;planned_transplant_date:string|null;planned_first_harvest_date:string|null;planned_last_harvest_date:string|null;planned_area_sqm:number|null;status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string;variety:string|null}
type PlacementResult={allocation_ids?:string[];allocated_area_sqm?:number;contiguous_beds?:number;rotation_penalty?:number;available_run_area_sqm?:number}

type Locale="en"|"es"|"de"
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
const copy={
 en:{title:"Organize My Crop Map",description:"Distribute the selected Game Plan across real physical beds. Existing occupancy from every season remains authoritative.",refresh:"Refresh",gis:"Open GIS",season:"Game Plan",pending:"Pending plantings",beds:"Active beds",freeBeds:"Free for selected dates",eligible:"Eligible contiguous runs",queue:"Plantings to place",queueHelp:"This queue is scoped only to the selected Game Plan. A planting disappears after it has a bed allocation.",none:"All plantings in this Game Plan are placed.",select:"Select",selected:"Selected",fieldBlock:"Field block",fieldBlockHelp:"Choose the physical block that contains the beds. Only active physical beds can receive plantings.",noPhysicalBeds:"No active physical beds are configured in Black Swan Core yet. Sync or create the real field block before allocating crops; legacy/demo beds are intentionally excluded.",start:"Start",end:"End",area:"Required area",place:"Place in contiguous beds",placing:"Placing…",sequence:"Bed sequence",sequenceHelp:"Beds are shown in planning order. Existing allocations that overlap the selected planting dates break a contiguous run.",free:"Free",occupied:"Occupied",crop:"Crop",allocationDone:"Planting assigned",contiguousBeds:"Beds used",allocatedArea:"Allocated area",runArea:"Run area",rotationPenalty:"Rotation penalty",sourceWarning:"Core and Heirloom must be reconciled before bulk placement. This screen never invents missing beds or silently writes legacy placeholders."},
 es:{title:"Organizar mi Mapa de Cultivos",description:"Distribuye el Plan de Cultivo seleccionado sobre camas físicas reales. La ocupación existente de todas las temporadas sigue siendo la autoridad.",refresh:"Actualizar",gis:"Abrir GIS",season:"Plan de Cultivo",pending:"Plantaciones pendientes",beds:"Camas activas",freeBeds:"Libres para las fechas",eligible:"Bloques contiguos aptos",queue:"Plantaciones por ubicar",queueHelp:"La cola pertenece sólo al Plan seleccionado. Una plantación desaparece cuando ya tiene una asignación de cama.",none:"Todas las plantaciones de este Plan están ubicadas.",select:"Seleccionar",selected:"Seleccionada",fieldBlock:"Field Block",fieldBlockHelp:"Elige el bloque físico que contiene las camas. Sólo camas físicas activas pueden recibir plantaciones.",noPhysicalBeds:"Black Swan Core aún no tiene camas físicas activas configuradas. Sincroniza o crea el Field Block real antes de asignar cultivos; las camas demo/legacy quedan excluidas intencionalmente.",start:"Inicio",end:"Fin",area:"Área requerida",place:"Ubicar en camas contiguas",placing:"Ubicando…",sequence:"Secuencia de camas",sequenceHelp:"Las camas se muestran en orden de planificación. Una asignación que se superpone con las fechas seleccionadas corta el bloque contiguo.",free:"Libre",occupied:"Ocupada",crop:"Cultivo",allocationDone:"Plantación asignada",contiguousBeds:"Camas usadas",allocatedArea:"Área asignada",runArea:"Área del bloque",rotationPenalty:"Penalización rotación",sourceWarning:"Core y Heirloom deben reconciliarse antes de una ubicación masiva. Esta pantalla nunca inventa camas faltantes ni escribe placeholders legacy silenciosamente."},
 de:{title:"Anbaukarte organisieren",description:"Verteile den ausgewählten Game Plan auf reale physische Beete. Bestehende Belegung aus allen Saisons bleibt maßgeblich.",refresh:"Aktualisieren",gis:"GIS öffnen",season:"Game Plan",pending:"Offene Pflanzungen",beds:"Aktive Beete",freeBeds:"Für Zeitraum frei",eligible:"Geeignete zusammenhängende Blöcke",queue:"Zu platzierende Pflanzungen",queueHelp:"Die Liste ist nur auf den ausgewählten Game Plan beschränkt. Nach einer Beetzuordnung verschwindet die Pflanzung aus der Liste.",none:"Alle Pflanzungen dieses Game Plans sind zugeordnet.",select:"Auswählen",selected:"Ausgewählt",fieldBlock:"Feldblock",fieldBlockHelp:"Wähle den physischen Block mit den Beeten. Nur aktive reale Beete können Pflanzungen aufnehmen.",noPhysicalBeds:"In Black Swan Core sind noch keine aktiven physischen Beete eingerichtet. Synchronisiere oder erstelle zuerst den realen Feldblock; Demo-/Legacy-Beete bleiben bewusst ausgeschlossen.",start:"Start",end:"Ende",area:"Benötigte Fläche",place:"In zusammenhängende Beete platzieren",placing:"Wird platziert…",sequence:"Beetfolge",sequenceHelp:"Beete erscheinen in Planungsreihenfolge. Überlappende Zuordnungen unterbrechen einen zusammenhängenden Block.",free:"Frei",occupied:"Belegt",crop:"Kultur",allocationDone:"Pflanzung zugeordnet",contiguousBeds:"Verwendete Beete",allocatedArea:"Zugeordnete Fläche",runArea:"Blockfläche",rotationPenalty:"Fruchtfolge-Strafe",sourceWarning:"Core und Heirloom müssen vor einer Massenplatzierung abgeglichen werden. Diese Ansicht erfindet keine fehlenden Beete und schreibt keine Legacy-Platzhalter stillschweigend."}
} as const

export default function OrchardAutoPlacePage(){
 const supabase=useMemo(()=>createBrowserClient(),[])
 const {language}=useLanguage(); const lang=language as Locale; const text=copy[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[plots,setPlots]=useState<Plot[]>([]),[beds,setBeds]=useState<Bed[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[cycles,setCycles]=useState<Cycle[]>([])
 const [selectedPlanId,setSelectedPlanId]=useState("")
 const [form,setForm]=useState({succession_id:"",plot_id:"",start_date:today(),end_date:today(),area:""})
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),[result,setResult]=useState<PlacementResult|null>(null)

 const load=useCallback(async()=>{
  setLoading(true);setError(null)
  const [p,pl,b,a,s,c]=await Promise.all([
   supabase.from("orchard_game_plans").select("id,name,season,status,start_date,end_date").order("start_date",{ascending:false}),
   supabase.from("orchard_plots").select("id,name,status,plot_type").order("name"),
   supabase.from("orchard_beds").select("id,plot_id,name,code,area_sqm,length_m,width_m,status,planning_order").eq("status","active").order("planning_order"),
   supabase.from("orchard_bed_allocations").select("bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm"),
   supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_area_sqm,status").neq("status","cancelled").order("planned_sow_date"),
   supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety")
  ])
  const firstError=p.error??pl.error??b.error??a.error??s.error??c.error
  if(firstError){setError(firstError.message);setLoading(false);return}
  const nextPlans=(p.data??[]) as Plan[]; const nextPlots=(pl.data??[]) as Plot[]; const nextBeds=(b.data??[]) as Bed[]
  setPlans(nextPlans);setPlots(nextPlots);setBeds(nextBeds);setAllocations((a.data??[]) as Allocation[]);setSuccessions((s.data??[]) as Succession[]);setCycles((c.data??[]) as Cycle[])
  setSelectedPlanId(current=>current||nextPlans.find(item=>item.status==="active")?.id||nextPlans.find(item=>item.status==="draft")?.id||nextPlans[0]?.id||"")
  setForm(current=>{if(current.plot_id&&nextBeds.some(bed=>bed.plot_id===current.plot_id))return current;const firstPlotId=nextBeds[0]?.plot_id??"";return{...current,plot_id:firstPlotId}})
  setLoading(false)
 },[supabase])
 useEffect(()=>{void load()},[load])

 const cycleById=useMemo(()=>new Map(cycles.map(c=>[c.id,c])),[cycles])
 const allocatedIds=useMemo(()=>new Set(allocations.map(a=>a.crop_succession_id)),[allocations])
 const scopedSuccessions=useMemo(()=>successions.filter(s=>cycleById.get(s.crop_cycle_id)?.game_plan_id===selectedPlanId),[successions,cycleById,selectedPlanId])
 const queue=useMemo(()=>scopedSuccessions.filter(s=>!allocatedIds.has(s.id)),[scopedSuccessions,allocatedIds])
 const physicalPlots=useMemo(()=>plots.filter(plot=>beds.some(bed=>bed.plot_id===plot.id)),[plots,beds])
 const selected=successions.find(s=>s.id===form.succession_id)
 const selectedCycle=selected?cycleById.get(selected.crop_cycle_id):null
 const plotBeds=useMemo(()=>beds.filter(b=>b.plot_id===form.plot_id).sort((a,b)=>(a.planning_order??9999)-(b.planning_order??9999)||a.name.localeCompare(b.name)),[beds,form.plot_id])
 const area=(b:Bed)=>Number(b.area_sqm??((b.length_m??0)*(b.width_m??0)))
 const isFree=(b:Bed)=>!allocations.some(a=>a.bed_id===b.id&&a.planned_start_date<=form.end_date&&a.planned_end_date>=form.start_date)
 const freeBeds=plotBeds.filter(isFree)
 const required=Number(form.area||selected?.planned_area_sqm||0)
 const runs=useMemo(()=>{const out:{beds:Bed[];area:number}[]=[];let current:{beds:Bed[];area:number}|null=null;for(const bed of plotBeds){if(!isFree(bed)){current=null;continue}if(!current){current={beds:[],area:0};out.push(current)}current.beds.push(bed);current.area+=area(bed)}return out},[plotBeds,allocations,form.start_date,form.end_date])
 const eligibleRuns=runs.filter(run=>run.area>=required&&required>0)

 useEffect(()=>{if(form.succession_id&&!queue.some(item=>item.id===form.succession_id))setForm(current=>({...current,succession_id:"",area:""}))},[queue,form.succession_id])
 function label(s:Succession){const c=cycleById.get(s.crop_cycle_id);return `${c?.crop_name??text.crop}${c?.variety?` · ${c.variety}`:""} · #${s.sequence_no}`}
 function pickSuccession(id:string){const s=successions.find(item=>item.id===id);if(!s)return;setResult(null);setForm(current=>({...current,succession_id:id,start_date:s.planned_transplant_date??s.planned_sow_date,end_date:s.planned_last_harvest_date??s.planned_first_harvest_date??s.planned_transplant_date??s.planned_sow_date,area:s.planned_area_sqm?String(s.planned_area_sqm):""}))}
 async function autoPlace(){if(!form.succession_id||!form.plot_id||!form.start_date||!form.end_date||required<=0||eligibleRuns.length===0)return;setSaving(true);setError(null);setResult(null);const response=await supabase.rpc("orchard_auto_place_succession",{p_succession_id:form.succession_id,p_plot_id:form.plot_id,p_start_date:form.start_date,p_end_date:form.end_date,p_required_area_sqm:required});if(response.error)setError(response.error.message);else{setResult((response.data??{}) as PlacementResult);await load()}setSaving(false)}

 return <AppLayout><PageHeader title={text.title} description={text.description} actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href={`/${language}/map`}><MapPinned className="mr-2 h-4 w-4"/>{text.gis}<ExternalLink className="ml-2 h-3 w-3"/></Link></Button><Button variant="outline" onClick={()=>void load()} aria-label={text.refresh}><RefreshCw className="h-4 w-4"/></Button></div>}/><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] space-y-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
  {error?<Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>:null}
  <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="rounded-xl border border-[var(--orchard-line)] bg-white p-5"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">06 · Crop Map</p><h1 className="mt-2 text-3xl font-medium tracking-[-.035em]">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{text.sourceWarning}</p></div><div className="rounded-xl border border-[var(--orchard-line)] bg-white p-4"><Label>{text.season}</Label><Select value={selectedPlanId} onValueChange={value=>{setSelectedPlanId(value);setResult(null)}}><SelectTrigger className="mt-2"><SelectValue/></SelectTrigger><SelectContent>{plans.map(plan=><SelectItem key={plan.id} value={plan.id}>{plan.season??plan.name} · {plan.status}</SelectItem>)}</SelectContent></Select></div></section>

  <section className="grid overflow-hidden rounded-xl border border-[var(--orchard-line)] bg-white sm:grid-cols-2 xl:grid-cols-4">{[
   {label:text.pending,value:queue.length,icon:Sprout},
   {label:text.beds,value:beds.length,icon:Route},
   {label:text.freeBeds,value:freeBeds.length,icon:CheckCircle2},
   {label:text.eligible,value:eligibleRuns.length,icon:CalendarRange}
  ].map((metric,index)=>{const Icon=metric.icon;return <div key={metric.label} className={`p-5 ${index?"border-t border-[var(--orchard-line)] sm:border-l sm:border-t-0":""}`}><Icon className="h-4 w-4 text-[var(--orchard-green)]"/><p className="mt-5 text-3xl font-medium tabular-nums">{loading?"—":metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.label}</p></div>})}</section>

  {beds.length===0?<Card className="border-amber-500/35 bg-amber-50/50"><CardContent className="flex gap-3 p-5 text-sm leading-6"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><p>{text.noPhysicalBeds}</p></CardContent></Card>:null}
  {result?<Card className="border-emerald-500/35"><CardContent className="grid gap-3 p-4 sm:grid-cols-4"><MetricInline label={text.contiguousBeds} value={String(result.contiguous_beds??0)}/><MetricInline label={text.allocatedArea} value={`${Number(result.allocated_area_sqm??0).toFixed(1)} m²`}/><MetricInline label={text.runArea} value={`${Number(result.available_run_area_sqm??0).toFixed(1)} m²`}/><MetricInline label={text.rotationPenalty} value={String(result.rotation_penalty??0)}/></CardContent></Card>:null}

  <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
   <Card><CardHeader><CardTitle>{text.queue}</CardTitle><CardDescription>{text.queueHelp}</CardDescription></CardHeader><CardContent>{queue.length===0?<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{text.none}</div>:<div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">{queue.map(s=>{const active=form.succession_id===s.id;const cycle=cycleById.get(s.crop_cycle_id);const start=s.planned_transplant_date??s.planned_sow_date;const end=s.planned_last_harvest_date??s.planned_first_harvest_date??start;return <button type="button" key={s.id} onClick={()=>pickSuccession(s.id)} className={`w-full rounded-lg border p-3 text-left transition ${active?"border-[var(--orchard-green)] bg-[var(--orchard-green-soft)]":"border-[var(--orchard-line)] bg-white hover:bg-[#f8faf8]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{cycle?.crop_name??text.crop}{cycle?.variety?` · ${cycle.variety}`:""}</p><p className="mt-1 text-xs text-muted-foreground">#{s.sequence_no} · {start} → {end}</p></div><Badge variant={active?"default":"secondary"}>{active?text.selected:text.select}</Badge></div>{s.planned_area_sqm!=null?<p className="mt-2 text-xs tabular-nums text-muted-foreground">{s.planned_area_sqm} m²</p>:null}</button>})}</div>}</CardContent></Card>

   <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Route className="h-5 w-5"/>{text.fieldBlock}</CardTitle><CardDescription>{text.fieldBlockHelp}</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label={text.fieldBlock}><Select value={form.plot_id} onValueChange={value=>{setResult(null);setForm(current=>({...current,plot_id:value}))}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{physicalPlots.map(plot=><SelectItem key={plot.id} value={plot.id}>{plot.name}</SelectItem>)}</SelectContent></Select></Field><Field label={text.area}><Input type="number" min="0.1" step="0.1" value={form.area} onChange={event=>setForm(current=>({...current,area:event.target.value}))}/></Field><Field label={text.start}><Input type="date" value={form.start_date} onChange={event=>setForm(current=>({...current,start_date:event.target.value}))}/></Field><Field label={text.end}><Input type="date" value={form.end_date} onChange={event=>setForm(current=>({...current,end_date:event.target.value}))}/></Field><div className="sm:col-span-2"><Button className="w-full sm:w-auto" onClick={()=>void autoPlace()} disabled={saving||!form.succession_id||!form.plot_id||required<=0||eligibleRuns.length===0}><WandSparkles className="mr-2 h-4 w-4"/>{saving?text.placing:text.place}</Button>{selectedCycle?<span className="ml-3 text-sm text-muted-foreground">{label(selected as Succession)}</span>:null}</div></CardContent></Card>

    <Card><CardHeader><CardTitle>{text.sequence}</CardTitle><CardDescription>{text.sequenceHelp}</CardDescription></CardHeader><CardContent>{!form.plot_id?<p className="text-sm text-muted-foreground">{text.noPhysicalBeds}</p>:<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{plotBeds.map(bed=>{const free=isFree(bed);return <div key={bed.id} className={`rounded-lg border p-3 ${free?"border-[var(--orchard-line)] bg-white":"border-amber-300 bg-amber-50/60"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">#{bed.planning_order??"—"} · {bed.code?`${bed.code} · `:""}{bed.name}</p><p className="mt-1 text-xs text-muted-foreground">{bed.length_m!=null?`${bed.length_m} m · `:""}{area(bed).toFixed(1)} m²</p></div><Badge variant={free?"outline":"secondary"}>{free?text.free:text.occupied}</Badge></div></div>})}</div>}</CardContent></Card></div>
  </section>
 </main></AppLayout>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
function MetricInline({label,value}:{label:string;value:string}){return <div><p className="text-lg font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>}

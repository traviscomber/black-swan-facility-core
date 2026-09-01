"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ExternalLink, MapPinned, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Plan = { id:string; name:string; season:string|null; status:string; start_date:string; end_date:string }
type Plot = { id:string; name:string; status:string|null; plot_type:string }
type Bed = { id:string; plot_id:string; name:string; length_m:number|null; width_m:number|null; status:string; planning_order:number|null }
type Allocation = { id:string; bed_id:string; crop_succession_id:string; planned_start_date:string; planned_end_date:string; allocated_length_m:number }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number; planned_sow_date:string; planned_transplant_date:string|null; planned_first_harvest_date:string|null; planned_last_harvest_date:string|null; planned_bed_m:number|null; status:string }
type Cycle = { id:string; game_plan_id:string; crop_name:string; variety:string|null }
type PlacementResult = { allocation_ids?:string[]; allocated_bed_m?:number; beds_used?:number; start_bed_id?:string }

const copy = {
  en: { title:"Organize My Crop Map", description:"Assign the selected Game Plan to real beds using bed-meter capacity, matching the Heirloom workflow without hiding Core conflicts.", refresh:"Refresh", gis:"Open GIS", plan:"Game Plan", assigned:"assigned plantings", pending:"Pending", totalDemand:"Validated demand", blockCapacity:"Field capacity", queue:"Plantings to assign", queueHelp:"Only the 32 plantings reconciled against Heirloom and the canonical Crop Plan are shown here.", fieldBlock:"Field block", startBed:"Starting bed", required:"Required", dateRange:"Date range", choosePlanting:"Choose a planting", chooseBed:"Choose the first bed. Large plantings continue into following beds transactionally.", available:"available", used:"used", place:"Assign planting", placing:"Assigning…", placed:"Planting assigned", bedsUsed:"beds used", noQueue:"All reconciled plantings are assigned.", insufficient:"Not enough contiguous bed-meter capacity from this starting bed.", crop:"Crop", source:"Core dates remain canonical. Bed-meter demand is the validated Heirloom/Crop Plan reconciliation. The only imported placement is the observed Arugula generation 1 on bed 17." },
  es: { title:"Organizar mi Mapa de Cultivos", description:"Asigna el Plan seleccionado a camas reales usando capacidad en metros de cama, replicando el flujo de Heirloom sin ocultar conflictos de Core.", refresh:"Actualizar", gis:"Abrir GIS", plan:"Plan de Cultivo", assigned:"plantaciones asignadas", pending:"Pendientes", totalDemand:"Demanda validada", blockCapacity:"Capacidad del bloque", queue:"Plantaciones por asignar", queueHelp:"Aquí aparecen sólo las 32 plantaciones reconciliadas contra Heirloom y el Crop Plan canónico.", fieldBlock:"Field Block", startBed:"Cama inicial", required:"Requerido", dateRange:"Rango de fechas", choosePlanting:"Elige una plantación", chooseBed:"Elige la primera cama. Las plantaciones grandes continúan por las camas siguientes dentro de una sola transacción.", available:"disponible", used:"usado", place:"Asignar plantación", placing:"Asignando…", placed:"Plantación asignada", bedsUsed:"camas usadas", noQueue:"Todas las plantaciones reconciliadas están asignadas.", insufficient:"No existe capacidad contigua suficiente desde esta cama.", crop:"Cultivo", source:"Las fechas de Core siguen siendo canónicas. Los metros de cama provienen de la reconciliación validada Heirloom/Crop Plan. La única ubicación importada es Arugula generación 1 en cama 17, observada directamente." },
  de: { title:"Anbaukarte organisieren", description:"Ordne den ausgewählten Game Plan realen Beeten anhand der Beetmeter-Kapazität zu und bilde den Heirloom-Ablauf ohne versteckte Core-Konflikte nach.", refresh:"Aktualisieren", gis:"GIS öffnen", plan:"Game Plan", assigned:"zugeordnete Pflanzungen", pending:"Offen", totalDemand:"Validierter Bedarf", blockCapacity:"Blockkapazität", queue:"Pflanzungen zuordnen", queueHelp:"Hier erscheinen nur die 32 mit Heirloom und dem kanonischen Crop Plan abgeglichenen Pflanzungen.", fieldBlock:"Feldblock", startBed:"Startbeet", required:"Benötigt", dateRange:"Zeitraum", choosePlanting:"Pflanzung auswählen", chooseBed:"Wähle das erste Beet. Große Pflanzungen werden transaktional auf die folgenden Beete verteilt.", available:"verfügbar", used:"belegt", place:"Pflanzung zuordnen", placing:"Zuordnung…", placed:"Pflanzung zugeordnet", bedsUsed:"Beete verwendet", noQueue:"Alle abgeglichenen Pflanzungen sind zugeordnet.", insufficient:"Ab diesem Startbeet gibt es nicht genügend zusammenhängende Beetmeter-Kapazität.", crop:"Kultur", source:"Core-Daten bleiben kanonisch. Der Beetmeter-Bedarf stammt aus dem validierten Heirloom/Crop-Plan-Abgleich. Die einzige importierte Platzierung ist die direkt beobachtete Arugula-Generation 1 auf Beet 17." },
} as const

function dateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function addDay(value:string){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+1);return dateKey(d)}

export default function OrchardAutoPlacePage(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const {language}=useLanguage(); const lang=language as Locale; const text=copy[lang]
  const [plans,setPlans]=useState<Plan[]>([]),[plots,setPlots]=useState<Plot[]>([]),[beds,setBeds]=useState<Bed[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[cycles,setCycles]=useState<Cycle[]>([])
  const [selectedPlanId,setSelectedPlanId]=useState(""),[plotId,setPlotId]=useState(""),[successionId,setSuccessionId]=useState(""),[startBedId,setStartBedId]=useState("")
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),[result,setResult]=useState<PlacementResult|null>(null)

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    const [p,pl,b,a,s,c]=await Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,status,start_date,end_date").order("start_date",{ascending:false}),
      supabase.from("orchard_plots").select("id,name,status,plot_type").eq("status","active").order("name"),
      supabase.from("orchard_beds").select("id,plot_id,name,length_m,width_m,status,planning_order").eq("status","active").order("planning_order"),
      supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_length_m").order("planned_start_date"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_bed_m,status").not("planned_bed_m","is",null).neq("status","cancelled").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety")
    ])
    const e=p.error??pl.error??b.error??a.error??s.error??c.error
    if(e){setError(e.message);setLoading(false);return}
    const nextPlans=(p.data??[]) as Plan[], nextPlots=(pl.data??[]) as Plot[], nextBeds=(b.data??[]) as Bed[]
    setPlans(nextPlans);setPlots(nextPlots);setBeds(nextBeds);setAllocations((a.data??[]) as Allocation[]);setSuccessions((s.data??[]) as Succession[]);setCycles((c.data??[]) as Cycle[])
    setSelectedPlanId(current=>current||nextPlans.find(x=>x.season==="2026/27")?.id||nextPlans.find(x=>x.status==="active")?.id||nextPlans[0]?.id||"")
    setPlotId(current=>current||nextPlots.find(x=>x.name==="Orchard BlackSwan Campo")?.id||nextBeds[0]?.plot_id||"")
    setLoading(false)
  },[supabase])
  useEffect(()=>{void load()},[load])

  const cycleById=useMemo(()=>new Map(cycles.map(c=>[c.id,c])),[cycles])
  const allocatedIds=useMemo(()=>new Set(allocations.map(a=>a.crop_succession_id)),[allocations])
  const scoped=useMemo(()=>successions.filter(s=>cycleById.get(s.crop_cycle_id)?.game_plan_id===selectedPlanId&&Number(s.planned_bed_m)>0),[successions,cycleById,selectedPlanId])
  const queue=useMemo(()=>scoped.filter(s=>!allocatedIds.has(s.id)),[scoped,allocatedIds])
  const assigned=scoped.length-queue.length
  const totalDemand=scoped.reduce((sum,s)=>sum+Number(s.planned_bed_m??0),0)
  const plotBeds=useMemo(()=>beds.filter(b=>b.plot_id===plotId).sort((a,b)=>(a.planning_order??9999)-(b.planning_order??9999)||Number(a.name)-Number(b.name)),[beds,plotId])
  const blockCapacity=plotBeds.reduce((sum,b)=>sum+Number(b.length_m??0),0)
  const selected=queue.find(s=>s.id===successionId)??null
  const cycle=selected?cycleById.get(selected.crop_cycle_id):null
  const start=selected?(selected.planned_transplant_date??selected.planned_sow_date):""
  const end=selected?(selected.planned_last_harvest_date??selected.planned_first_harvest_date??selected.planned_transplant_date??selected.planned_sow_date):""
  const required=Number(selected?.planned_bed_m??0)

  function peakUsed(bedId:string){
    if(!start||!end)return 0
    let cursor=start,peak=0
    while(cursor<=end){const used=allocations.filter(a=>a.bed_id===bedId&&a.planned_start_date<=cursor&&a.planned_end_date>=cursor).reduce((sum,a)=>sum+Number(a.allocated_length_m??0),0);peak=Math.max(peak,used);cursor=addDay(cursor)}
    return peak
  }
  const availability=plotBeds.map(b=>({bed:b,used:peakUsed(b.id),free:Math.max(Number(b.length_m??0)-peakUsed(b.id),0)}))
  const selectedIndex=availability.findIndex(x=>x.bed.id===startBedId)
  let contiguousAvailable=0
  if(selectedIndex>=0){for(let i=selectedIndex;i<availability.length;i++){if(availability[i].free<=0)break;contiguousAvailable+=availability[i].free}}
  const canPlace=Boolean(selected&&startBedId&&required>0&&contiguousAvailable+0.0001>=required&&!saving)

  function plantingLabel(s:Succession){const c=cycleById.get(s.crop_cycle_id);return `${c?.crop_name??text.crop}${c?.variety?` · ${c.variety}`:""} · ${s.sequence_no}`}
  function choosePlanting(id:string){setSuccessionId(id);setStartBedId("");setResult(null);setError(null)}
  async function place(){if(!selected||!canPlace)return;setSaving(true);setError(null);setResult(null);const response=await supabase.rpc("orchard_place_succession_bed_meters",{p_succession_id:selected.id,p_plot_id:plotId,p_start_bed_id:startBedId,p_start_date:start,p_end_date:end,p_required_bed_m:required});if(response.error)setError(response.error.message);else{setResult((response.data??{}) as PlacementResult);setSuccessionId("");setStartBedId("");await load()}setSaving(false)}

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href={`/${language}/map`}><MapPinned className="mr-2 h-4 w-4"/>{text.gis}<ExternalLink className="ml-2 h-3 w-3"/></Link></Button><Button variant="outline" onClick={()=>void load()} disabled={loading} aria-label={text.refresh}><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></Button></div>}/>
    <OrchardNavigation/>
    <main className="mx-auto w-full max-w-[1560px] space-y-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      {error?<Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>:null}
      <Card><CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">Crop Map · Heirloom parity</p><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{text.source}</p></div><div><Label>{text.plan}</Label><Select value={selectedPlanId} onValueChange={value=>{setSelectedPlanId(value);setSuccessionId("");setStartBedId("")}}><SelectTrigger className="mt-2"><SelectValue/></SelectTrigger><SelectContent>{plans.map(p=><SelectItem key={p.id} value={p.id}>{p.season??p.name} · {p.status}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>

      <section className="grid overflow-hidden rounded-xl border border-[var(--orchard-line)] bg-white sm:grid-cols-2 xl:grid-cols-4">
        <Metric value={`${assigned}/${scoped.length}`} label={text.assigned}/><Metric value={String(queue.length)} label={text.pending}/><Metric value={`${totalDemand} m`} label={text.totalDemand}/><Metric value={`${blockCapacity} m`} label={text.blockCapacity}/>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>{text.queue}</CardTitle><CardDescription>{text.queueHelp}</CardDescription></CardHeader><CardContent>{queue.length===0?<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-3 h-5 w-5"/>{text.noQueue}</div>:<div className="grid gap-3 md:grid-cols-2">{queue.map(s=>{const active=s.id===successionId;const c=cycleById.get(s.crop_cycle_id);const sStart=s.planned_transplant_date??s.planned_sow_date;const sEnd=s.planned_last_harvest_date??s.planned_first_harvest_date??sStart;return <button key={s.id} type="button" onClick={()=>choosePlanting(s.id)} className={`rounded-xl border p-4 text-left transition ${active?"border-[var(--orchard-green)] bg-[var(--orchard-green-soft)]":"border-[var(--orchard-line)] bg-white hover:border-[#b8cabe]"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{c?.crop_name??text.crop}</p><p className="mt-1 text-xs text-muted-foreground">Generation {s.sequence_no}{c?.variety?` · ${c.variety}`:""}</p></div><Badge variant={active?"default":"secondary"}>{Number(s.planned_bed_m)} m</Badge></div><p className="mt-4 text-xs text-muted-foreground">{sStart} → {sEnd}</p></button>})}</div>}</CardContent></Card>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Card><CardHeader><CardTitle>{text.fieldBlock}</CardTitle><CardDescription>{plots.find(p=>p.id===plotId)?.name??"—"}</CardDescription></CardHeader><CardContent className="space-y-4"><Select value={plotId} onValueChange={value=>{setPlotId(value);setStartBedId("")}}><SelectTrigger aria-label={text.fieldBlock}><SelectValue/></SelectTrigger><SelectContent>{plots.filter(p=>beds.some(b=>b.plot_id===p.id)).map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>{selected?<div className="rounded-xl bg-[#f6f8f5] p-4"><p className="font-medium">{plantingLabel(selected)}</p><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><span className="text-muted-foreground">{text.required}</span><p className="mt-1 text-base font-medium">{required} m</p></div><div><span className="text-muted-foreground">{text.dateRange}</span><p className="mt-1">{start}<br/>{end}</p></div></div></div>:<p className="text-sm text-muted-foreground">{text.choosePlanting}</p>}</CardContent></Card>

          <Card><CardHeader><CardTitle>{text.startBed}</CardTitle><CardDescription>{text.chooseBed}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-3 gap-2">{availability.map(({bed,used,free})=>{const active=bed.id===startBedId;return <button key={bed.id} type="button" disabled={!selected||free<=0} onClick={()=>setStartBedId(bed.id)} className={`rounded-lg border p-3 text-left ${active?"border-[var(--orchard-green)] bg-[var(--orchard-green-soft)]":"border-[var(--orchard-line)] disabled:opacity-45"}`}><p className="font-medium">{bed.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{used.toFixed(0)} m {text.used}</p><p className="text-[11px] text-[var(--orchard-green)]">{free.toFixed(0)} m {text.available}</p></button>})}</div>{selected&&startBedId&&contiguousAvailable+0.0001<required?<p className="flex gap-2 text-xs text-amber-700"><AlertTriangle className="h-4 w-4 shrink-0"/>{text.insufficient} ({contiguousAvailable.toFixed(0)} m)</p>:null}<Button className="w-full" disabled={!canPlace} onClick={()=>void place()}><Sprout className="mr-2 h-4 w-4"/>{saving?text.placing:text.place}</Button></CardContent></Card>

          {result?<Card className="border-[var(--orchard-green)]"><CardContent className="p-4"><p className="flex items-center gap-2 font-medium text-[var(--orchard-green)]"><CheckCircle2 className="h-4 w-4"/>{text.placed}</p><p className="mt-2 text-sm text-muted-foreground">{result.allocated_bed_m} m · {result.beds_used} {text.bedsUsed}</p></CardContent></Card>:null}
        </div>
      </section>
    </main>
  </AppLayout>
}

function Metric({value,label}:{value:string;label:string}){return <div className="p-5"><p className="text-2xl font-medium tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>}

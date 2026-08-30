"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Database, ExternalLink, Leaf, Plus, RefreshCw, ShieldCheck, Sprout, WandSparkles } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type CropProfile = { id:string; crop_name:string; scientific_name:string|null; crop_family:string|null; category:string|null; default_cycle_type:string|null; days_to_maturity:number|null; nursery_days:number|null; plant_spacing_cm:number|null; row_spacing_cm:number|null; germination_rate_pct:number|null; seeds_per_plant:number|null; target_yield_per_sqm:number|null; yield_unit:string|null; min_temp_c:number|null; max_temp_c:number|null; sun_hours:number|null; water_notes:string|null; soil_notes:string|null; rotation_notes:string|null; source_name:string|null; source_url:string|null; source_verified_at:string|null; provenance_type:"manual"|"observed"|"reference"; observed_count:number; last_observed_at:string|null; is_active:boolean }
type Cultivar = { id:string; crop_library_id:string; variety:string; days_to_maturity:number|null; nursery_days:number|null; plant_spacing_cm:number|null; row_spacing_cm:number|null; germination_rate_pct:number|null; seeds_per_plant:number|null; target_yield_per_sqm:number|null; notes:string|null; source_name:string|null; source_url:string|null; source_verified_at:string|null; provenance_type:"manual"|"observed"|"reference"; observed_count:number; last_observed_at:string|null; is_active:boolean }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number; days_to_maturity:number|null; plant_spacing_cm:number|null; row_spacing_cm:number|null; germination_rate_pct:number|null; seeds_per_plant:number|null; crop_library_id:string|null; cultivar_library_id:string|null; knowledge_applied_at:string|null }
type Cycle = { id:string; crop_name:string; variety:string|null }

const emptyCrop = { crop_name:"", scientific_name:"", crop_family:"", category:"", default_cycle_type:"transplant", days_to_maturity:"", nursery_days:"", plant_spacing_cm:"", row_spacing_cm:"", germination_rate_pct:"", seeds_per_plant:"", target_yield_per_sqm:"", yield_unit:"kg", min_temp_c:"", max_temp_c:"", sun_hours:"", water_notes:"", soil_notes:"", rotation_notes:"", source_name:"", source_url:"" }
const emptyCultivar = { crop_library_id:"", variety:"", days_to_maturity:"", nursery_days:"", plant_spacing_cm:"", row_spacing_cm:"", germination_rate_pct:"", seeds_per_plant:"", target_yield_per_sqm:"", notes:"", source_name:"", source_url:"" }
const n = (value:string) => value === "" ? null : Number(value)

const CROP_FALLBACK_PHOTO = "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=92"
const NAMED_CROP_PHOTOS: Record<string,string> = {
  tomato: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=1400&q=92",
  tomate: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=1400&q=92",
  lettuce: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=1400&q=92",
  lechuga: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=1400&q=92",
  radish: "https://images.unsplash.com/photo-1589753014594-0676c69bbcbe?auto=format&fit=crop&w=1400&q=92",
  rabano: "https://images.unsplash.com/photo-1589753014594-0676c69bbcbe?auto=format&fit=crop&w=1400&q=92",
  rabanito: "https://images.unsplash.com/photo-1589753014594-0676c69bbcbe?auto=format&fit=crop&w=1400&q=92",
  arugula: "https://plus.unsplash.com/premium_photo-1776974164156-5fe46613bdaa?auto=format&fit=crop&w=1400&q=92",
  rucula: "https://plus.unsplash.com/premium_photo-1776974164156-5fe46613bdaa?auto=format&fit=crop&w=1400&q=92",
  onion: "https://images.unsplash.com/photo-1741517480900-8bee5b4f48df?auto=format&fit=crop&w=1400&q=92",
  cebolla: "https://images.unsplash.com/photo-1741517480900-8bee5b4f48df?auto=format&fit=crop&w=1400&q=92",
  carrot: "https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=1400&q=92",
  zanahoria: "https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=1400&q=92",
  basil: "https://images.unsplash.com/photo-1744044021853-ee40e35c9177?auto=format&fit=crop&w=1400&q=92",
  albahaca: "https://images.unsplash.com/photo-1744044021853-ee40e35c9177?auto=format&fit=crop&w=1400&q=92",
  parsley: "https://images.unsplash.com/photo-1633640737481-2e9aabd87033?auto=format&fit=crop&w=1400&q=92",
  perejil: "https://images.unsplash.com/photo-1633640737481-2e9aabd87033?auto=format&fit=crop&w=1400&q=92",
  spinach: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=1400&q=92",
  espinaca: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=1400&q=92",
  potato: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1400&q=92",
  papa: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1400&q=92",
  beet: "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?auto=format&fit=crop&w=1400&q=92",
  beetroot: "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?auto=format&fit=crop&w=1400&q=92",
  betarraga: "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?auto=format&fit=crop&w=1400&q=92",
  pepper: "https://cdn.mos.cms.futurecdn.net/drByGsZtfKirRfapJQ2B2C.jpg",
  pimenton: "https://cdn.mos.cms.futurecdn.net/drByGsZtfKirRfapJQ2B2C.jpg",
  zucchini: "https://images.unsplash.com/photo-1563252722-6434563a985d?auto=format&fit=crop&w=1400&q=92",
  zapallo: "https://images.unsplash.com/photo-1563252722-6434563a985d?auto=format&fit=crop&w=1400&q=92",
}

function cropPhoto(name:string){
  const key=name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  return Object.entries(NAMED_CROP_PHOTOS).find(([crop])=>key.includes(crop))?.[1] ?? CROP_FALLBACK_PHOTO
}

export default function OrchardLibraryPage(){
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const es = language === "es"
  const [crops,setCrops]=useState<CropProfile[]>([]); const [cultivars,setCultivars]=useState<Cultivar[]>([])
  const [successions,setSuccessions]=useState<Succession[]>([]); const [cycles,setCycles]=useState<Cycle[]>([])
  const [cropForm,setCropForm]=useState(emptyCrop); const [cultivarForm,setCultivarForm]=useState(emptyCultivar)
  const [selectedSuccession,setSelectedSuccession]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null); const [notice,setNotice]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const [a,b,s,c]=await Promise.all([
      supabase.from("orchard_crop_library").select("*").order("crop_name"),
      supabase.from("orchard_cultivar_library").select("*").order("variety"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,days_to_maturity,plant_spacing_cm,row_spacing_cm,germination_rate_pct,seeds_per_plant,crop_library_id,cultivar_library_id,knowledge_applied_at").neq("status","cancelled").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id,crop_name,variety")
    ])
    const e=a.error??b.error??s.error??c.error
    if(e)setError(e.message); else {setCrops((a.data??[]) as CropProfile[]);setCultivars((b.data??[]) as Cultivar[]);setSuccessions((s.data??[]) as Succession[]);setCycles((c.data??[]) as Cycle[])}
  },[supabase])
  useEffect(()=>{void load()},[load])

  const cycleById=useMemo(()=>new Map(cycles.map(c=>[c.id,c])),[cycles])
  const selected=successions.find(s=>s.id===selectedSuccession)??null
  const selectedCycle=selected?(cycleById.get(selected.crop_cycle_id)??null):null
  const matchedCrop=selectedCycle?(crops.find(c=>c.is_active&&c.crop_name.toLowerCase()===selectedCycle.crop_name.toLowerCase())??null):null
  const matchedCultivar=selectedCycle?.variety&&matchedCrop?(cultivars.find(v=>v.is_active&&v.crop_library_id===matchedCrop.id&&v.variety.toLowerCase()===selectedCycle.variety?.toLowerCase())??null):null
  const verified=crops.filter(c=>c.provenance_type==="reference"&&c.source_name&&c.source_verified_at).length
  const observed=crops.filter(c=>c.provenance_type==="observed").length
  const reusable=successions.filter(s=>s.knowledge_applied_at).length

  async function addCrop(e:FormEvent){
    e.preventDefault(); if(!cropForm.crop_name.trim())return; setSaving(true);setError(null);setNotice(null)
    const source=cropForm.source_name.trim()
    const r=await supabase.from("orchard_crop_library").insert({crop_name:cropForm.crop_name.trim(),scientific_name:cropForm.scientific_name.trim()||null,crop_family:cropForm.crop_family.trim()||null,category:cropForm.category.trim()||null,default_cycle_type:cropForm.default_cycle_type||null,days_to_maturity:n(cropForm.days_to_maturity),nursery_days:n(cropForm.nursery_days),plant_spacing_cm:n(cropForm.plant_spacing_cm),row_spacing_cm:n(cropForm.row_spacing_cm),germination_rate_pct:n(cropForm.germination_rate_pct),seeds_per_plant:n(cropForm.seeds_per_plant),target_yield_per_sqm:n(cropForm.target_yield_per_sqm),yield_unit:cropForm.yield_unit.trim()||null,min_temp_c:n(cropForm.min_temp_c),max_temp_c:n(cropForm.max_temp_c),sun_hours:n(cropForm.sun_hours),water_notes:cropForm.water_notes.trim()||null,soil_notes:cropForm.soil_notes.trim()||null,rotation_notes:cropForm.rotation_notes.trim()||null,source_name:source||null,source_url:cropForm.source_url.trim()||null,source_verified_at:source?new Date().toISOString():null,provenance_type:source?"reference":"manual"})
    if(r.error)setError(r.error.message); else {setCropForm(emptyCrop);setNotice(es?"Perfil guardado.":"Profile saved.");await load()} setSaving(false)
  }

  async function addCultivar(e:FormEvent){
    e.preventDefault(); if(!cultivarForm.crop_library_id||!cultivarForm.variety.trim())return; setSaving(true);setError(null);setNotice(null)
    const source=cultivarForm.source_name.trim()
    const r=await supabase.from("orchard_cultivar_library").insert({crop_library_id:cultivarForm.crop_library_id,variety:cultivarForm.variety.trim(),days_to_maturity:n(cultivarForm.days_to_maturity),nursery_days:n(cultivarForm.nursery_days),plant_spacing_cm:n(cultivarForm.plant_spacing_cm),row_spacing_cm:n(cultivarForm.row_spacing_cm),germination_rate_pct:n(cultivarForm.germination_rate_pct),seeds_per_plant:n(cultivarForm.seeds_per_plant),target_yield_per_sqm:n(cultivarForm.target_yield_per_sqm),notes:cultivarForm.notes.trim()||null,source_name:source||null,source_url:cultivarForm.source_url.trim()||null,source_verified_at:source?new Date().toISOString():null,provenance_type:source?"reference":"manual"})
    if(r.error)setError(r.error.message); else {setCultivarForm(emptyCultivar);setNotice(es?"Cultivar guardado.":"Cultivar saved.");await load()} setSaving(false)
  }

  async function applyKnowledge(){
    if(!selected||!matchedCrop)return;setSaving(true);setError(null);setNotice(null)
    const r=await supabase.rpc("orchard_apply_library_defaults_to_succession",{p_succession_id:selected.id,p_crop_library_id:matchedCrop.id,p_cultivar_library_id:matchedCultivar?.id??null})
    if(r.error)setError(r.error.message); else {setNotice(es?"Defaults aplicados con snapshot de procedencia.":"Defaults applied with a provenance snapshot.");await load()} setSaving(false)
  }

  const labelForSuccession=(s:Succession)=>{const c=cycleById.get(s.crop_cycle_id);return `${c?.crop_name??"Crop"}${c?.variety?` · ${c.variety}`:""} #${s.sequence_no}`}
  return <AppLayout><PageHeader title={es?"Biblioteca Agronómica":"Agronomic Library"} description={es?"Conocimiento reutilizable con procedencia: observado, manual o referencia verificada, conectado directamente al plan.":"Reusable agronomy with provenance: observed, manual or verified reference data, connected directly to planning."} actions={<Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>{es?"Actualizar":"Refresh"}</Button>}/><OrchardNavigation/><div className="space-y-6 p-3 pb-24 sm:p-8">
    {error&&<Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    {notice&&<Card className="border-emerald-500/40"><CardContent className="p-4 text-sm">{notice}</CardContent></Card>}

    <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black">
        <img src={cropPhoto(crops[0]?.crop_name??"vegetables")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" loading="lazy" decoding="async"/>
        <div className="absolute inset-0" style={{background:"linear-gradient(90deg,rgba(8,10,8,.94) 0%,rgba(8,10,8,.72) 45%,rgba(8,10,8,.16) 100%),linear-gradient(0deg,rgba(8,10,8,.76) 0%,transparent 62%)"}}/>
        <div className="relative z-10 flex h-full min-h-[280px] max-w-2xl flex-col justify-end p-6 md:p-8">
          <div className="mb-3 flex items-center gap-2 text-emerald-200"><Sprout className="h-4 w-4"/><span className="text-xs font-semibold uppercase tracking-[.22em]">{es?"Conocimiento vivo":"Living crop knowledge"}</span></div>
          <h2 className="text-3xl font-semibold tracking-[-.035em] text-white">{es?"De referencias agronómicas a decisiones de campo":"From agronomic references to field decisions"}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/72">{es?"Explora perfiles como un catálogo visual y aplica defaults verificados directamente a las sucesiones que estás planificando.":"Browse profiles as a visual catalog, then apply verified defaults directly to the successions you are planning."}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Metric label={es?"Cultivos":"Crops"} value={crops.length}/><Metric label={es?"Observados":"Observed"} value={observed}/><Metric label={es?"Fuentes verificadas":"Verified references"} value={verified}/><Metric label={es?"Planes con knowledge snapshot":"Plans using knowledge"} value={reusable}/>
      </div>
    </section>

    {crops.length>0&&<section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{es?"Catálogo visual":"Visual catalog"}</p><h2 className="text-xl font-semibold">{es?"Perfiles de cultivo":"Crop profiles"}</h2></div><p className="hidden text-sm text-muted-foreground md:block">{es?"Madurez, vivero, germinación y procedencia de un vistazo.":"Maturity, nursery, germination and provenance at a glance."}</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{crops.map(c=><CropVisualCard key={c.id} crop={c} cultivars={cultivars.filter(v=>v.crop_library_id===c.id)} es={es}/>)}</div></section>}

    <Card className="overflow-hidden border-primary/20"><CardHeader className="bg-primary/[.04]"><CardTitle className="flex items-center gap-2"><WandSparkles className="h-5 w-5"/>{es?"Aplicar conocimiento al plan":"Apply knowledge to a planned succession"}</CardTitle><CardDescription>{es?"Solo aplica valores agronómicos del cultivo/variedad coincidente y guarda un snapshot de procedencia. No cambia fechas, área ni plantas planificadas.":"Only applies agronomic defaults from the matching crop/cultivar and stores a provenance snapshot. Planned dates, area and plant counts are not changed."}</CardDescription></CardHeader><CardContent className="space-y-4 pt-6"><div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"><Field label={es?"Sucesión":"Succession"}><Select value={selectedSuccession} onValueChange={setSelectedSuccession}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{successions.map(s=><SelectItem key={s.id} value={s.id}>{labelForSuccession(s)}</SelectItem>)}</SelectContent></Select></Field><Datum label={es?"Perfil cultivo":"Crop profile"} value={matchedCrop?.crop_name??(selected?"Not found":"—")}/><Datum label={es?"Perfil cultivar":"Cultivar profile"} value={matchedCultivar?.variety??(selectedCycle?.variety?"Not found":"Base crop")}/><div className="flex items-end"><Button className="w-full" disabled={saving||!selected||!matchedCrop} onClick={()=>void applyKnowledge()}><WandSparkles className="mr-2 h-4 w-4"/>{es?"Aplicar":"Apply"}</Button></div></div>{selected&&<div className="grid gap-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-5"><Datum label={es?"Madurez":"Maturity"} value={`${matchedCultivar?.days_to_maturity??matchedCrop?.days_to_maturity??selected.days_to_maturity??"—"}`}/><Datum label={es?"Espacio planta":"Plant spacing"} value={`${matchedCultivar?.plant_spacing_cm??matchedCrop?.plant_spacing_cm??selected.plant_spacing_cm??"—"} cm`}/><Datum label={es?"Espacio fila":"Row spacing"} value={`${matchedCultivar?.row_spacing_cm??matchedCrop?.row_spacing_cm??selected.row_spacing_cm??"—"} cm`}/><Datum label={es?"Germinación":"Germination"} value={`${matchedCultivar?.germination_rate_pct??matchedCrop?.germination_rate_pct??selected.germination_rate_pct??"—"}%`}/><Datum label={es?"Procedencia":"Provenance"} value={matchedCultivar?.provenance_type??matchedCrop?.provenance_type??"—"}/></div>}</CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5"/>{es?"Agregar perfil de cultivo":"Add crop profile"}</CardTitle><CardDescription>{es?"Las referencias externas quedan separadas de observaciones internas; no presentamos un dato observado como verdad agronómica universal.":"External references stay distinct from internal observations; observed farm data is never presented as universal agronomy."}</CardDescription></CardHeader><CardContent><form onSubmit={addCrop} className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><Field label={es?"Cultivo":"Crop"}><Input value={cropForm.crop_name} onChange={e=>setCropForm(f=>({...f,crop_name:e.target.value}))} required/></Field><Field label={es?"Nombre científico":"Scientific name"}><Input value={cropForm.scientific_name} onChange={e=>setCropForm(f=>({...f,scientific_name:e.target.value}))}/></Field><Field label={es?"Familia / rotación":"Family / rotation"}><Input value={cropForm.crop_family} onChange={e=>setCropForm(f=>({...f,crop_family:e.target.value}))}/></Field><Field label={es?"Categoría":"Category"}><Input value={cropForm.category} onChange={e=>setCropForm(f=>({...f,category:e.target.value}))}/></Field></div><div className="grid gap-3 md:grid-cols-2"><Field label={es?"Ciclo":"Cycle"}><Select value={cropForm.default_cycle_type} onValueChange={v=>setCropForm(f=>({...f,default_cycle_type:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["direct_sow","transplant","perennial","cover_crop"].map(v=><SelectItem key={v} value={v}>{v.replaceAll("_"," ")}</SelectItem>)}</SelectContent></Select></Field><Num label={es?"Días madurez":"Days to maturity"} value={cropForm.days_to_maturity} set={v=>setCropForm(f=>({...f,days_to_maturity:v}))}/><Num label={es?"Días vivero":"Nursery days"} value={cropForm.nursery_days} set={v=>setCropForm(f=>({...f,nursery_days:v}))}/><Num label={es?"Germinación %":"Germination %"} value={cropForm.germination_rate_pct} set={v=>setCropForm(f=>({...f,germination_rate_pct:v}))}/></div><div className="grid gap-3 md:grid-cols-2"><Num label={es?"Espacio planta cm":"Plant spacing cm"} value={cropForm.plant_spacing_cm} set={v=>setCropForm(f=>({...f,plant_spacing_cm:v}))}/><Num label={es?"Espacio fila cm":"Row spacing cm"} value={cropForm.row_spacing_cm} set={v=>setCropForm(f=>({...f,row_spacing_cm:v}))}/><Num label={es?"Semillas/planta":"Seeds / plant"} value={cropForm.seeds_per_plant} set={v=>setCropForm(f=>({...f,seeds_per_plant:v}))}/><Num label={es?"Rendimiento/m²":"Target yield / m²"} value={cropForm.target_yield_per_sqm} set={v=>setCropForm(f=>({...f,target_yield_per_sqm:v}))}/></div><details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{es?"Clima, suelo, rotación y procedencia":"Climate, soil, rotation and provenance"}</summary><div className="mt-4 grid gap-3 md:grid-cols-2"><Num label="Min °C" value={cropForm.min_temp_c} set={v=>setCropForm(f=>({...f,min_temp_c:v}))}/><Num label="Max °C" value={cropForm.max_temp_c} set={v=>setCropForm(f=>({...f,max_temp_c:v}))}/><Num label={es?"Horas sol":"Sun hours"} value={cropForm.sun_hours} set={v=>setCropForm(f=>({...f,sun_hours:v}))}/><Field label={es?"Unidad rendimiento":"Yield unit"}><Input value={cropForm.yield_unit} onChange={e=>setCropForm(f=>({...f,yield_unit:e.target.value}))}/></Field></div><div className="mt-3 grid gap-3"><Field label={es?"Agua":"Water"}><Textarea value={cropForm.water_notes} onChange={e=>setCropForm(f=>({...f,water_notes:e.target.value}))}/></Field><Field label={es?"Suelo":"Soil"}><Textarea value={cropForm.soil_notes} onChange={e=>setCropForm(f=>({...f,soil_notes:e.target.value}))}/></Field><Field label={es?"Rotación":"Rotation"}><Textarea value={cropForm.rotation_notes} onChange={e=>setCropForm(f=>({...f,rotation_notes:e.target.value}))}/></Field></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label={es?"Fuente":"Source"}><Input value={cropForm.source_name} onChange={e=>setCropForm(f=>({...f,source_name:e.target.value}))}/></Field><Field label="URL"><Input type="url" value={cropForm.source_url} onChange={e=>setCropForm(f=>({...f,source_url:e.target.value}))}/></Field></div></details><Button disabled={saving}><Plus className="mr-2 h-4 w-4"/>{es?"Guardar perfil":"Save profile"}</Button></form></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5"/>{es?"Agregar cultivar":"Add cultivar"}</CardTitle><CardDescription>{es?"Sobrescribe solo los valores que cambian respecto del cultivo base.":"Override only the values that differ from the base crop."}</CardDescription></CardHeader><CardContent><form onSubmit={addCultivar} className="space-y-4"><Field label={es?"Cultivo base":"Base crop"}><Select value={cultivarForm.crop_library_id} onValueChange={v=>setCultivarForm(f=>({...f,crop_library_id:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{crops.map(c=><SelectItem key={c.id} value={c.id}>{c.crop_name}</SelectItem>)}</SelectContent></Select></Field><Field label={es?"Variedad":"Variety"}><Input value={cultivarForm.variety} onChange={e=>setCultivarForm(f=>({...f,variety:e.target.value}))} required/></Field><div className="grid gap-3 md:grid-cols-2"><Num label={es?"Días madurez":"Days to maturity"} value={cultivarForm.days_to_maturity} set={v=>setCultivarForm(f=>({...f,days_to_maturity:v}))}/><Num label={es?"Rendimiento/m²":"Yield / m²"} value={cultivarForm.target_yield_per_sqm} set={v=>setCultivarForm(f=>({...f,target_yield_per_sqm:v}))}/></div><Field label={es?"Fuente":"Source"}><Input value={cultivarForm.source_name} onChange={e=>setCultivarForm(f=>({...f,source_name:e.target.value}))}/></Field><Field label="URL"><Input type="url" value={cultivarForm.source_url} onChange={e=>setCultivarForm(f=>({...f,source_url:e.target.value}))}/></Field><Field label={es?"Notas":"Notes"}><Textarea value={cultivarForm.notes} onChange={e=>setCultivarForm(f=>({...f,notes:e.target.value}))}/></Field><Button className="w-full" disabled={saving||!crops.length}><Plus className="mr-2 h-4 w-4"/>{es?"Agregar cultivar":"Add cultivar"}</Button></form></CardContent></Card>
    </div>
  </div></AppLayout>
}

function CropVisualCard({crop,cultivars,es}:{crop:CropProfile;cultivars:Cultivar[];es:boolean}){
  return <Card className="group overflow-hidden border-white/10 bg-card/80"><div className="relative h-[210px] overflow-hidden bg-muted"><img src={cropPhoto(crop.crop_name)} alt={crop.crop_name} className="h-full w-full object-cover opacity-100 [filter:none] transition-transform duration-500 group-hover:scale-[1.025]" loading="lazy" decoding="async"/><div className="absolute inset-0" style={{background:"linear-gradient(0deg,rgba(7,9,7,.88) 0%,rgba(7,9,7,.12) 72%)"}}/><div className="absolute inset-x-0 bottom-0 p-4 text-white"><div className="mb-2 flex items-center justify-between gap-2"><Badge variant="secondary" className="border-white/10 bg-black/35 text-white backdrop-blur-sm">{crop.category??crop.default_cycle_type??(es?"Cultivo":"Crop")}</Badge><Provenance profile={crop} es={es}/></div><h3 className="text-xl font-semibold tracking-[-.025em]">{crop.crop_name}</h3><p className="text-xs italic text-white/65">{crop.scientific_name??crop.crop_family??""}</p></div></div><CardContent className="space-y-4 p-4"><div className="grid grid-cols-4 gap-2 text-sm"><Datum label={es?"Madurez":"Maturity"} value={crop.days_to_maturity?`${crop.days_to_maturity}d`:"—"}/><Datum label={es?"Vivero":"Nursery"} value={crop.nursery_days!=null?`${crop.nursery_days}d`:"—"}/><Datum label={es?"Germ.":"Germ."} value={crop.germination_rate_pct!=null?`${crop.germination_rate_pct}%`:"—"}/><Datum label={es?"Obs.":"Obs."} value={String(crop.observed_count)}/></div>{cultivars.length>0&&<div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{es?"Cultivares":"Cultivars"}</p><div className="flex flex-wrap gap-2">{cultivars.slice(0,4).map(v=><Badge key={v.id} variant="outline">{v.variety}</Badge>)}{cultivars.length>4&&<Badge variant="outline">+{cultivars.length-4}</Badge>}</div></div>}{crop.source_url&&<a href={crop.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">{crop.source_name??(es?"Ver fuente":"View source")}<ExternalLink className="h-3 w-3"/></a>}</CardContent></Card>
}
function Provenance({profile,es}:{profile:CropProfile;es:boolean}){if(profile.provenance_type==="reference")return <Badge className="gap-1"><ShieldCheck className="h-3 w-3"/>{es?"Referencia":"Reference"}</Badge>;if(profile.provenance_type==="observed")return <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3"/>{es?"Observado":"Observed"}</Badge>;return <Badge variant="outline">{es?"Manual":"Manual"}</Badge>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
function Num({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <Field label={label}><Input type="number" step="0.1" value={value} onChange={e=>set(e.target.value)}/></Field>}
function Metric({label,value}:{label:string;value:number}){return <Card className="border-white/10 bg-card/75"><CardContent className="flex h-full min-h-[62px] flex-col justify-center p-4"><p className="text-2xl font-semibold tracking-[-.03em]">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>}
function Datum({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>}

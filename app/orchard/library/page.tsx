"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { BookOpen, Database, ExternalLink, Leaf, Plus, RefreshCw, Search, ShieldCheck, Sprout, WandSparkles } from "lucide-react"
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
type CropPhotoRegistry = { crop_name:string; photo_url:string; verification_status:string }

const emptyCrop = { crop_name:"", scientific_name:"", crop_family:"", category:"", default_cycle_type:"transplant", days_to_maturity:"", nursery_days:"", plant_spacing_cm:"", row_spacing_cm:"", germination_rate_pct:"", seeds_per_plant:"", target_yield_per_sqm:"", yield_unit:"kg", min_temp_c:"", max_temp_c:"", sun_hours:"", water_notes:"", soil_notes:"", rotation_notes:"", source_name:"", source_url:"" }
const emptyCultivar = { crop_library_id:"", variety:"", days_to_maturity:"", nursery_days:"", plant_spacing_cm:"", row_spacing_cm:"", germination_rate_pct:"", seeds_per_plant:"", target_yield_per_sqm:"", notes:"", source_name:"", source_url:"" }
const n = (value:string) => value === "" ? null : Number(value)
const AGRONOMIC_LIBRARY_PHOTO = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=2200&q=92"
const FIRST_ROW_PRIORITY = 6

const SOUTH_CHILE_PRIORITY: string[][] = [
  ["potato", "papa"], ["pea", "arveja"], ["lettuce", "lechuga"], ["beet", "beetroot", "betarraga", "red beet"],
  ["corn", "maize", "choclo"], ["bean", "beans", "poroto"], ["carrot", "zanahoria"], ["onion", "cebolla"],
  ["cabbage", "repollo"], ["broccoli", "brocoli"], ["cauliflower", "coliflor"], ["garlic", "ajo"],
  ["radish", "rabanito", "rabano"], ["chard", "acelga"], ["spinach", "espinaca"], ["leek", "puerro"],
  ["parsley", "perejil"], ["coriander", "cilantro"], ["kale", "cale"], ["zucchini", "zapallo italiano", "calabacin"],
  ["pumpkin", "zapallo"], ["tomato", "tomate"], ["bell pepper", "sweet pepper", "pimenton"],
]

function normalizeCropName(name:string){return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ")}
function southChilePriority(name:string){
  const key=normalizeCropName(name)
  const index=SOUTH_CHILE_PRIORITY.findIndex(group=>group.some(alias=>key===alias||key.startsWith(`${alias},`)||key.startsWith(`${alias} (`)))
  return index===-1?SOUTH_CHILE_PRIORITY.length:index
}
function chileRepresentativeScore(name:string,group:string[]){
  const key=normalizeCropName(name)
  if(group.some(alias=>key===alias))return 0
  if(/\b(fodder|silage|seeds?)\b/.test(key))return 9
  if(/\b(edible|harvested green|vegetable|red|dry)\b/.test(key))return 1
  return 3
}
function cropInitial(name:string){return normalizeCropName(name).charAt(0).toUpperCase()}
function recoverCropPhoto(e:React.SyntheticEvent<HTMLImageElement>){e.currentTarget.style.display="none"}

export default function OrchardLibraryPage(){
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const es = language === "es"
  const [crops,setCrops]=useState<CropProfile[]>([])
  const [cultivars,setCultivars]=useState<Cultivar[]>([])
  const [successions,setSuccessions]=useState<Succession[]>([])
  const [cycles,setCycles]=useState<Cycle[]>([])
  const [cropPhotos,setCropPhotos]=useState<Record<string,string>>({})
  const [cropForm,setCropForm]=useState(emptyCrop); const [cultivarForm,setCultivarForm]=useState(emptyCultivar)
  const [selectedSuccession,setSelectedSuccession]=useState("")
  const [catalogIndex,setCatalogIndex]=useState("CL")
  const [query,setQuery]=useState("")
  const deferredQuery=useDeferredValue(query)
  const [saving,setSaving]=useState(false)
  const [catalogLoading,setCatalogLoading]=useState(true)
  const [secondaryLoading,setSecondaryLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)

  const loadCatalog=useCallback(async()=>{
    setCatalogLoading(true)
    const [a,p]=await Promise.all([
      supabase.from("orchard_crop_library").select("*").order("crop_name"),
      supabase.from("orchard_crop_photo_registry").select("crop_name,photo_url,verification_status").eq("verification_status","verified"),
    ])
    const e=a.error??p.error
    if(e)setError(e.message)
    else {
      setCrops((a.data??[]) as CropProfile[])
      setCropPhotos(Object.fromEntries(((p.data??[]) as CropPhotoRegistry[]).filter(row=>row.photo_url).map(row=>[normalizeCropName(row.crop_name),row.photo_url])))
    }
    setCatalogLoading(false)
  },[supabase])

  const loadSecondary=useCallback(async()=>{
    setSecondaryLoading(true)
    const [b,s,c]=await Promise.all([
      supabase.from("orchard_cultivar_library").select("*").order("variety"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,days_to_maturity,plant_spacing_cm,row_spacing_cm,germination_rate_pct,seeds_per_plant,crop_library_id,cultivar_library_id,knowledge_applied_at").neq("status","cancelled").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id,crop_name,variety"),
    ])
    const e=b.error??s.error??c.error
    if(e)setError(e.message)
    else {setCultivars((b.data??[]) as Cultivar[]);setSuccessions((s.data??[]) as Succession[]);setCycles((c.data??[]) as Cycle[])}
    setSecondaryLoading(false)
  },[supabase])

  const loadAll=useCallback(async()=>{setError(null);await Promise.all([loadCatalog(),loadSecondary()])},[loadCatalog,loadSecondary])

  useEffect(()=>{
    void loadCatalog()
    const id=window.setTimeout(()=>{void loadSecondary()},180)
    return ()=>window.clearTimeout(id)
  },[loadCatalog,loadSecondary])

  const cycleById=useMemo(()=>new Map(cycles.map(c=>[c.id,c])),[cycles])
  const cultivarsByCrop=useMemo(()=>{
    const map=new Map<string,Cultivar[]>()
    for(const cultivar of cultivars){const list=map.get(cultivar.crop_library_id);if(list)list.push(cultivar);else map.set(cultivar.crop_library_id,[cultivar])}
    return map
  },[cultivars])
  const selected=successions.find(s=>s.id===selectedSuccession)??null
  const selectedCycle=selected?(cycleById.get(selected.crop_cycle_id)??null):null
  const matchedCrop=selectedCycle?(crops.find(c=>c.is_active&&c.crop_name.toLowerCase()===selectedCycle.crop_name.toLowerCase())??null):null
  const matchedCultivar=selectedCycle?.variety&&matchedCrop?(cultivars.find(v=>v.is_active&&v.crop_library_id===matchedCrop.id&&v.variety.toLowerCase()===selectedCycle.variety?.toLowerCase())??null):null
  const verified=crops.filter(c=>c.provenance_type==="reference"&&c.source_name&&c.source_verified_at).length
  const observed=crops.filter(c=>c.provenance_type==="observed").length
  const reusable=successions.filter(s=>s.knowledge_applied_at).length
  const orderedCrops=useMemo(()=>[...crops].sort((a,b)=>southChilePriority(a.crop_name)-southChilePriority(b.crop_name)||a.crop_name.localeCompare(b.crop_name)),[crops])
  const chileCrops=useMemo(()=>SOUTH_CHILE_PRIORITY.flatMap((group,index)=>{
    const candidates=orderedCrops.filter(c=>southChilePriority(c.crop_name)===index)
    if(!candidates.length)return []
    return [[...candidates].sort((a,b)=>chileRepresentativeScore(a.crop_name,group)-chileRepresentativeScore(b.crop_name,group)||a.crop_name.localeCompare(b.crop_name))[0]]
  }),[orderedCrops])
  const chileCropIds=useMemo(()=>new Set(chileCrops.map(c=>c.id)),[chileCrops])
  const restCrops=useMemo(()=>orderedCrops.filter(c=>!chileCropIds.has(c.id)).sort((a,b)=>a.crop_name.localeCompare(b.crop_name)),[orderedCrops,chileCropIds])
  const catalogLetters=useMemo(()=>Array.from(new Set(restCrops.map(c=>cropInitial(c.crop_name)).filter(letter=>/^[A-Z]$/.test(letter)))).sort((a,b)=>a==="W"?1:b==="W"?-1:a.localeCompare(b)),[restCrops])
  const normalizedQuery=normalizeCropName(deferredQuery)
  const visibleCrops=useMemo(()=>{
    if(normalizedQuery)return orderedCrops.filter(c=>normalizeCropName(`${c.crop_name} ${c.scientific_name??""} ${c.crop_family??""}`).includes(normalizedQuery))
    return catalogIndex==="CL"?chileCrops:restCrops.filter(c=>cropInitial(c.crop_name)===catalogIndex)
  },[normalizedQuery,orderedCrops,catalogIndex,chileCrops,restCrops])

  const prefetchCrops=useCallback((items:CropProfile[])=>{
    if(typeof window==="undefined")return
    for(const crop of items.slice(0,FIRST_ROW_PRIORITY)){
      const src=cropPhotos[normalizeCropName(crop.crop_name)]
      if(src){const img=new Image();img.decoding="async";img.src=src}
    }
  },[cropPhotos])
  const selectIndex=(index:string)=>{setQuery("");setCatalogIndex(index);prefetchCrops(index==="CL"?chileCrops:restCrops.filter(c=>cropInitial(c.crop_name)===index))}
  const prefetchIndex=(index:string)=>prefetchCrops(index==="CL"?chileCrops:restCrops.filter(c=>cropInitial(c.crop_name)===index))

  async function addCrop(e:FormEvent){
    e.preventDefault(); if(!cropForm.crop_name.trim())return; setSaving(true);setError(null);setNotice(null)
    const source=cropForm.source_name.trim()
    const r=await supabase.from("orchard_crop_library").insert({crop_name:cropForm.crop_name.trim(),scientific_name:cropForm.scientific_name.trim()||null,crop_family:cropForm.crop_family.trim()||null,category:cropForm.category.trim()||null,default_cycle_type:cropForm.default_cycle_type||null,days_to_maturity:n(cropForm.days_to_maturity),nursery_days:n(cropForm.nursery_days),plant_spacing_cm:n(cropForm.plant_spacing_cm),row_spacing_cm:n(cropForm.row_spacing_cm),germination_rate_pct:n(cropForm.germination_rate_pct),seeds_per_plant:n(cropForm.seeds_per_plant),target_yield_per_sqm:n(cropForm.target_yield_per_sqm),yield_unit:cropForm.yield_unit.trim()||null,min_temp_c:n(cropForm.min_temp_c),max_temp_c:n(cropForm.max_temp_c),sun_hours:n(cropForm.sun_hours),water_notes:cropForm.water_notes.trim()||null,soil_notes:cropForm.soil_notes.trim()||null,rotation_notes:cropForm.rotation_notes.trim()||null,source_name:source||null,source_url:cropForm.source_url.trim()||null,source_verified_at:source?new Date().toISOString():null,provenance_type:source?"reference":"manual"})
    if(r.error)setError(r.error.message); else {setCropForm(emptyCrop);setNotice(es?"Perfil guardado.":"Profile saved.");await loadCatalog()} setSaving(false)
  }

  async function addCultivar(e:FormEvent){
    e.preventDefault(); if(!cultivarForm.crop_library_id||!cultivarForm.variety.trim())return; setSaving(true);setError(null);setNotice(null)
    const source=cultivarForm.source_name.trim()
    const r=await supabase.from("orchard_cultivar_library").insert({crop_library_id:cultivarForm.crop_library_id,variety:cultivarForm.variety.trim(),days_to_maturity:n(cultivarForm.days_to_maturity),nursery_days:n(cultivarForm.nursery_days),plant_spacing_cm:n(cultivarForm.plant_spacing_cm),row_spacing_cm:n(cultivarForm.row_spacing_cm),germination_rate_pct:n(cultivarForm.germination_rate_pct),seeds_per_plant:n(cultivarForm.seeds_per_plant),target_yield_per_sqm:n(cultivarForm.target_yield_per_sqm),notes:cultivarForm.notes.trim()||null,source_name:source||null,source_url:cultivarForm.source_url.trim()||null,source_verified_at:source?new Date().toISOString():null,provenance_type:source?"reference":"manual"})
    if(r.error)setError(r.error.message); else {setCultivarForm(emptyCultivar);setNotice(es?"Cultivar guardado.":"Cultivar saved.");await loadSecondary()} setSaving(false)
  }

  async function applyKnowledge(){
    if(!selected||!matchedCrop)return;setSaving(true);setError(null);setNotice(null)
    const r=await supabase.rpc("orchard_apply_library_defaults_to_succession",{p_succession_id:selected.id,p_crop_library_id:matchedCrop.id,p_cultivar_library_id:matchedCultivar?.id??null})
    if(r.error)setError(r.error.message); else {setNotice(es?"Defaults aplicados con snapshot de procedencia.":"Defaults applied with a provenance snapshot.");await loadSecondary()} setSaving(false)
  }

  const labelForSuccession=(s:Succession)=>{const c=cycleById.get(s.crop_cycle_id);return `${c?.crop_name??"Crop"}${c?.variety?` · ${c.variety}`:""} #${s.sequence_no}`}
  const sectionTitle=normalizedQuery?(es?`Resultados · ${visibleCrops.length}`:`Results · ${visibleCrops.length}`):catalogIndex==="CL"?(es?"Prioridad Chile":"Chile priority"):`${es?"Cultivos":"Crops"} · ${catalogIndex}`

  return <AppLayout><PageHeader title={es?"Biblioteca Agronómica":"Agronomic Library"} description={es?"Conocimiento reutilizable con procedencia: observado, manual o referencia verificada, conectado directamente al plan.":"Reusable agronomy with provenance: observed, manual or verified reference data, connected directly to planning."} actions={<Button variant="outline" onClick={()=>void loadAll()}><RefreshCw className="mr-2 h-4 w-4"/>{es?"Actualizar":"Refresh"}</Button>}/><OrchardNavigation/><div className="space-y-6 p-3 pb-24 sm:p-8">
    {error&&<Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    {notice&&<Card className="border-emerald-500/40"><CardContent className="p-4 text-sm">{notice}</CardContent></Card>}

    <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black">
        <img src={AGRONOMIC_LIBRARY_PHOTO} alt="" onError={recoverCropPhoto} className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" loading="eager" fetchPriority="high" decoding="async"/>
        <div className="absolute inset-0" style={{background:"linear-gradient(90deg,rgba(8,10,8,.94) 0%,rgba(8,10,8,.72) 45%,rgba(8,10,8,.16) 100%),linear-gradient(0deg,rgba(8,10,8,.76) 0%,transparent 62%)"}}/>
        <div className="relative z-10 flex h-full min-h-[280px] max-w-2xl flex-col justify-end p-6 md:p-8">
          <div className="mb-3 flex items-center gap-2 text-emerald-200"><Sprout className="h-4 w-4"/><span className="text-xs font-semibold uppercase tracking-[.22em]">{es?"Conocimiento vivo":"Living crop knowledge"}</span></div>
          <h2 className="text-3xl font-semibold tracking-[-.035em] text-white">{es?"De referencias agronómicas a decisiones de campo":"From agronomic references to field decisions"}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/72">{es?"Explora todos los cultivos al instante por letra o búsqueda, con fotografías servidas desde nuestra propia biblioteca.":"Browse every crop instantly by letter or search, with photography served from our own library."}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Metric label={es?"Cultivos":"Crops"} value={crops.length}/><Metric label={es?"Observados":"Observed"} value={observed}/><Metric label={es?"Fuentes verificadas":"Verified references"} value={verified}/><Metric label={es?"Planes con knowledge snapshot":"Plans using knowledge"} value={reusable}/>
      </div>
    </section>

    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{es?"Índice de cultivos":"Crop index"}</p><h2 className="text-xl font-semibold">{sectionTitle}</h2></div><div className="relative w-full md:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder={es?"Buscar cultivo o nombre científico…":"Search crop or scientific name…"} className="pl-9"/></div></div>
      <div className="sticky top-0 z-20 -mx-1 flex gap-2 overflow-x-auto border-y border-white/10 bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button size="sm" variant={!normalizedQuery&&catalogIndex==="CL"?"default":"outline"} className="shrink-0" onMouseEnter={()=>prefetchIndex("CL")} onFocus={()=>prefetchIndex("CL")} onClick={()=>selectIndex("CL")}>{es?"Chile":"Chile"}<span className="ml-2 text-[10px] opacity-70">{chileCrops.length}</span></Button>
        {catalogLetters.map(letter=><Button key={letter} size="sm" variant={!normalizedQuery&&catalogIndex===letter?"default":"outline"} className="h-9 w-9 shrink-0 px-0" onMouseEnter={()=>prefetchIndex(letter)} onFocus={()=>prefetchIndex(letter)} onClick={()=>selectIndex(letter)}>{letter}</Button>)}
      </div>
      {catalogLoading&&crops.length===0?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-[330px] animate-pulse rounded-xl border border-white/10 bg-muted/30"/>)}</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleCrops.map((c,index)=><CropVisualCard key={c.id} crop={c} cultivars={cultivarsByCrop.get(c.id)??[]} cropPhotos={cropPhotos} es={es} priority={index<FIRST_ROW_PRIORITY}/>)}</div>}
      {!catalogLoading&&visibleCrops.length===0&&<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{es?"No encontramos cultivos con ese criterio.":"No crops match that filter."}</CardContent></Card>}
    </section>

    <Card className="overflow-hidden border-primary/20"><CardHeader className="bg-primary/[.04]"><CardTitle className="flex items-center gap-2"><WandSparkles className="h-5 w-5"/>{es?"Aplicar conocimiento al plan":"Apply knowledge to a planned succession"}</CardTitle><CardDescription>{secondaryLoading?(es?"Cargando planificación en segundo plano…":"Loading planning data in the background…"):(es?"Solo aplica valores agronómicos del cultivo/variedad coincidente y guarda un snapshot de procedencia. No cambia fechas, área ni plantas planificadas.":"Only applies agronomic defaults from the matching crop/cultivar and stores a provenance snapshot. Planned dates, area and plant counts are not changed.")}</CardDescription></CardHeader><CardContent className="space-y-4 pt-6"><div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"><Field label={es?"Sucesión":"Succession"}><Select value={selectedSuccession} onValueChange={setSelectedSuccession} disabled={secondaryLoading}><SelectTrigger><SelectValue placeholder={secondaryLoading?(es?"Cargando…":"Loading…"):undefined}/></SelectTrigger><SelectContent>{successions.map(s=><SelectItem key={s.id} value={s.id}>{labelForSuccession(s)}</SelectItem>)}</SelectContent></Select></Field><Datum label={es?"Perfil cultivo":"Crop profile"} value={matchedCrop?.crop_name??(selected?"Not found":"—")}/><Datum label={es?"Perfil cultivar":"Cultivar profile"} value={matchedCultivar?.variety??(selectedCycle?.variety?"Not found":"Base crop")}/><div className="flex items-end"><Button className="w-full" disabled={saving||secondaryLoading||!selected||!matchedCrop} onClick={()=>void applyKnowledge()}><WandSparkles className="mr-2 h-4 w-4"/>{es?"Aplicar":"Apply"}</Button></div></div>{selected&&<div className="grid gap-2 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-5"><Datum label={es?"Madurez":"Maturity"} value={`${matchedCultivar?.days_to_maturity??matchedCrop?.days_to_maturity??selected.days_to_maturity??"—"}`}/><Datum label={es?"Espacio planta":"Plant spacing"} value={`${matchedCultivar?.plant_spacing_cm??matchedCrop?.plant_spacing_cm??selected.plant_spacing_cm??"—"} cm`}/><Datum label={es?"Espacio fila":"Row spacing"} value={`${matchedCultivar?.row_spacing_cm??matchedCrop?.row_spacing_cm??selected.row_spacing_cm??"—"} cm`}/><Datum label={es?"Germinación":"Germination"} value={`${matchedCultivar?.germination_rate_pct??matchedCrop?.germination_rate_pct??selected.germination_rate_pct??"—"}%`}/><Datum label={es?"Procedencia":"Provenance"} value={matchedCultivar?.provenance_type??matchedCrop?.provenance_type??"—"}/></div>}</CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5"/>{es?"Agregar perfil de cultivo":"Add crop profile"}</CardTitle><CardDescription>{es?"Las referencias externas quedan separadas de observaciones internas; no presentamos un dato observado como verdad agronómica universal.":"External references stay distinct from internal observations; observed farm data is never presented as universal agronomy."}</CardDescription></CardHeader><CardContent><form onSubmit={addCrop} className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><Field label={es?"Cultivo":"Crop"}><Input value={cropForm.crop_name} onChange={e=>setCropForm(f=>({...f,crop_name:e.target.value}))} required/></Field><Field label={es?"Nombre científico":"Scientific name"}><Input value={cropForm.scientific_name} onChange={e=>setCropForm(f=>({...f,scientific_name:e.target.value}))}/></Field><Field label={es?"Familia / rotación":"Family / rotation"}><Input value={cropForm.crop_family} onChange={e=>setCropForm(f=>({...f,crop_family:e.target.value}))}/></Field><Field label={es?"Categoría":"Category"}><Input value={cropForm.category} onChange={e=>setCropForm(f=>({...f,category:e.target.value}))}/></Field></div><div className="grid gap-3 md:grid-cols-2"><Field label={es?"Ciclo":"Cycle"}><Select value={cropForm.default_cycle_type} onValueChange={v=>setCropForm(f=>({...f,default_cycle_type:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["direct_sow","transplant","perennial","cover_crop"].map(v=><SelectItem key={v} value={v}>{v.replaceAll("_"," ")}</SelectItem>)}</SelectContent></Select></Field><Num label={es?"Días madurez":"Days to maturity"} value={cropForm.days_to_maturity} set={v=>setCropForm(f=>({...f,days_to_maturity:v}))}/><Num label={es?"Días vivero":"Nursery days"} value={cropForm.nursery_days} set={v=>setCropForm(f=>({...f,nursery_days:v}))}/><Num label={es?"Germinación %":"Germination %"} value={cropForm.germination_rate_pct} set={v=>setCropForm(f=>({...f,germination_rate_pct:v}))}/></div><div className="grid gap-3 md:grid-cols-2"><Num label={es?"Espacio planta cm":"Plant spacing cm"} value={cropForm.plant_spacing_cm} set={v=>setCropForm(f=>({...f,plant_spacing_cm:v}))}/><Num label={es?"Espacio fila cm":"Row spacing cm"} value={cropForm.row_spacing_cm} set={v=>setCropForm(f=>({...f,row_spacing_cm:v}))}/><Num label={es?"Semillas/planta":"Seeds / plant"} value={cropForm.seeds_per_plant} set={v=>setCropForm(f=>({...f,seeds_per_plant:v}))}/><Num label={es?"Rendimiento/m²":"Target yield / m²"} value={cropForm.target_yield_per_sqm} set={v=>setCropForm(f=>({...f,target_yield_per_sqm:v}))}/></div><details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{es?"Clima, suelo, rotación y procedencia":"Climate, soil, rotation and provenance"}</summary><div className="mt-4 grid gap-3 md:grid-cols-2"><Num label="Min °C" value={cropForm.min_temp_c} set={v=>setCropForm(f=>({...f,min_temp_c:v}))}/><Num label="Max °C" value={cropForm.max_temp_c} set={v=>setCropForm(f=>({...f,max_temp_c:v}))}/><Num label={es?"Horas sol":"Sun hours"} value={cropForm.sun_hours} set={v=>setCropForm(f=>({...f,sun_hours:v}))}/><Field label={es?"Unidad rendimiento":"Yield unit"}><Input value={cropForm.yield_unit} onChange={e=>setCropForm(f=>({...f,yield_unit:e.target.value}))}/></Field></div><div className="mt-3 grid gap-3"><Field label={es?"Agua":"Water"}><Textarea value={cropForm.water_notes} onChange={e=>setCropForm(f=>({...f,water_notes:e.target.value}))}/></Field><Field label={es?"Suelo":"Soil"}><Textarea value={cropForm.soil_notes} onChange={e=>setCropForm(f=>({...f,soil_notes:e.target.value}))}/></Field><Field label={es?"Rotación":"Rotation"}><Textarea value={cropForm.rotation_notes} onChange={e=>setCropForm(f=>({...f,rotation_notes:e.target.value}))}/></Field></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label={es?"Fuente":"Source"}><Input value={cropForm.source_name} onChange={e=>setCropForm(f=>({...f,source_name:e.target.value}))}/></Field><Field label="URL"><Input type="url" value={cropForm.source_url} onChange={e=>setCropForm(f=>({...f,source_url:e.target.value}))}/></Field></div></details><Button disabled={saving}><Plus className="mr-2 h-4 w-4"/>{es?"Guardar perfil":"Save profile"}</Button></form></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5"/>{es?"Agregar cultivar":"Add cultivar"}</CardTitle><CardDescription>{es?"Sobrescribe solo los valores que cambian respecto del cultivo base.":"Override only the values that differ from the base crop."}</CardDescription></CardHeader><CardContent><form onSubmit={addCultivar} className="space-y-4"><Field label={es?"Cultivo base":"Base crop"}><Select value={cultivarForm.crop_library_id} onValueChange={v=>setCultivarForm(f=>({...f,crop_library_id:v}))} disabled={secondaryLoading}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{orderedCrops.map(c=><SelectItem key={c.id} value={c.id}>{c.crop_name}</SelectItem>)}</SelectContent></Select></Field><Field label={es?"Variedad":"Variety"}><Input value={cultivarForm.variety} onChange={e=>setCultivarForm(f=>({...f,variety:e.target.value}))} required/></Field><div className="grid gap-3 md:grid-cols-2"><Num label={es?"Días madurez":"Days to maturity"} value={cultivarForm.days_to_maturity} set={v=>setCultivarForm(f=>({...f,days_to_maturity:v}))}/><Num label={es?"Rendimiento/m²":"Yield / m²"} value={cultivarForm.target_yield_per_sqm} set={v=>setCultivarForm(f=>({...f,target_yield_per_sqm:v}))}/></div><Field label={es?"Fuente":"Source"}><Input value={cultivarForm.source_name} onChange={e=>setCultivarForm(f=>({...f,source_name:e.target.value}))}/></Field><Field label="URL"><Input type="url" value={cultivarForm.source_url} onChange={e=>setCultivarForm(f=>({...f,source_url:e.target.value}))}/></Field><Field label={es?"Notas":"Notes"}><Textarea value={cultivarForm.notes} onChange={e=>setCultivarForm(f=>({...f,notes:e.target.value}))}/></Field><Button className="w-full" disabled={saving||secondaryLoading||!crops.length}><Plus className="mr-2 h-4 w-4"/>{es?"Agregar cultivar":"Add cultivar"}</Button></form></CardContent></Card>
    </div>
  </div></AppLayout>
}

function CropVisualCard({crop,cultivars,cropPhotos,es,priority}:{crop:CropProfile;cultivars:Cultivar[];cropPhotos:Record<string,string>;es:boolean;priority:boolean}){
  const photo=cropPhotos[normalizeCropName(crop.crop_name)]??null
  return <Card className="group overflow-hidden border-white/10 bg-card/80" style={{contentVisibility:"auto",containIntrinsicSize:"330px"}}><div className="relative h-[210px] overflow-hidden bg-muted">{photo?<img src={photo} alt={crop.crop_name} onError={recoverCropPhoto} className="h-full w-full object-cover opacity-100 [filter:none] transition-transform duration-500 group-hover:scale-[1.025]" loading={priority?"eager":"lazy"} fetchPriority={priority?"high":"auto"} decoding="async"/>:<div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(52,211,153,.16),transparent_36%),linear-gradient(135deg,rgba(20,28,23,1),rgba(34,42,36,1))] text-center"><Leaf className="mb-3 h-8 w-8 text-emerald-300/70"/><span className="text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-200/70">{es?"Perfil de referencia":"Reference profile"}</span><span className="mt-2 max-w-[80%] text-xs text-white/50">{es?"Fotografía pendiente":"Photo pending"}</span></div>}<div className="absolute inset-0" style={{background:"linear-gradient(0deg,rgba(7,9,7,.88) 0%,rgba(7,9,7,.12) 72%)"}}/><div className="absolute inset-x-0 bottom-0 p-4 text-white"><div className="mb-2 flex items-center justify-between gap-2"><Badge variant="secondary" className="border-white/10 bg-black/35 text-white backdrop-blur-sm">{crop.category??crop.default_cycle_type??(es?"Cultivo":"Crop")}</Badge><Provenance profile={crop} es={es}/></div><h3 className="text-xl font-semibold tracking-[-.025em]">{crop.crop_name}</h3><p className="text-xs italic text-white/65">{crop.scientific_name??crop.crop_family??""}</p></div></div><CardContent className="space-y-4 p-4"><div className="grid grid-cols-4 gap-2 text-sm"><Datum label={es?"Madurez":"Maturity"} value={crop.days_to_maturity?`${crop.days_to_maturity}d`:"—"}/><Datum label={es?"Vivero":"Nursery"} value={crop.nursery_days!=null?`${crop.nursery_days}d`:"—"}/><Datum label={es?"Germ.":"Germ."} value={crop.germination_rate_pct!=null?`${crop.germination_rate_pct}%`:"—"}/><Datum label={es?"Obs.":"Obs."} value={String(crop.observed_count)}/></div>{cultivars.length>0&&<div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{es?"Cultivares":"Cultivars"}</p><div className="flex flex-wrap gap-2">{cultivars.slice(0,4).map(v=><Badge key={v.id} variant="outline">{v.variety}</Badge>)}{cultivars.length>4&&<Badge variant="outline">+{cultivars.length-4}</Badge>}</div></div>}{crop.source_url&&<a href={crop.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">{crop.source_name??(es?"Ver fuente":"View source")}<ExternalLink className="h-3 w-3"/></a>}</CardContent></Card>
}
function Provenance({profile,es}:{profile:CropProfile;es:boolean}){if(profile.provenance_type==="reference")return <Badge className="gap-1"><ShieldCheck className="h-3 w-3"/>{es?"Referencia":"Reference"}</Badge>;if(profile.provenance_type==="observed")return <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3"/>{es?"Observado":"Observed"}</Badge>;return <Badge variant="outline">{es?"Manual":"Manual"}</Badge>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>}
function Num({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <Field label={label}><Input type="number" step="0.1" value={value} onChange={e=>set(e.target.value)}/></Field>}
function Metric({label,value}:{label:string;value:number}){return <Card className="border-white/10 bg-card/75"><CardContent className="flex h-full min-h-[62px] flex-col justify-center p-4"><p className="text-2xl font-semibold tracking-[-.03em]">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>}
function Datum({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>}

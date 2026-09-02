"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarPlus, Search, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { cropColor, cropChipStyle } from "@/lib/orchard/crop-identity"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Plan={id:string;name:string;season:string|null;status:string}
type CropProfile={id:string;crop_name:string;scientific_name:string|null;crop_family:string|null;default_cycle_type:string|null;days_to_maturity:number|null;observed_count:number;provenance_type:string}
type Photo={crop_name:string;photo_url:string|null;storage_public_url:string|null;verification_status:string}
type Cycle={id:string;game_plan_id:string;crop_name:string}
type Succession={id:string;crop_cycle_id:string}
type CycleLabels={direct:string;transplant:string;perennial:string;cover:string}

const copy={
 en:{title:"Crop selection",description:"Choose crops from the canonical Corcovado library, see what is already in the selected season and enter planning without leaving the operating context.",search:"Search crops…",all:"All crops",inPlan:"In this plan",showCatalog:"View full catalog",backToPlan:"Back to current plan",field:"In field",library:"Advanced library",plantings:"plantings",planting:"planting",add:"Add planting",openPlan:"Open plan",empty:"No crops match this view.",season:"Season",direct:"Direct sow",transplant:"Transplant",perennial:"Perennial",cover:"Cover crop",days:"days",canonical:"Corcovado canonical",noVerifiedPhoto:"No verified photo"},
 es:{title:"Selección de cultivos",description:"Elige cultivos desde la biblioteca canónica Corcovado, identifica cuáles ya están en la temporada seleccionada y entra a planificación sin perder el contexto operativo.",search:"Buscar cultivos…",all:"Todos los cultivos",inPlan:"En este plan",showCatalog:"Ver catálogo completo",backToPlan:"Volver al plan",field:"En terreno",library:"Biblioteca avanzada",plantings:"plantaciones",planting:"plantación",add:"Agregar plantación",openPlan:"Abrir plan",empty:"No hay cultivos para esta vista.",season:"Temporada",direct:"Siembra directa",transplant:"Trasplante",perennial:"Perenne",cover:"Cobertura",days:"días",canonical:"Canónico Corcovado",noVerifiedPhoto:"Sin foto verificada"},
 de:{title:"Kulturauswahl",description:"Kulturen aus der kanonischen Corcovado-Bibliothek wählen, Saisonbelegung erkennen und direkt in die Planung wechseln.",search:"Kulturen suchen…",all:"Alle Kulturen",inPlan:"In diesem Plan",showCatalog:"Gesamten Katalog anzeigen",backToPlan:"Zurück zum aktuellen Plan",field:"Im Feld",library:"Erweiterte Bibliothek",plantings:"Pflanzungen",planting:"Pflanzung",add:"Pflanzung hinzufügen",openPlan:"Plan öffnen",empty:"Keine Kulturen entsprechen dieser Ansicht.",season:"Saison",direct:"Direktsaat",transplant:"Verpflanzung",perennial:"Mehrjährig",cover:"Zwischenfrucht",days:"Tage",canonical:"Corcovado kanonisch",noVerifiedPhoto:"Kein verifiziertes Foto"},
} as const

function normalized(value:string){return value.trim().toLowerCase()}
function cycleLabel(value:string|null,text:CycleLabels){if(value==="direct_sow")return text.direct;if(value==="transplant")return text.transplant;if(value==="perennial")return text.perennial;if(value==="cover_crop")return text.cover;return "—"}

export default function OrchardCropCatalogPage(){
 const supabase=useMemo(()=>createBrowserClient(),[])
 const {language}=useLanguage();const lang:Locale=language;const text=copy[lang]
 const [plans,setPlans]=useState<Plan[]>([]),[profiles,setProfiles]=useState<CropProfile[]>([]),[photos,setPhotos]=useState<Photo[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([])
 const [query,setQuery]=useState(""),[planOnly,setPlanOnly]=useState(true),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null)

 useEffect(()=>{let live=true;setLoading(true);setError(null);void Promise.all([
  supabase.from("orchard_game_plans").select("id,name,season,status").order("start_date",{ascending:false}),
  supabase.from("orchard_crop_library").select("id,crop_name,scientific_name,crop_family,default_cycle_type,days_to_maturity,observed_count,provenance_type").eq("is_active",true).eq("classification_scheme","black_swan_canonical").eq("classification_code","fundo_corcovado").order("crop_name"),
  supabase.from("orchard_crop_photo_registry").select("crop_name,photo_url,storage_public_url,verification_status").in("verification_status",["verified","approved"]),
  supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name"),
  supabase.from("orchard_crop_successions").select("id,crop_cycle_id").neq("status","cancelled"),
 ]).then(([p,l,ph,c,s])=>{if(!live)return;const first=p.error??l.error??ph.error??c.error??s.error;if(first){setError(first.message);setLoading(false);return}setPlans((p.data??[]) as Plan[]);setProfiles((l.data??[]) as CropProfile[]);setPhotos((ph.data??[]) as Photo[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setLoading(false)});return()=>{live=false}},[supabase])

 const requested=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("game_plan"):null
 const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
 const planCycles=cycles.filter(c=>c.game_plan_id===plan?.id)
 const successionCountByCycle=new Map<string,number>();for(const s of successions)successionCountByCycle.set(s.crop_cycle_id,(successionCountByCycle.get(s.crop_cycle_id)??0)+1)
 const countByCrop=new Map<string,number>();for(const cycle of planCycles){const key=normalized(cycle.crop_name);countByCrop.set(key,(countByCrop.get(key)??0)+(successionCountByCycle.get(cycle.id)??0))}
 const photoByCrop=new Map<string,string>();for(const photo of photos){const url=photo.storage_public_url??photo.photo_url;if(url&&!photoByCrop.has(normalized(photo.crop_name)))photoByCrop.set(normalized(photo.crop_name),url)}
 const filtered=profiles.filter(profile=>{const key=normalized(profile.crop_name);const matches=!query.trim()||`${profile.crop_name} ${profile.scientific_name??""} ${profile.crop_family??""}`.toLowerCase().includes(query.trim().toLowerCase());return matches&&(!planOnly||(countByCrop.get(key)??0)>0)})
 const planHref=`/${language}/orchard/game-plan${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 const calendarHref=`/${language}/orchard/game-plan/season${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 const fieldHref=`/${language}/orchard/crops${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`
 const libraryHref=`/${language}/orchard/library${plan?`?game_plan=${encodeURIComponent(plan.id)}`:""}`

 return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1580px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
  <header className="mb-4 flex flex-col gap-4 border-b border-[var(--orchard-line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
   <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--orchard-green)]">{text.canonical}</p><h1 className="mt-1 text-3xl font-medium">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-5 text-muted-foreground">{text.description}</p></div>
   <div className="flex flex-wrap items-center gap-2"><Link href={fieldHref} className="inline-flex min-h-10 items-center border border-[var(--orchard-line)] px-3 text-sm hover:bg-muted">{text.field}</Link><Link href={libraryHref} className="inline-flex min-h-10 items-center border border-[var(--orchard-line)] px-3 text-sm hover:bg-muted">{text.library}</Link></div>
  </header>
  <section className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
   <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
    <label className="flex min-h-10 w-full max-w-md items-center gap-2 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] px-3"><Search className="h-4 w-4 text-muted-foreground"/><span className="sr-only">{text.search}</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={text.search} className="h-8 w-full border-0 bg-transparent text-sm outline-none"/></label>
    <div className="px-2 text-xs text-muted-foreground">{planOnly?text.inPlan:text.all} · <strong className="font-medium text-foreground">{planOnly?countByCrop.size:profiles.length}</strong></div>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
    <div className="text-xs text-muted-foreground">{text.season}: <strong className="font-medium text-foreground">{plan?.season??"—"}</strong></div>
    <button type="button" aria-expanded={!planOnly} onClick={()=>setPlanOnly(value=>!value)} className="inline-flex min-h-10 items-center border border-[var(--orchard-line)] px-3 text-sm font-medium hover:bg-muted">{planOnly?`${text.showCatalog} · ${profiles.length}`:`${text.backToPlan} · ${countByCrop.size}`}</button>
   </div>
  </section>

  {loading?<div className="py-12 text-sm text-muted-foreground">…</div>:error?<div className="border-y border-red-400/30 py-4 text-sm text-red-300">{error}</div>:filtered.length===0?<div className="border-y border-[var(--orchard-line)] py-10 text-sm text-muted-foreground">{text.empty}</div>:<section className="grid grid-cols-2 gap-px bg-[var(--orchard-line)] md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
   {filtered.map(profile=>{const key=normalized(profile.crop_name);const count=countByCrop.get(key)??0;const image=photoByCrop.get(key);const identity=cropChipStyle(profile.crop_name,profile.crop_family);const color=cropColor(profile.crop_name,profile.crop_family);return <article key={profile.id} className="overflow-hidden bg-[var(--bs-surface-primary)]" style={{boxShadow:`inset 3px 0 0 ${color}`}}>
    <div className="relative h-28 overflow-hidden" style={{backgroundColor:color}}>{image?<img src={image} alt={profile.crop_name} className="h-full w-full object-cover" loading="lazy"/>:<div className="flex h-full flex-col items-center justify-center gap-2"><Sprout className="h-10 w-10 text-white/70"/><span className="text-[10px] uppercase tracking-[.12em] text-white/65">{text.noVerifiedPhoto}</span></div>}<span className="absolute right-2 top-2 bg-black/55 px-2 py-1 text-[10px] text-white">{cycleLabel(profile.default_cycle_type,text)}</span></div>
    <div className="p-3"><h2 className="line-clamp-2 min-h-[2.6em] text-base font-medium leading-[1.3]" title={profile.crop_name}>{profile.crop_name}</h2><p className="mt-1 min-h-5 line-clamp-1 text-xs italic text-muted-foreground">{profile.crop_family??profile.scientific_name??(profile.days_to_maturity?`${profile.days_to_maturity} ${text.days}`:"Corcovado")}</p>
     <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--orchard-line-soft)] pt-3">{count>0?<Link href={calendarHref} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium" style={{color:identity.color}}><ArrowRight className="h-3.5 w-3.5"/>{count} {count===1?text.planting:text.plantings}</Link>:<span className="text-xs text-muted-foreground">0 {text.plantings}</span>}<Link href={planHref} className="inline-flex min-h-9 items-center gap-1.5 px-2.5 text-xs font-medium text-white" style={{backgroundColor:color}}><CalendarPlus className="h-3.5 w-3.5"/>{count?text.openPlan:text.add}</Link></div>
    </div>
   </article>})}
  </section>}
 </main></AppLayout>
}

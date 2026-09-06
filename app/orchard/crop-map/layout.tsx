"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { CheckCircle2, MapPin, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type FocusedAllocation={id:string;bed_id:string;crop_succession_id:string;planned_start_date:string;planned_end_date:string;allocated_area_sqm:number|null;planned_plants:number|null}
type Bed={id:string;plot_id:string;name:string;code:string|null};type Plot={id:string;name:string};type Succession={id:string;crop_cycle_id:string;sequence_no:number};type Cycle={id:string;crop_name:string;variety:string|null}
const copy={en:{succession:"Allocated succession",created:"Allocation created by Orchard AI",badge:"Created",plants:"plants"},es:{succession:"Sucesión asignada",created:"Asignación creada por Orchard AI",badge:"Creada",plants:"plantas"},de:{succession:"Zugeordnete Folge",created:"Zuordnung von Orchard AI erstellt",badge:"Erstellt",plants:"Pflanzen"}} as const

export default function CropMapLayout({children}:{children:ReactNode}){
 const supabase=useMemo(()=>createBrowserClient(),[]);const pathname=usePathname();const rootCropMap=/\/orchard\/crop-map\/?$/.test(pathname);const{language}=useLanguage();const text=copy[language];const[entityId,setEntityId]=useState<string|null>(null),[allocation,setAllocation]=useState<FocusedAllocation|null>(null),[bed,setBed]=useState<Bed|null>(null),[plot,setPlot]=useState<Plot|null>(null),[succession,setSuccession]=useState<Succession|null>(null),[cycle,setCycle]=useState<Cycle|null>(null)
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get("from")==="orchard-ai")setEntityId(params.get("entity"))},[])
 useEffect(()=>{if(!entityId)return;let cancelled=false;async function loadFocus(){const allocationResult=await supabase.from("orchard_bed_allocations").select("id,bed_id,crop_succession_id,planned_start_date,planned_end_date,allocated_area_sqm,planned_plants").eq("id",entityId).maybeSingle();if(cancelled||allocationResult.error||!allocationResult.data)return;const nextAllocation=allocationResult.data as FocusedAllocation;const[bedResult,successionResult]=await Promise.all([supabase.from("orchard_beds").select("id,plot_id,name,code").eq("id",nextAllocation.bed_id).maybeSingle(),supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no").eq("id",nextAllocation.crop_succession_id).maybeSingle()]);if(cancelled)return;const nextBed=(bedResult.data??null) as Bed|null,nextSuccession=(successionResult.data??null) as Succession|null;setAllocation(nextAllocation);setBed(nextBed);setSuccession(nextSuccession);const[plotResult,cycleResult]=await Promise.all([nextBed?supabase.from("orchard_plots").select("id,name").eq("id",nextBed.plot_id).maybeSingle():Promise.resolve({data:null}),nextSuccession?supabase.from("orchard_crop_cycles").select("id,crop_name,variety").eq("id",nextSuccession.crop_cycle_id).maybeSingle():Promise.resolve({data:null})]);if(cancelled)return;setPlot((plotResult.data??null) as Plot|null);setCycle((cycleResult.data??null) as Cycle|null)}void loadFocus();return()=>{cancelled=true}},[entityId,supabase])
 const cropLabel=cycle?`${cycle.crop_name}${cycle.variety?` · ${cycle.variety}`:""}${succession?` #${succession.sequence_no}`:""}`:text.succession;const bedLabel=bed?`${plot?.name?`${plot.name} · `:""}${bed.name}${bed.code?` · ${bed.code}`:""}`:"—"
 return <div className={rootCropMap?"orchard-crop-map-parity":undefined}>{rootCropMap&&<style>{`
@media (min-width: 768px) {
  .orchard-crop-map-parity [data-slot="page-header"][data-orchard-hero="true"] > div:last-child {
    min-height: 104px !important;
    gap: 12px !important;
    padding-top: 12px !important;
    padding-bottom: 12px !important;
  }
  .orchard-crop-map-parity [data-slot="page-header"][data-orchard-hero="true"] > div:last-child > div:first-child {
    gap: 4px !important;
  }
  .orchard-crop-map-parity [data-slot="page-header"][data-orchard-hero="true"] > div:last-child > div:first-child > p,
  .orchard-crop-map-parity [data-slot="page-header"][data-orchard-hero="true"] > div:last-child > div:first-child > div:last-child {
    display: none !important;
  }
  .orchard-crop-map-parity [data-slot="page-header"][data-orchard-hero="true"] h1 {
    font-size: 1.625rem !important;
    line-height: 1.15 !important;
  }
  .orchard-crop-map-parity [data-slot="page-header"] ~ [data-orchard-navigation] + div[class~="space-y-6"] {
    display: flex !important;
    width: 100%;
    max-width: 1560px;
    margin-inline: auto;
    flex-direction: column;
    gap: 12px !important;
    padding: 12px 16px 28px !important;
  }
  .orchard-crop-map-parity [data-slot="page-header"] ~ [data-orchard-navigation] + div[class~="space-y-6"] > * {
    margin-top: 0 !important;
  }
  .orchard-crop-map-parity [data-slot="page-header"] ~ [data-orchard-navigation] + div[class~="space-y-6"] > [class*="border-destructive"] {
    order: -20;
  }
  .orchard-crop-map-parity [data-slot="page-header"] ~ [data-orchard-navigation] + div[class~="space-y-6"] > section:first-of-type {
    order: -10;
    margin: 0 !important;
  }
  .orchard-crop-map-parity section:first-of-type > div:first-child {
    display: flex;
    min-height: 28px;
    align-items: center;
    gap: 12px;
  }
  .orchard-crop-map-parity section:first-of-type > div:first-child > p {
    margin-top: 0 !important;
    font-size: 11px !important;
    line-height: 1.35 !important;
  }
  .orchard-crop-map-parity section:first-of-type > div:last-child {
    gap: 8px !important;
  }
  .orchard-crop-map-parity section:first-of-type > div:last-child > div[class*="overflow-hidden"] {
    border-radius: 5px !important;
    box-shadow: none !important;
  }
  .orchard-crop-map-parity section:first-of-type > div:last-child > div[class*="overflow-hidden"] > div:first-child {
    height: 92px !important;
  }
  .orchard-crop-map-parity section:first-of-type > div:last-child > div[class*="overflow-hidden"] > div:last-child {
    gap: 6px !important;
    padding: 8px !important;
  }
  .orchard-crop-map-parity section:first-of-type img {
    opacity: .2 !important;
    filter: saturate(.55) contrast(.92) !important;
  }
  .orchard-crop-map-parity section:first-of-type div[class*="rounded-xl"][class*="border"][class*="p-3"] {
    min-height: 74px;
    border-radius: 4px !important;
    padding: 8px !important;
  }
  .orchard-crop-map-parity section:first-of-type div[class*="rounded-xl"][class*="border"][class*="p-3"] p[class*="font-medium"] {
    font-size: 13px !important;
    line-height: 1.2 !important;
  }
  .orchard-crop-map-parity section:first-of-type div[class*="rounded-xl"][class*="border"][class*="p-3"] div[class*="mt-5"] {
    margin-top: 10px !important;
  }
  .orchard-crop-map-parity div[class~="xl:grid-cols-4"] {
    gap: 8px !important;
  }
  .orchard-crop-map-parity div[class~="xl:grid-cols-4"] > div {
    box-shadow: none !important;
  }
}
@media (min-width: 1280px) {
  .orchard-crop-map-parity section:first-of-type > div:last-child {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }
}
`}</style>}{allocation&&<div className="sticky top-0 z-[45] border-b border-primary/40 bg-background/95 px-4 py-3 backdrop-blur sm:px-8"><Card className="mx-auto max-w-[1500px] border-primary/40 bg-primary/5 shadow-lg"><CardContent className="flex flex-wrap items-center gap-4 p-4"><div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Sparkles className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{text.created}</p><Badge><CheckCircle2 className="mr-1 h-3.5 w-3.5"/>{text.badge}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{cropLabel} · {bedLabel}</p><p className="mt-1 text-xs text-muted-foreground">{allocation.planned_start_date} → {allocation.planned_end_date}{allocation.allocated_area_sqm!=null?` · ${allocation.allocated_area_sqm} m²`:""}{allocation.planned_plants!=null?` · ${allocation.planned_plants} ${text.plants}`:""}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4"/>ID: {allocation.id}</div></CardContent></Card></div>}{children}</div>
}
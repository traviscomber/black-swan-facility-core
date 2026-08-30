"use client"

import { useState } from "react"
import Link from "next/link"
import { BookOpenCheck, Database, ExternalLink, Import, RefreshCw, Search, ShieldCheck, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type FaoItem = { externalId:string; name:string; scientificName:string|null; iccCode:string|null }
type Payload = { source:{name:string;publisher:string;sourcePage:string;datasetUrl:string}; totalRows:number; items:FaoItem[]; error?:string }
type SyncPayload = { status?:string; fetched?:number; upserted?:number; skipped?:number; runId?:string; error?:string; detail?:string }

export default function FaoCropCatalogPage(){
  const {language}=useLanguage();const es=language==="es";const supabase=createBrowserClient()
  const [query,setQuery]=useState("");const [payload,setPayload]=useState<Payload|null>(null);const [loading,setLoading]=useState(false);const [message,setMessage]=useState<string|null>(null);const [importing,setImporting]=useState<string|null>(null);const [syncing,setSyncing]=useState(false);const [lastSync,setLastSync]=useState<SyncPayload|null>(null)
  async function search(){setLoading(true);setMessage(null);try{const r=await fetch(`/api/orchard/library/fao?q=${encodeURIComponent(query)}&limit=100`,{cache:"no-store"});const data=await r.json() as Payload;if(!r.ok)throw new Error(data.error||"FAO crop list unavailable");setPayload(data)}catch(e){setMessage(e instanceof Error?e.message:"FAO crop list unavailable")}finally{setLoading(false)}}
  async function importStub(item:FaoItem){
    setImporting(item.externalId);setMessage(null)
    const existing=await supabase.from("orchard_crop_library").select("id,external_source,external_id").ilike("crop_name",item.name).limit(1).maybeSingle()
    if(existing.error){setMessage(existing.error.message);setImporting(null);return}
    const reference={external_source:"fao_wca_2020",external_id:item.externalId,classification_scheme:item.iccCode?"FAO ICC 1.1":null,classification_code:item.iccCode}
    const r=existing.data
      ? (existing.data.external_source||existing.data.external_id
          ? {error:new Error(es?"Este cultivo ya tiene otra identidad externa; no se sobrescribió.":"This crop already has another external identity; it was not overwritten.")}
          : await supabase.from("orchard_crop_library").update(reference).eq("id",existing.data.id))
      : await supabase.from("orchard_crop_library").insert({crop_name:item.name,scientific_name:item.scientificName,source_name:"FAO WCA 2020 Crop List",source_url:"https://www.fao.org/statistics/caliper/classifications/wca/en",source_verified_at:new Date().toISOString(),provenance_type:"reference",...reference})
    if(r.error)setMessage(r.error.message);else setMessage(es?`${item.name} vinculado a la lista canónica WCA. No se inventaron valores agronómicos.`:`${item.name} linked to the canonical WCA crop list. No agronomic values were invented.`)
    setImporting(null)
  }
  async function syncAll(){
    setSyncing(true);setMessage(null);setLastSync(null)
    try{const r=await fetch("/api/orchard/library/fao/sync",{method:"POST"});const data=await r.json() as SyncPayload;if(!r.ok)throw new Error(data.detail||data.error||"FAO sync failed");setLastSync(data);setMessage(es?`Sincronización completa: ${data.upserted??0} actualizados, ${data.skipped??0} sin cambios.`:`Sync complete: ${data.upserted??0} updated, ${data.skipped??0} unchanged.`)}catch(e){setMessage(e instanceof Error?e.message:"FAO sync failed")}finally{setSyncing(false)}
  }

  return <AppLayout>
    <PageHeader title={es?"Catálogo FAO":"FAO Crop Catalog"} description={es?"Lista canónica de cultivos WCA 2020 con nombres botánicos y correspondencia ICC, separada de los valores agronómicos de ECOCROP.":"Canonical WCA 2020 crop list with botanical names and ICC correspondence, kept separate from ECOCROP agronomic values."}/>
    <OrchardNavigation/>
    <div className="space-y-6 p-3 pb-24 sm:p-8">
      {message&&<Card className="border-primary/20"><CardContent className="p-4 text-sm">{message}</CardContent></Card>}

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-white/10 bg-card/80"><CardContent className="flex min-h-[132px] flex-col justify-between p-5"><ShieldCheck className="h-5 w-5 text-emerald-400"/><div><p className="text-2xl font-semibold">WCA 2020</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{es?"Identidad oficial del cultivo y nomenclatura de referencia.":"Official crop identity and reference nomenclature."}</p></div></CardContent></Card>
        <Card className="border-white/10 bg-card/80"><CardContent className="flex min-h-[132px] flex-col justify-between p-5"><BookOpenCheck className="h-5 w-5 text-emerald-400"/><div><p className="text-2xl font-semibold">ICC 1.1</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{es?"Clasificación canónica sin mezclar datos agronómicos no presentes en la fuente.":"Canonical classification without inventing agronomic values absent from the source."}</p></div></CardContent></Card>
        <Card className="border-white/10 bg-card/80"><CardContent className="flex min-h-[132px] flex-col justify-between p-5"><Sprout className="h-5 w-5 text-emerald-400"/><div><p className="text-2xl font-semibold">ECOCROP</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{es?"Fuente separada para requerimientos ambientales y de cultivo.":"Separate source for environmental and crop requirements."}</p></div></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="overflow-hidden border-primary/20 bg-card/85">
          <CardHeader className="border-b border-white/10 bg-primary/[.035]"><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5"/>{es?"Sincronización de referencia":"Reference sync"}</CardTitle><CardDescription>{es?"Actualiza identidad FAO sin reemplazar observaciones locales ni valores agronómicos internos.":"Refresh FAO identity without replacing local observations or internal agronomic values."}</CardDescription></CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-2 gap-3 text-sm"><div className="border border-white/10 bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{es?"Fuente":"Source"}</p><p className="mt-1 font-medium">FAO WCA 2020</p></div><div className="border border-white/10 bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{es?"Modo":"Mode"}</p><p className="mt-1 font-medium">Idempotent + audited</p></div></div>
            <Button className="w-full" onClick={()=>void syncAll()} disabled={syncing}>{syncing?<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>:<Database className="mr-2 h-4 w-4"/>}{syncing?(es?"Sincronizando":"Syncing"):(es?"Sincronizar WCA 2020":"Sync WCA 2020")}</Button>
            {lastSync&&<div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="border border-white/10 p-3"><p className="text-lg font-semibold">{lastSync.fetched??0}</p><p className="text-xs text-muted-foreground">{es?"leídos":"fetched"}</p></div><div className="border border-white/10 p-3"><p className="text-lg font-semibold">{lastSync.upserted??0}</p><p className="text-xs text-muted-foreground">{es?"actualizados":"updated"}</p></div><div className="border border-white/10 p-3"><p className="text-lg font-semibold">{lastSync.skipped??0}</p><p className="text-xs text-muted-foreground">{es?"sin cambios":"unchanged"}</p></div></div>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-card/85">
          <CardHeader className="border-b border-white/10"><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5"/>{es?"Explorar lista oficial":"Browse official catalog"}</CardTitle><CardDescription>{es?"Busca por nombre común o botánico. Cada resultado conserva identidad externa, nombre científico y código ICC.":"Search by common or botanical name. Every result preserves external identity, scientific name and ICC code."}</CardDescription></CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex gap-2"><Input className="h-11" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void search()}} placeholder={es?"Buscar tomate, quinoa, manzana...":"Search tomato, quinoa, apple..."}/><Button className="h-11 px-5" onClick={()=>void search()} disabled={loading}><Search className="mr-2 h-4 w-4"/>{loading?(es?"Buscando":"Searching"):(es?"Buscar":"Search")}</Button></div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">WCA 2020</Badge><Badge variant="outline">ICC 1.1</Badge><Badge variant="outline">{es?"Procedencia preservada":"Provenance preserved"}</Badge>{payload&&<span className="ml-auto">{payload.totalRows.toLocaleString()} {es?"cultivos únicos":"unique crops"}</span>}</div>
            {payload&&<Button asChild variant="link" className="h-auto p-0"><a href={payload.source.sourcePage} target="_blank" rel="noreferrer">{payload.source.name}<ExternalLink className="ml-1 h-3 w-3"/></a></Button>}
          </CardContent>
        </Card>
      </section>

      {payload&&<section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{es?"Resultados oficiales":"Official results"}</p><h2 className="text-xl font-semibold">{es?"Identidades de cultivo":"Crop identities"}</h2></div><p className="hidden text-sm text-muted-foreground md:block">{payload.items.length} {es?"resultados mostrados":"results shown"}</p></div><div className="grid gap-3 lg:grid-cols-2">{payload.items.map(item=><Card key={item.externalId} className="border-white/10 bg-card/80"><CardContent className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-base font-semibold">{item.name}</p><p className="mt-1 text-sm italic text-muted-foreground">{item.scientificName||"—"}</p><div className="mt-3 flex flex-wrap gap-2">{item.iccCode&&<Badge variant="outline">ICC {item.iccCode}</Badge>}<Badge variant="secondary" className="font-mono text-[10px]">{item.externalId}</Badge></div></div><Button size="sm" disabled={importing===item.externalId} onClick={()=>void importStub(item)}><Import className="mr-2 h-4 w-4"/>{es?"Importar":"Import"}</Button></CardContent></Card>)}</div></section>}

      <Card className="border-white/10 bg-muted/10"><CardHeader><CardTitle>{es?"Regla de procedencia":"Provenance rule"}</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm text-muted-foreground lg:grid-cols-[1fr_auto]"><div className="space-y-2"><p>{es?"WCA crea identidad canónica, nombre botánico y correspondencia ICC. No crea días de madurez, temperaturas, espaciamiento, germinación o rendimiento porque WCA no es la fuente de esos valores.":"WCA creates canonical identity, botanical name and ICC correspondence. It does not create maturity days, temperatures, spacing, germination or yield because WCA is not the source of those values."}</p><p>{es?"Para requisitos ambientales y de cultivo usamos ECOCROP como fuente separada y guardamos cada referencia con URL y fecha de verificación.":"For environmental and crop requirements we use ECOCROP as a separate source and keep each reference with URL and verification date."}</p></div><div className="flex flex-wrap items-start gap-2"><Button asChild variant="outline"><a href="https://ecocrop.apps.fao.org/ecocrop/srv/en/home" target="_blank" rel="noreferrer">ECOCROP<ExternalLink className="ml-2 h-4 w-4"/></a></Button><Button asChild variant="outline"><Link href={`/${language}/orchard/library`}>{es?"Volver a biblioteca":"Back to library"}</Link></Button></div></CardContent></Card>
    </div>
  </AppLayout>
}

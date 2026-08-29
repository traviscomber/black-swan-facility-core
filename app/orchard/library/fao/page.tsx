"use client"

import { useState } from "react"
import Link from "next/link"
import { Database, ExternalLink, Import, RefreshCw, Search } from "lucide-react"
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
  return <AppLayout><PageHeader title={es?"Catálogo FAO":"FAO Crop Catalog"} description={es?"Lista canónica de cultivos WCA 2020 con nombres botánicos y correspondencia ICC, separada de los valores agronómicos de ECOCROP.":"Canonical WCA 2020 crop list with botanical names and ICC correspondence, kept separate from ECOCROP agronomic values."}/><OrchardNavigation/><div className="space-y-6 p-3 pb-24 sm:p-8">
    {message&&<Card><CardContent className="p-4 text-sm">{message}</CardContent></Card>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5"/>{es?"Sincronización de referencia":"Reference sync"}</CardTitle><CardDescription>{es?"Solo administradores pueden sincronizar la lista completa. El proceso es idempotente, auditado y preserva cultivos observados/locales: agrega identidad FAO sin reemplazar sus datos agronómicos.":"Only administrators can sync the full list. The process is idempotent and audited, and preserves observed/local crops: it adds FAO identity without replacing their agronomic data."}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><Button onClick={()=>void syncAll()} disabled={syncing}>{syncing?<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>:<Database className="mr-2 h-4 w-4"/>}{syncing?(es?"Sincronizando":"Syncing"):(es?"Sincronizar WCA 2020":"Sync WCA 2020")}</Button>{lastSync&&<div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">{lastSync.fetched??0} {es?"leídos":"fetched"}</Badge><Badge variant="outline">{lastSync.upserted??0} {es?"actualizados":"updated"}</Badge><Badge variant="outline">{lastSync.skipped??0} {es?"sin cambios":"unchanged"}</Badge></div>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/>{es?"Explorar lista oficial de cultivos":"Browse official crop list"}</CardTitle><CardDescription>{es?"WCA aporta identidad de cultivo y nombre botánico; ICC aporta clasificación. ECOCROP se mantiene como referencia ambiental/agronómica separada.":"WCA provides crop identity and botanical name; ICC provides classification. ECOCROP remains a separate environmental/agronomic reference."}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void search()}} placeholder={es?"Buscar tomate, quinoa, manzana...":"Search tomato, quinoa, apple..."}/><Button onClick={()=>void search()} disabled={loading}><Search className="mr-2 h-4 w-4"/>{loading?(es?"Buscando":"Searching"):(es?"Buscar":"Search")}</Button></div>{payload&&<div className="flex flex-wrap gap-2 text-sm text-muted-foreground"><Badge variant="outline">{payload.source.name}</Badge><span>{payload.totalRows.toLocaleString()} {es?"cultivos únicos disponibles":"unique crops available"}</span><Button asChild variant="link" className="h-auto p-0"><a href={payload.source.sourcePage} target="_blank" rel="noreferrer">FAO source<ExternalLink className="ml-1 h-3 w-3"/></a></Button></div>}</CardContent></Card>
    {payload&&<div className="grid gap-3 lg:grid-cols-2">{payload.items.map(item=><Card key={item.externalId}><CardContent className="flex items-start justify-between gap-4 p-4"><div><p className="font-semibold">{item.name}</p><p className="text-sm italic text-muted-foreground">{item.scientificName||"—"}</p><div className="mt-2 flex flex-wrap gap-2">{item.iccCode&&<Badge variant="outline">ICC {item.iccCode}</Badge>}<span className="font-mono text-xs text-muted-foreground">{item.externalId}</span></div></div><Button size="sm" disabled={importing===item.externalId} onClick={()=>void importStub(item)}><Import className="mr-2 h-4 w-4"/>{es?"Importar":"Import"}</Button></CardContent></Card>)}</div>}
    <Card><CardHeader><CardTitle>{es?"Regla de procedencia":"Provenance rule"}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>{es?"WCA crea identidad canónica, nombre botánico y correspondencia ICC. No crea días de madurez, temperaturas, espaciamiento, germinación o rendimiento porque WCA no es la fuente de esos valores.":"WCA creates canonical identity, botanical name and ICC correspondence. It does not create maturity days, temperatures, spacing, germination or yield because WCA is not the source of those values."}</p><p>{es?"Para requisitos ambientales y de cultivo usamos ECOCROP como fuente separada y guardamos cada referencia con URL y fecha de verificación.":"For environmental and crop requirements we use ECOCROP as a separate source and keep each reference with its URL and verification date."}</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><a href="https://ecocrop.apps.fao.org/ecocrop/srv/en/home" target="_blank" rel="noreferrer">ECOCROP<ExternalLink className="ml-2 h-4 w-4"/></a></Button><Button asChild variant="outline"><Link href={`/${language}/orchard/library`}>{es?"Volver a biblioteca":"Back to library"}</Link></Button></div></CardContent></Card>
  </div></AppLayout>
}

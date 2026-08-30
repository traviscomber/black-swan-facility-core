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
import { useLanguage, type Language } from "@/lib/hooks/use-language"

type FaoItem = { externalId:string; name:string; scientificName:string|null; iccCode:string|null }
type Payload = { source:{name:string;publisher:string;sourcePage:string;datasetUrl:string}; totalRows:number; items:FaoItem[]; error?:string }
type SyncPayload = { status?:string; fetched?:number; upserted?:number; skipped?:number; runId?:string; error?:string; detail?:string }

const copy:Record<Language,Record<string,string>>={
 en:{unavailable:"FAO crop list unavailable",identityConflict:"This crop already has another external identity; it was not overwritten.",linked:"{name} linked to the canonical WCA crop list. No agronomic values were invented.",syncFailed:"FAO sync failed",syncComplete:"Sync complete: {updated} updated, {skipped} unchanged.",title:"FAO Crop Catalog",description:"Canonical WCA 2020 crop list with botanical names and ICC correspondence, kept separate from ECOCROP agronomic values.",officialIdentity:"Official crop identity and reference nomenclature.",canonicalClassification:"Canonical classification without inventing agronomic values absent from the source.",ecocropSource:"Separate source for environmental and crop requirements.",referenceSync:"Reference sync",referenceSyncDescription:"Refresh FAO identity without replacing local observations or internal agronomic values.",source:"Source",mode:"Mode",syncing:"Syncing",syncWca:"Sync WCA 2020",fetched:"fetched",updated:"updated",unchanged:"unchanged",browse:"Browse official catalog",browseDescription:"Search by common or botanical name. Every result preserves external identity, scientific name and ICC code.",searchPlaceholder:"Search tomato, quinoa, apple...",searching:"Searching",search:"Search",provenancePreserved:"Provenance preserved",uniqueCrops:"unique crops",officialResults:"Official results",cropIdentities:"Crop identities",resultsShown:"results shown",import:"Import",provenanceRule:"Provenance rule",ruleOne:"WCA creates canonical identity, botanical name and ICC correspondence. It does not create maturity days, temperatures, spacing, germination or yield because WCA is not the source of those values.",ruleTwo:"For environmental and crop requirements we use ECOCROP as a separate source and keep each reference with URL and verification date.",back:"Back to library"},
 es:{unavailable:"Lista de cultivos FAO no disponible",identityConflict:"Este cultivo ya tiene otra identidad externa; no se sobrescribió.",linked:"{name} vinculado a la lista canónica WCA. No se inventaron valores agronómicos.",syncFailed:"Falló la sincronización FAO",syncComplete:"Sincronización completa: {updated} actualizados, {skipped} sin cambios.",title:"Catálogo FAO",description:"Lista canónica de cultivos WCA 2020 con nombres botánicos y correspondencia ICC, separada de los valores agronómicos de ECOCROP.",officialIdentity:"Identidad oficial del cultivo y nomenclatura de referencia.",canonicalClassification:"Clasificación canónica sin mezclar datos agronómicos no presentes en la fuente.",ecocropSource:"Fuente separada para requerimientos ambientales y de cultivo.",referenceSync:"Sincronización de referencia",referenceSyncDescription:"Actualiza identidad FAO sin reemplazar observaciones locales ni valores agronómicos internos.",source:"Fuente",mode:"Modo",syncing:"Sincronizando",syncWca:"Sincronizar WCA 2020",fetched:"leídos",updated:"actualizados",unchanged:"sin cambios",browse:"Explorar lista oficial",browseDescription:"Busca por nombre común o botánico. Cada resultado conserva identidad externa, nombre científico y código ICC.",searchPlaceholder:"Buscar tomate, quinoa, manzana...",searching:"Buscando",search:"Buscar",provenancePreserved:"Procedencia preservada",uniqueCrops:"cultivos únicos",officialResults:"Resultados oficiales",cropIdentities:"Identidades de cultivo",resultsShown:"resultados mostrados",import:"Importar",provenanceRule:"Regla de procedencia",ruleOne:"WCA crea identidad canónica, nombre botánico y correspondencia ICC. No crea días de madurez, temperaturas, espaciamiento, germinación o rendimiento porque WCA no es la fuente de esos valores.",ruleTwo:"Para requisitos ambientales y de cultivo usamos ECOCROP como fuente separada y guardamos cada referencia con URL y fecha de verificación.",back:"Volver a biblioteca"},
 de:{unavailable:"FAO-Kulturliste nicht verfügbar",identityConflict:"Diese Kultur besitzt bereits eine andere externe Identität; sie wurde nicht überschrieben.",linked:"{name} wurde mit der kanonischen WCA-Kulturliste verknüpft. Es wurden keine agronomischen Werte erfunden.",syncFailed:"FAO-Synchronisierung fehlgeschlagen",syncComplete:"Synchronisierung abgeschlossen: {updated} aktualisiert, {skipped} unverändert.",title:"FAO-Kulturkatalog",description:"Kanonische WCA-2020-Kulturliste mit botanischen Namen und ICC-Zuordnung, getrennt von den agronomischen ECOCROP-Werten.",officialIdentity:"Offizielle Kulturidentität und Referenznomenklatur.",canonicalClassification:"Kanonische Klassifizierung ohne agronomische Werte zu erfinden, die in der Quelle nicht vorhanden sind.",ecocropSource:"Separate Quelle für Umwelt- und Anbauanforderungen.",referenceSync:"Referenz synchronisieren",referenceSyncDescription:"FAO-Identität aktualisieren, ohne lokale Beobachtungen oder interne agronomische Werte zu ersetzen.",source:"Quelle",mode:"Modus",syncing:"Synchronisierung läuft",syncWca:"WCA 2020 synchronisieren",fetched:"gelesen",updated:"aktualisiert",unchanged:"unverändert",browse:"Offiziellen Katalog durchsuchen",browseDescription:"Suche nach gebräuchlichem oder botanischem Namen. Jedes Ergebnis behält externe Identität, wissenschaftlichen Namen und ICC-Code.",searchPlaceholder:"Tomate, Quinoa, Apfel suchen...",searching:"Suche läuft",search:"Suchen",provenancePreserved:"Herkunft erhalten",uniqueCrops:"eindeutige Kulturen",officialResults:"Offizielle Ergebnisse",cropIdentities:"Kulturidentitäten",resultsShown:"angezeigte Ergebnisse",import:"Importieren",provenanceRule:"Herkunftsregel",ruleOne:"WCA erstellt kanonische Identität, botanischen Namen und ICC-Zuordnung. Reifezeiten, Temperaturen, Abstände, Keimung oder Ertrag werden nicht erzeugt, weil WCA nicht die Quelle dieser Werte ist.",ruleTwo:"Für Umwelt- und Anbauanforderungen verwenden wir ECOCROP als separate Quelle und speichern jede Referenz mit URL und Prüfdatum.",back:"Zur Bibliothek"},
}
const fill=(template:string,values:Record<string,string|number>)=>Object.entries(values).reduce((out,[key,value])=>out.replaceAll(`{${key}}`,String(value)),template)

export default function FaoCropCatalogPage(){
  const {language}=useLanguage();const text=copy[language];const supabase=createBrowserClient()
  const [query,setQuery]=useState("");const [payload,setPayload]=useState<Payload|null>(null);const [loading,setLoading]=useState(false);const [message,setMessage]=useState<string|null>(null);const [importing,setImporting]=useState<string|null>(null);const [syncing,setSyncing]=useState(false);const [lastSync,setLastSync]=useState<SyncPayload|null>(null)
  async function search(){setLoading(true);setMessage(null);try{const r=await fetch(`/api/orchard/library/fao?q=${encodeURIComponent(query)}&limit=100`,{cache:"no-store"});const data=await r.json() as Payload;if(!r.ok)throw new Error(data.error||text.unavailable);setPayload(data)}catch(e){setMessage(e instanceof Error?e.message:text.unavailable)}finally{setLoading(false)}}
  async function importStub(item:FaoItem){
    setImporting(item.externalId);setMessage(null)
    const existing=await supabase.from("orchard_crop_library").select("id,external_source,external_id").ilike("crop_name",item.name).limit(1).maybeSingle()
    if(existing.error){setMessage(existing.error.message);setImporting(null);return}
    const reference={external_source:"fao_wca_2020",external_id:item.externalId,classification_scheme:item.iccCode?"FAO ICC 1.1":null,classification_code:item.iccCode}
    const r=existing.data
      ? (existing.data.external_source||existing.data.external_id
          ? {error:new Error(text.identityConflict)}
          : await supabase.from("orchard_crop_library").update(reference).eq("id",existing.data.id))
      : await supabase.from("orchard_crop_library").insert({crop_name:item.name,scientific_name:item.scientificName,source_name:"FAO WCA 2020 Crop List",source_url:"https://www.fao.org/statistics/caliper/classifications/wca/en",source_verified_at:new Date().toISOString(),provenance_type:"reference",...reference})
    if(r.error)setMessage(r.error.message);else setMessage(fill(text.linked,{name:item.name}))
    setImporting(null)
  }
  async function syncAll(){
    setSyncing(true);setMessage(null);setLastSync(null)
    try{const r=await fetch("/api/orchard/library/fao/sync",{method:"POST"});const data=await r.json() as SyncPayload;if(!r.ok)throw new Error(data.detail||data.error||text.syncFailed);setLastSync(data);setMessage(fill(text.syncComplete,{updated:data.upserted??0,skipped:data.skipped??0}))}catch(e){setMessage(e instanceof Error?e.message:text.syncFailed)}finally{setSyncing(false)}
  }

  return <AppLayout>
    <PageHeader title={text.title} description={text.description}/>
    <OrchardNavigation/>
    <div className="space-y-6 p-3 pb-24 sm:p-8">
      {message&&<Card className="border-primary/20"><CardContent className="p-4 text-sm">{message}</CardContent></Card>}

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-white/10 bg-card/80"><CardContent className="flex min-h-[132px] flex-col justify-between p-5"><ShieldCheck className="h-5 w-5 text-emerald-400"/><div><p className="text-2xl font-semibold">WCA 2020</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.officialIdentity}</p></div></CardContent></Card>
        <Card className="border-white/10 bg-card/80"><CardContent className="flex min-h-[132px] flex-col justify-between p-5"><BookOpenCheck className="h-5 w-5 text-emerald-400"/><div><p className="text-2xl font-semibold">ICC 1.1</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.canonicalClassification}</p></div></CardContent></Card>
        <Card className="border-white/10 bg-card/80"><CardContent className="flex min-h-[132px] flex-col justify-between p-5"><Sprout className="h-5 w-5 text-emerald-400"/><div><p className="text-2xl font-semibold">ECOCROP</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.ecocropSource}</p></div></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="overflow-hidden border-primary/20 bg-card/85">
          <CardHeader className="border-b border-white/10 bg-primary/[.035]"><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5"/>{text.referenceSync}</CardTitle><CardDescription>{text.referenceSyncDescription}</CardDescription></CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-2 gap-3 text-sm"><div className="border border-white/10 bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{text.source}</p><p className="mt-1 font-medium">FAO WCA 2020</p></div><div className="border border-white/10 bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{text.mode}</p><p className="mt-1 font-medium">Idempotent + audited</p></div></div>
            <Button className="w-full" onClick={()=>void syncAll()} disabled={syncing}>{syncing?<RefreshCw className="mr-2 h-4 w-4 animate-spin"/>:<Database className="mr-2 h-4 w-4"/>}{syncing?text.syncing:text.syncWca}</Button>
            {lastSync&&<div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="border border-white/10 p-3"><p className="text-lg font-semibold">{lastSync.fetched??0}</p><p className="text-xs text-muted-foreground">{text.fetched}</p></div><div className="border border-white/10 p-3"><p className="text-lg font-semibold">{lastSync.upserted??0}</p><p className="text-xs text-muted-foreground">{text.updated}</p></div><div className="border border-white/10 p-3"><p className="text-lg font-semibold">{lastSync.skipped??0}</p><p className="text-xs text-muted-foreground">{text.unchanged}</p></div></div>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/10 bg-card/85">
          <CardHeader className="border-b border-white/10"><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5"/>{text.browse}</CardTitle><CardDescription>{text.browseDescription}</CardDescription></CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex gap-2"><Input className="h-11" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void search()}} placeholder={text.searchPlaceholder}/><Button className="h-11 px-5" onClick={()=>void search()} disabled={loading}><Search className="mr-2 h-4 w-4"/>{loading?text.searching:text.search}</Button></div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">WCA 2020</Badge><Badge variant="outline">ICC 1.1</Badge><Badge variant="outline">{text.provenancePreserved}</Badge>{payload&&<span className="ml-auto">{payload.totalRows.toLocaleString()} {text.uniqueCrops}</span>}</div>
            {payload&&<Button asChild variant="link" className="h-auto p-0"><a href={payload.source.sourcePage} target="_blank" rel="noreferrer">{payload.source.name}<ExternalLink className="ml-1 h-3 w-3"/></a></Button>}
          </CardContent>
        </Card>
      </section>

      {payload&&<section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{text.officialResults}</p><h2 className="text-xl font-semibold">{text.cropIdentities}</h2></div><p className="hidden text-sm text-muted-foreground md:block">{payload.items.length} {text.resultsShown}</p></div><div className="grid gap-3 lg:grid-cols-2">{payload.items.map(item=><Card key={item.externalId} className="border-white/10 bg-card/80"><CardContent className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-base font-semibold">{item.name}</p><p className="mt-1 text-sm italic text-muted-foreground">{item.scientificName||"—"}</p><div className="mt-3 flex flex-wrap gap-2">{item.iccCode&&<Badge variant="outline">ICC {item.iccCode}</Badge>}<Badge variant="secondary" className="font-mono text-[10px]">{item.externalId}</Badge></div></div><Button size="sm" disabled={importing===item.externalId} onClick={()=>void importStub(item)}><Import className="mr-2 h-4 w-4"/>{text.import}</Button></CardContent></Card>)}</div></section>}

      <Card className="border-white/10 bg-muted/10"><CardHeader><CardTitle>{text.provenanceRule}</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm text-muted-foreground lg:grid-cols-[1fr_auto]"><div className="space-y-2"><p>{text.ruleOne}</p><p>{text.ruleTwo}</p></div><div className="flex flex-wrap items-start gap-2"><Button asChild variant="outline"><a href="https://ecocrop.apps.fao.org/ecocrop/srv/en/home" target="_blank" rel="noreferrer">ECOCROP<ExternalLink className="ml-2 h-4 w-4"/></a></Button><Button asChild variant="outline"><Link href={`/${language}/orchard/library`}>{text.back}</Link></Button></div></CardContent></Card>
    </div>
  </AppLayout>
}

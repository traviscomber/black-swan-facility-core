"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, Database, Download, PackageCheck, PackageSearch, Share2, Smartphone, Sprout, Wheat, Wifi, WifiOff } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage, type Language } from "@/lib/hooks/use-language"
import { ALL_GAME_PLANS, withGamePlanQuery } from "@/lib/orchard/game-plan-scope"

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const copy:Record<Language,Record<string,string>>={
 en:{eyebrow:"Orchard · Field",title:"Field mode",description:"Open the action you need and keep the season context with you.",today:"Today’s work",field:"Field",harvest:"Harvest",nursery:"Nursery",stock:"Count stock",openField:"Open Field Mode",install:"Install BSFC",share:"Share Field Mode",protectCache:"Protect local cache",installHint:"Use Add to Home Screen if your browser does not expose install.",online:"Online",offline:"Offline",browser:"Browser",installed:"Installed",active:"Active",notRegistered:"Not registered",persistent:"Persistent",evictable:"Evictable",unknown:"Unknown",technical:"App & connectivity details",technicalHelp:"Installation, cache and native packaging are support details; operational writes remain network-first.",connectivity:"Connectivity",pwa:"PWA",serviceWorker:"Service worker",storage:"Storage",nativePackage:"Native package",buildReady:"Build-ready",preserved:"Game Plan preserved",preservedHelp:"All field links keep the selected Game Plan and destination modules validate access before applying scope.",offlineBoundary:"No silent offline writes",offlineHelp:"Harvests, treatments, inventory and tasks are never queued invisibly for later synchronization.",nativeWorkspace:"Native packaging",nativeWorkspaceHelp:"Capacitor 8.5.0 workspace exists for iOS/Android. It is unsigned and not published; device testing, signing and distribution remain real gates.",shareText:"Open Orchard Field Mode"},
 es:{eyebrow:"Huerto · Terreno",title:"Modo terreno",description:"Abre la acción que necesitas y conserva el contexto de la temporada.",today:"Trabajo de hoy",field:"Terreno",harvest:"Cosecha",nursery:"Vivero",stock:"Contar stock",openField:"Abrir modo terreno",install:"Instalar BSFC",share:"Compartir modo terreno",protectCache:"Proteger cache local",installHint:"Usa Agregar a pantalla de inicio si el navegador no muestra instalación.",online:"En línea",offline:"Sin conexión",browser:"Navegador",installed:"Instalada",active:"Activo",notRegistered:"No registrado",persistent:"Persistente",evictable:"Evictable",unknown:"Desconocido",technical:"Detalles de app y conectividad",technicalHelp:"Instalación, cache y empaquetado nativo son detalles de soporte; las escrituras operacionales siguen network-first.",connectivity:"Conectividad",pwa:"PWA",serviceWorker:"Service worker",storage:"Almacenamiento",nativePackage:"Paquete nativo",buildReady:"Listo para build",preserved:"Game Plan preservado",preservedHelp:"Todos los accesos conservan el Game Plan seleccionado y los módulos destino validan acceso antes de aplicar scope.",offlineBoundary:"Sin escrituras offline invisibles",offlineHelp:"Cosechas, tratamientos, inventario y tareas nunca se dejan en una cola oculta para sincronizar después.",nativeWorkspace:"Empaquetado nativo",nativeWorkspaceHelp:"Existe workspace Capacitor 8.5.0 para iOS/Android. Sigue sin firma ni publicación; pruebas físicas, firma y distribución continúan como gates reales.",shareText:"Abrir Orchard Field Mode"},
 de:{eyebrow:"Orchard · Feld",title:"Feldmodus",description:"Öffne die benötigte Aktion und behalte den Saisonkontext bei.",today:"Heutige Arbeit",field:"Feld",harvest:"Ernte",nursery:"Jungpflanzen",stock:"Bestand zählen",openField:"Feldmodus öffnen",install:"BSFC installieren",share:"Feldmodus teilen",protectCache:"Lokalen Cache schützen",installHint:"Zum Startbildschirm hinzufügen, wenn keine Installation angeboten wird.",online:"Online",offline:"Offline",browser:"Browser",installed:"Installiert",active:"Aktiv",notRegistered:"Nicht registriert",persistent:"Persistent",evictable:"Löschbar",unknown:"Unbekannt",technical:"App- & Verbindungsdetails",technicalHelp:"Installation, Cache und natives Packaging sind Supportdetails; operative Schreibvorgänge bleiben network-first.",connectivity:"Verbindung",pwa:"PWA",serviceWorker:"Service Worker",storage:"Speicher",nativePackage:"Native App",buildReady:"Build-bereit",preserved:"Game Plan beibehalten",preservedHelp:"Alle Feldlinks behalten den gewählten Game Plan; Zielmodule prüfen den Zugriff vor Anwendung des Scopes.",offlineBoundary:"Keine stillen Offline-Schreibvorgänge",offlineHelp:"Ernten, Behandlungen, Inventar und Aufgaben werden nie unsichtbar zur späteren Synchronisierung vorgemerkt.",nativeWorkspace:"Native Verpackung",nativeWorkspaceHelp:"Ein Capacitor-8.5.0-Arbeitsbereich für iOS/Android ist vorhanden. Signierung, Gerätetests und Distribution bleiben offene reale Gates.",shareText:"Orchard Field Mode öffnen"},
}

export default function OrchardMobilePage(){
 const {language}=useLanguage();const text=copy[language];const [online,setOnline]=useState(true);const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);const [standalone,setStandalone]=useState(false);const [registered,setRegistered]=useState(false);const [persistent,setPersistent]=useState<boolean|null>(null);const [shareable,setShareable]=useState(false);const [gamePlanId,setGamePlanId]=useState<string>(ALL_GAME_PLANS)
 useEffect(()=>{setOnline(navigator.onLine);setStandalone(window.matchMedia("(display-mode: standalone)").matches);setShareable(typeof navigator.share==="function");setGamePlanId(new URLSearchParams(window.location.search).get("game_plan")||ALL_GAME_PLANS);void navigator.storage?.persisted().then(setPersistent).catch(()=>setPersistent(null));const onOnline=()=>setOnline(true);const onOffline=()=>setOnline(false);const before=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent)};window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);window.addEventListener("beforeinstallprompt",before);if("serviceWorker" in navigator){navigator.serviceWorker.register("/orchard-sw.js",{scope:"/orchard/"}).then(()=>setRegistered(true)).catch(()=>setRegistered(false))}return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);window.removeEventListener("beforeinstallprompt",before)}},[])
 const scopedHref=(path:string)=>withGamePlanQuery(`/${language}${path}`,gamePlanId)
 async function install(){if(!installPrompt)return;await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice.outcome==="accepted")setStandalone(true);setInstallPrompt(null)}
 async function persistStorage(){if(!navigator.storage?.persist)return;const value=await navigator.storage.persist();setPersistent(value)}
 async function share(){if(!navigator.share)return;await navigator.share({title:"Blackswan Facility Core · Orchard",text:text.shareText,url:`${window.location.origin}${scopedHref("/orchard/field")}`})}
 const actions=[
  {label:text.today,href:scopedHref("/orchard/work/week-board"),icon:<CalendarDays className="h-5 w-5"/>},
  {label:text.field,href:scopedHref("/orchard/field"),icon:<Smartphone className="h-5 w-5"/>},
  {label:text.harvest,href:scopedHref("/orchard/field/harvest"),icon:<Wheat className="h-5 w-5"/>},
  {label:text.nursery,href:scopedHref("/orchard/field/nursery"),icon:<Sprout className="h-5 w-5"/>},
  {label:text.stock,href:scopedHref("/orchard/nursery/quick-stock"),icon:<PackageSearch className="h-5 w-5"/>},
 ]
 return <AppLayout><OrchardNavigation/><main className="min-h-full bg-[var(--orchard-canvas)] px-3 py-5 pb-24 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-5xl space-y-5">
   <section className="border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
     <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-2 text-3xl font-medium tracking-[-.035em] sm:text-4xl">{text.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{text.description}</p></div>
     <Badge variant="outline" className={online?"border-[var(--orchard-green)]/40 text-[var(--orchard-green)]":"border-destructive/40 text-destructive"}>{online?<Wifi className="mr-1 h-3.5 w-3.5"/>:<WifiOff className="mr-1 h-3.5 w-3.5"/>}{online?text.online:text.offline}</Badge>
    </div>
    {gamePlanId!==ALL_GAME_PLANS?<div className="mt-4 border-t border-[var(--orchard-line)] pt-4"><p className="text-xs font-medium">{text.preserved}</p><p className="mt-1 text-xs text-muted-foreground">{text.preservedHelp}</p></div>:null}
   </section>

   <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{actions.map(action=><Link key={action.label} href={action.href} className="flex min-h-28 flex-col justify-between border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-4 transition-colors hover:border-[var(--orchard-green)]/50 hover:bg-[var(--bs-surface-secondary)]"><span className="text-[var(--orchard-green)]">{action.icon}</span><span className="text-sm font-medium">{action.label}</span></Link>)}</section>

   <section className="flex flex-wrap gap-2">
    <Button asChild><Link href={scopedHref("/orchard/field")}><Smartphone className="mr-2 h-4 w-4"/>{text.openField}</Link></Button>
    {installPrompt?<Button variant="outline" onClick={()=>void install()}><Download className="mr-2 h-4 w-4"/>{text.install}</Button>:null}
    {shareable?<Button variant="outline" onClick={()=>void share()}><Share2 className="mr-2 h-4 w-4"/>{text.share}</Button>:null}
    {persistent===false?<Button variant="outline" onClick={()=>void persistStorage()}><Database className="mr-2 h-4 w-4"/>{text.protectCache}</Button>:null}
    {!installPrompt&&!standalone?<span className="self-center text-xs text-muted-foreground">{text.installHint}</span>:null}
   </section>

   <details className="border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)]">
    <summary className="cursor-pointer px-5 py-4"><span className="text-sm font-medium">{text.technical}</span><span className="mt-1 block text-xs text-muted-foreground">{text.technicalHelp}</span></summary>
    <div className="border-t border-[var(--orchard-line)] p-5">
     <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><State label={text.connectivity} value={online?text.online:text.offline} icon={online?<Wifi className="h-4 w-4"/>:<WifiOff className="h-4 w-4"/>}/><State label={text.pwa} value={standalone?text.installed:text.browser} icon={<Smartphone className="h-4 w-4"/>}/><State label={text.serviceWorker} value={registered?text.active:text.notRegistered} icon={<Download className="h-4 w-4"/>}/><State label={text.storage} value={persistent===true?text.persistent:persistent===false?text.evictable:text.unknown} icon={<Database className="h-4 w-4"/>}/><State label={text.nativePackage} value={text.buildReady} icon={<PackageCheck className="h-4 w-4"/>}/></div>
     <div className="mt-5 grid gap-3 lg:grid-cols-2"><Info title={text.offlineBoundary} body={text.offlineHelp}/><Info title={text.nativeWorkspace} body={text.nativeWorkspaceHelp}/></div>
    </div>
   </details>
  </div>
 </main></AppLayout>
}
function State({label,value,icon}:{label:string;value:string;icon:ReactNode}){return <div className="flex items-center gap-3 border border-[var(--orchard-line)] bg-[var(--bs-surface-secondary)] p-3"><span className="text-[var(--orchard-green)]">{icon}</span><div><p className="text-sm font-medium">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div></div>}
function Info({title,body}:{title:string;body:string}){return <div className="border border-[var(--orchard-line)] p-4"><p className="text-sm font-medium">{title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p></div>}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Layers3, LocateFixed, MapPinned, X } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { loadOverlayGeoJson, type GeoJsonFeatureCollection } from "@/lib/map/overlay-loader"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type GisOverlay={id:string;name:string;file_url:string;file_type:string|null;is_visible:boolean|null;opacity:number|string|null;updated_at:string|null}
type OverlayState="idle"|"loading"|"ready"|"error"
type LeafletBounds={isValid:()=>boolean}
type LeafletLayer={addTo:(map:LeafletMap)=>LeafletLayer;getBounds?:()=>LeafletBounds}
type TileLayer=LeafletLayer&{on:(event:string,handler:()=>void)=>TileLayer}
type LeafletMap={setView:(center:[number,number],zoom:number)=>LeafletMap;fitBounds:(bounds:[[number,number],[number,number]],options?:Record<string,unknown>)=>LeafletMap;addLayer:(layer:LeafletLayer)=>LeafletMap;removeLayer:(layer:LeafletLayer)=>LeafletMap;hasLayer:(layer:LeafletLayer)=>boolean;invalidateSize:()=>void;remove:()=>void}
type RuntimeLeaflet={map:(element:HTMLElement,options?:Record<string,unknown>)=>LeafletMap;tileLayer:(url:string,options?:Record<string,unknown>)=>TileLayer;geoJSON:(data:unknown,options?:Record<string,unknown>)=>LeafletLayer;circleMarker:(latlng:unknown,options?:Record<string,unknown>)=>LeafletLayer;control:{zoom:(options?:Record<string,unknown>)=>{addTo:(map:LeafletMap)=>unknown}}}

const CORCOVADO_CENTER:[number,number]=[-39.699435,-73.205363]
const ESRI_IMAGERY="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const copy={
 en:{title:"Farm Map · Satellite",subtitle:"Fundo Corcovado · canonical GIS",layers:"GIS layers",focus:"Focus farm",loading:"Loading satellite map and GIS layers…",error:"The satellite farm map could not be loaded.",baseError:"Satellite imagery could not be loaded.",geometry:"Canonical GIS overlays",geometryNote:"These layers come from the existing Corcovado GIS files. Operational field blocks stay on the aerial editor until their geographic bounds are explicitly calibrated.",source:"Satellite · Esri World Imagery",close:"Close",ready:"ready",loadingState:"loading",errorState:"error",idle:"idle"},
 es:{title:"Mapa de la granja · Satélite",subtitle:"Fundo Corcovado · GIS canónico",layers:"Capas GIS",focus:"Centrar predio",loading:"Cargando mapa satelital y capas GIS…",error:"No fue posible cargar el mapa satelital de la granja.",baseError:"No fue posible cargar la imagen satelital.",geometry:"Capas GIS canónicas",geometryNote:"Estas capas provienen de los archivos GIS existentes de Corcovado. Los bloques operacionales siguen en el editor aéreo hasta calibrar explícitamente sus límites geográficos.",source:"Satélite · Esri World Imagery",close:"Cerrar",ready:"lista",loadingState:"cargando",errorState:"error",idle:"pendiente"},
 de:{title:"Hofkarte · Satellit",subtitle:"Fundo Corcovado · kanonisches GIS",layers:"GIS-Ebenen",focus:"Hof zentrieren",loading:"Satellitenkarte und GIS-Ebenen werden geladen…",error:"Die Satelliten-Hofkarte konnte nicht geladen werden.",baseError:"Das Satellitenbild konnte nicht geladen werden.",geometry:"Kanonische GIS-Ebenen",geometryNote:"Diese Ebenen stammen aus den vorhandenen Corcovado-GIS-Dateien. Operative Feldblöcke bleiben im Luftbild-Editor, bis ihre geografischen Grenzen ausdrücklich kalibriert sind.",source:"Satellit · Esri World Imagery",close:"Schließen",ready:"bereit",loadingState:"lädt",errorState:"Fehler",idle:"wartet"}
} as const

const overlayColor=(name:string)=>{const value=name.toLowerCase();if(value.includes("agua"))return"#7BA7B8";if(value.includes("proteccion"))return"#96A983";if(value.includes("pmf"))return"#C3A66D";if(value.includes("interes"))return"#B7ADA0";return"#F0EEE7"}

export default function OrchardFarmMapSatellitePage(){
 const {language}=useLanguage();const lang:Locale=language;const text=copy[lang]
 const supabase=useMemo(()=>createBrowserClient(),[])
 const mapContainerRef=useRef<HTMLDivElement>(null)
 const mapRef=useRef<LeafletMap|null>(null)
 const leafletRef=useRef<RuntimeLeaflet|null>(null)
 const layerRefs=useRef<Map<string,LeafletLayer>>(new Map())
 const coordinateCacheRef=useRef<Map<string,[number,number][]>>(new Map())
 const [overlays,setOverlays]=useState<GisOverlay[]>([])
 const [visibleIds,setVisibleIds]=useState<Set<string>>(new Set())
 const visibleIdsRef=useRef<Set<string>>(new Set())
 const [states,setStates]=useState<Record<string,OverlayState>>({})
 const [drawerOpen,setDrawerOpen]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState<string|null>(null)
 const [baseError,setBaseError]=useState(false)

 useEffect(()=>{
  let cancelled=false
  void supabase.from("gis_overlays").select("id,name,file_url,file_type,is_visible,opacity,updated_at").order("layer_order").order("name").then(result=>{
   if(cancelled)return
   if(result.error){setError(text.error);setLoading(false);return}
   const next=(result.data??[]) as GisOverlay[]
   const nextVisible=new Set(next.filter(row=>row.is_visible!==false).map(row=>row.id))
   setOverlays(next);setVisibleIds(nextVisible);visibleIdsRef.current=nextVisible
   setStates(Object.fromEntries(next.map(row=>[row.id,"idle" as OverlayState])))
  })
  return()=>{cancelled=true}
 },[supabase,text.error])

 useEffect(()=>{
  if(!mapContainerRef.current||overlays.length===0)return
  let cancelled=false
  void import("leaflet").then(module=>{
   const L=module as unknown as RuntimeLeaflet
   if(cancelled||!mapContainerRef.current)return
   leafletRef.current=L
   const map=L.map(mapContainerRef.current,{zoomControl:false,attributionControl:true,minZoom:4,maxZoom:20}).setView(CORCOVADO_CENTER,18)
   mapRef.current=map
   L.control.zoom({position:"bottomleft"}).addTo(map)
   const base=L.tileLayer(ESRI_IMAGERY,{maxZoom:20,maxNativeZoom:19,tileSize:256,attribution:"Imagery © Esri and contributors"})
   let tileFailures=0
   base.on("tileerror",()=>{tileFailures+=1;if(tileFailures>=4)setBaseError(true)})
   base.on("load",()=>setBaseError(false))
   base.addTo(map)
   const initiallyVisible=overlays.filter(row=>visibleIdsRef.current.has(row.id))
   void Promise.all(initiallyVisible.map(row=>loadOverlay(L,map,row))).then(()=>{if(cancelled)return;fitLoaded(map);requestAnimationFrame(()=>map.invalidateSize());setLoading(false)})
  }).catch(()=>{if(!cancelled){setError(text.error);setLoading(false)}})
  return()=>{cancelled=true;mapRef.current?.remove();mapRef.current=null;leafletRef.current=null;layerRefs.current.clear();coordinateCacheRef.current.clear()}
 },[overlays,text.error])

 const loadOverlay=async(L:RuntimeLeaflet,map:LeafletMap,overlay:GisOverlay)=>{
  if(layerRefs.current.has(overlay.id))return
  setStates(current=>({...current,[overlay.id]:"loading"}))
  try{
   const result=await loadOverlayGeoJson({id:overlay.id,file_url:overlay.file_url,file_type:overlay.file_type,source_version:overlay.updated_at??overlay.file_url})
   const color=overlayColor(overlay.name)
   const opacity=Math.max(0,Math.min(1,Number(overlay.opacity??1)))
   const layer=L.geoJSON(result.geojson as unknown as Record<string,unknown>,{style:()=>({color,weight:2,opacity:.9*opacity,fillColor:color,fillOpacity:.08*opacity}),pointToLayer:(_feature:unknown,latlng:unknown)=>L.circleMarker(latlng,{radius:4.5,color:"#171512",weight:1.5,fillColor:color,fillOpacity:opacity})})
   layerRefs.current.set(overlay.id,layer);coordinateCacheRef.current.set(overlay.id,collectCoordinates(result.geojson));if(visibleIdsRef.current.has(overlay.id))map.addLayer(layer);setStates(current=>({...current,[overlay.id]:"ready"}))
  }catch{setStates(current=>({...current,[overlay.id]:"error"}))}
 }

 const toggleOverlay=(overlay:GisOverlay)=>{
  const map=mapRef.current;const L=leafletRef.current;if(!map||!L)return
  const willShow=!visibleIdsRef.current.has(overlay.id);const next=new Set(visibleIdsRef.current);if(willShow)next.add(overlay.id);else next.delete(overlay.id);visibleIdsRef.current=next;setVisibleIds(next)
  const layer=layerRefs.current.get(overlay.id)
  if(!layer&&willShow){void loadOverlay(L,map,overlay).then(()=>fitLoaded(map));return}
  if(layer){if(willShow&&!map.hasLayer(layer))map.addLayer(layer);if(!willShow&&map.hasLayer(layer))map.removeLayer(layer)}
 }

 const fitLoaded=(map=mapRef.current)=>{if(!map)return;const coordinates=Array.from(coordinateCacheRef.current.entries()).filter(([id])=>visibleIdsRef.current.has(id)).flatMap(([,points])=>points);if(coordinates.length===0){map.setView(CORCOVADO_CENTER,18);return}map.fitBounds(boundsForLeaflet(coordinates),{padding:[70,70],maxZoom:18})}
 const stateLabel=(state:OverlayState)=>state==="ready"?text.ready:state==="loading"?text.loadingState:state==="error"?text.errorState:text.idle

 return <AppLayout><OrchardNavigation/><main className="relative h-[calc(100dvh-var(--orchard-nav-height,0px))] min-h-[620px] w-full overflow-hidden bg-[#11110f]">
  <div ref={mapContainerRef} className="absolute inset-0 z-0" aria-label={text.title}/>
  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
   <div className="pointer-events-auto border border-white/15 bg-[#171512]/95 px-4 py-2.5 shadow-2xl backdrop-blur-md"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#91c9ae]">{text.subtitle}</p><h1 className="mt-0.5 text-lg font-medium text-[#f1eee7]">{text.title}</h1></div>
   <button type="button" onClick={()=>setDrawerOpen(value=>!value)} className="pointer-events-auto flex h-11 items-center gap-2 border border-white/15 bg-[#171512]/95 px-3 text-sm text-[#f1eee7] shadow-2xl backdrop-blur-md transition hover:bg-[#211e1a]" aria-expanded={drawerOpen}><Layers3 className="h-4 w-4"/><span className="hidden sm:inline">{text.layers}</span></button>
  </div>
  {drawerOpen?<aside className="absolute right-4 top-[76px] z-30 w-[min(360px,calc(100%-32px))] border border-white/15 bg-[#171512]/97 shadow-2xl backdrop-blur-xl sm:right-5">
   <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3"><div><p className="text-xs font-medium text-[#f1eee7]">{text.geometry}</p><p className="mt-1 text-[11px] leading-4 text-[#8f8a81]">{text.geometryNote}</p></div><button type="button" onClick={()=>setDrawerOpen(false)} className="p-1 text-[#8f8a81] hover:text-white" aria-label={text.close}><X className="h-4 w-4"/></button></div>
   <div className="max-h-[55vh] overflow-y-auto p-2">{overlays.map(overlay=>{const active=visibleIds.has(overlay.id);const state=states[overlay.id]??"idle";return <button key={overlay.id} type="button" onClick={()=>toggleOverlay(overlay)} className="flex w-full items-center gap-3 px-2.5 py-2.5 text-left hover:bg-white/[.04]"><span className="h-3 w-3 shrink-0 border" style={{borderColor:overlayColor(overlay.name),backgroundColor:active?overlayColor(overlay.name):"transparent"}}/><span className="min-w-0 flex-1"><span className="block truncate text-xs text-[#e8e5dc]">{cleanOverlayName(overlay.name)}</span><span className="mt-0.5 block text-[10px] uppercase tracking-[.08em] text-[#746f68]">{stateLabel(state)}</span></span>{active?<Check className="h-3.5 w-3.5 text-[#91c9ae]"/>:null}</button>})}</div>
  </aside>:null}
  <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 border border-white/15 bg-[#171512]/94 p-1 shadow-2xl backdrop-blur-md"><button type="button" onClick={()=>fitLoaded()} className="flex h-9 items-center gap-2 px-3 text-xs text-[#e8e5dc] hover:bg-white/[.05]"><LocateFixed className="h-4 w-4 text-[#91c9ae]"/>{text.focus}</button><span className="h-5 w-px bg-white/10"/><span className="hidden px-2 text-[10px] uppercase tracking-[.1em] text-[#77726a] sm:block">{text.source}</span></div>
  {loading?<div className="absolute inset-0 z-10 flex items-center justify-center bg-[#11110f]/65 text-sm text-[#aaa69c] backdrop-blur-[1px]">{text.loading}</div>:null}
  {error?<div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 border border-red-400/30 bg-[#211817] px-5 py-4 text-sm text-[#e7c2bb]">{error}</div>:null}
  {baseError&&!error?<div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 border border-amber-300/25 bg-[#211e1a]/95 px-4 py-2 text-xs text-[#d9c7a0]">{text.baseError}</div>:null}
  <div className="absolute bottom-5 right-5 z-20 hidden items-center gap-2 border border-white/10 bg-[#171512]/88 px-3 py-2 text-[10px] uppercase tracking-[.1em] text-[#8f8a81] backdrop-blur-md lg:flex"><MapPinned className="h-3.5 w-3.5 text-[#91c9ae]"/>GIS Corcovado</div>
 </main></AppLayout>
}

function cleanOverlayName(name:string){return name.replace(/^BS_/i,"").replaceAll("_"," ").replace(/\s+/g," ").trim()}
function collectCoordinates(collection:GeoJsonFeatureCollection):[number,number][]{const points:[number,number][]=[];const walk=(value:unknown)=>{if(!Array.isArray(value))return;if(value.length>=2&&typeof value[0]==="number"&&typeof value[1]==="number"){const lng=value[0],lat=value[1];if(Number.isFinite(lng)&&Number.isFinite(lat)&&Math.abs(lng)<=180&&Math.abs(lat)<=90)points.push([lng,lat]);return}for(const child of value)walk(child)};for(const feature of collection.features)walk(feature.geometry?.coordinates);return points}
function boundsForLeaflet(points:[number,number][]):[[number,number],[number,number]]{let minLng=points[0][0],maxLng=points[0][0],minLat=points[0][1],maxLat=points[0][1];for(const[lng,lat]of points){minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng);minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat)}return[[minLat,minLng],[maxLat,maxLng]]}

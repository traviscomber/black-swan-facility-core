"use client"

import { useEffect, useRef, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const FARM_CENTER:[number,number]=[-39.697291,-73.206357]
const ESRI="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const MAPTILER_KEY=process.env.NEXT_PUBLIC_MAPTILER_KEY??""
const MAPTILER=`https://api.maptiler.com/tiles/satellite-v4/{z}/{x}/{y}?key=${encodeURIComponent(MAPTILER_KEY)}`

type Provider="maptiler"|"esri"
type Locale="en"|"es"|"de"
type LeafletLayer={addTo:(map:LeafletMap)=>LeafletLayer;remove:()=>void}
type LeafletMap={setView:(center:[number,number],zoom:number)=>LeafletMap;remove:()=>void;invalidateSize:()=>void}
type RuntimeLeaflet={map:(el:HTMLElement,options?:Record<string,unknown>)=>LeafletMap;tileLayer:(url:string,options?:Record<string,unknown>)=>LeafletLayer;control:{zoom:(options?:Record<string,unknown>)=>{addTo:(map:LeafletMap)=>unknown}}}

const copy={
 en:{label:"Satellite imagery comparison",maptiler:"MapTiler Satellite",esri:"Esri World Imagery",location:"Fundo Corcovado",initError:"Could not initialize comparison map.",keyError:"MapTiler key is not available in this deployment."},
 es:{label:"Comparación de imagen satelital",maptiler:"MapTiler Satélite",esri:"Esri World Imagery",location:"Fundo Corcovado",initError:"No fue posible iniciar el mapa de comparación.",keyError:"La clave de MapTiler no está disponible en este deployment."},
 de:{label:"Vergleich der Satellitenbilder",maptiler:"MapTiler Satellit",esri:"Esri World Imagery",location:"Fundo Corcovado",initError:"Die Vergleichskarte konnte nicht gestartet werden.",keyError:"Der MapTiler-Schlüssel ist in diesem Deployment nicht verfügbar."}
} as const

export default function ImageryComparePage(){
 const {language}=useLanguage();const text=copy[language as Locale]
 const mapNode=useRef<HTMLDivElement>(null)
 const mapRef=useRef<LeafletMap|null>(null)
 const leafletRef=useRef<RuntimeLeaflet|null>(null)
 const baseRef=useRef<LeafletLayer|null>(null)
 const [provider,setProvider]=useState<Provider>("maptiler")
 const [error,setError]=useState<string|null>(null)

 useEffect(()=>{if(!mapNode.current)return;let cancelled=false
  void import("leaflet").then(mod=>{if(cancelled||!mapNode.current)return;const L=mod as unknown as RuntimeLeaflet;leafletRef.current=L
   const map=L.map(mapNode.current,{zoomControl:false,attributionControl:true,minZoom:4,maxZoom:20}).setView(FARM_CENTER,19);mapRef.current=map;L.control.zoom({position:"bottomleft"}).addTo(map);requestAnimationFrame(()=>map.invalidateSize())
  }).catch(()=>setError(text.initError))
  return()=>{cancelled=true;baseRef.current?.remove();mapRef.current?.remove();baseRef.current=null;mapRef.current=null;leafletRef.current=null}
 },[text.initError])

 useEffect(()=>{const L=leafletRef.current;const map=mapRef.current;if(!L||!map)return;baseRef.current?.remove();setError(null)
  if(provider==="maptiler"&&!MAPTILER_KEY){setError(text.keyError);return}
  const layer=L.tileLayer(provider==="maptiler"?MAPTILER:ESRI,{maxZoom:20,tileSize:256,attribution:provider==="maptiler"?'Imagery © MapTiler':'Imagery © Esri and contributors'}).addTo(map);baseRef.current=layer
 },[provider,text.keyError])

 return <AppLayout><OrchardNavigation/><main className="relative h-[calc(100dvh-var(--orchard-nav-height,0px))] min-h-[620px] w-full overflow-hidden bg-[#11110f]">
  <div ref={mapNode} className="absolute inset-0" aria-label={text.label}/>
  <div className="absolute left-1/2 top-4 z-[500] flex -translate-x-1/2 gap-1 border border-white/15 bg-[#171512]/95 p-1 shadow-xl backdrop-blur-md">
   <button type="button" onClick={()=>setProvider("maptiler")} className={`px-4 py-2 text-xs ${provider==="maptiler"?"bg-[#173328] text-[#bde1cf]":"text-[#aaa69c] hover:bg-white/[.05]"}`}>{text.maptiler}</button>
   <button type="button" onClick={()=>setProvider("esri")} className={`px-4 py-2 text-xs ${provider==="esri"?"bg-[#173328] text-[#bde1cf]":"text-[#aaa69c] hover:bg-white/[.05]"}`}>{text.esri}</button>
  </div>
  <div className="absolute bottom-5 right-5 z-[500] border border-white/15 bg-[#171512]/92 px-3 py-2 text-[10px] uppercase tracking-[.1em] text-[#aaa69c] shadow-xl backdrop-blur-md">{text.location} · -39.697291, -73.206357 · {provider}</div>
  {error?<div className="absolute left-1/2 top-20 z-[600] -translate-x-1/2 border border-red-400/30 bg-[#211817]/95 px-4 py-3 text-xs text-[#e7c2bb]">{error}</div>:null}
 </main></AppLayout>
}

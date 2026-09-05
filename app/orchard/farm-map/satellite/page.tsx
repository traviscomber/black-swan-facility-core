"use client"

import { useEffect, useRef, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"

const FARM_LAT=-39.699435
const FARM_LON=-73.205363

export default function OrchardFarmMapSatellitePage(){
 const mapNode=useRef<HTMLDivElement>(null)
 const mapRef=useRef<any>(null)
 const [ready,setReady]=useState(false)
 const [failed,setFailed]=useState(false)

 useEffect(()=>{
  let cancelled=false
  const mount=async()=>{
   if(!mapNode.current||mapRef.current)return
   try{
    const mod:any=await import("leaflet")
    if(cancelled||!mapNode.current)return
    const L=mod.default??mod
    const map=L.map(mapNode.current,{zoomControl:true,attributionControl:true,minZoom:3,maxZoom:20}).setView([FARM_LAT,FARM_LON],18)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{
     maxZoom:20,
     maxNativeZoom:19,
     attribution:"Tiles © Esri — Source: Esri and contributors"
    }).addTo(map)
    L.circleMarker([FARM_LAT,FARM_LON],{radius:7,color:"#8fd6b9",weight:2,fillColor:"#102018",fillOpacity:.85}).addTo(map).bindTooltip("Black Swan Orchard",{permanent:false,direction:"top"})
    mapRef.current=map
    setReady(true)
   }catch(error){console.error("Farm satellite map failed",error);setFailed(true)}
  }
  void mount()
  return()=>{cancelled=true;if(mapRef.current){mapRef.current.remove();mapRef.current=null}}
 },[])

 return <AppLayout><OrchardNavigation/><main className="flex h-[calc(100dvh-var(--orchard-nav-height,0px))] min-h-[620px] flex-col overflow-hidden bg-[#171715] text-[#e8e5dc]">
  <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
   <div><h1 className="text-lg font-medium">Farm Map · Satellite</h1><p className="mt-0.5 text-xs text-[#8f8a81]">Geospatial reference centered on Fundo Corcovado</p></div>
   <div className="text-right"><p className="text-[10px] uppercase tracking-[.13em] text-[#77726a]">Canonical farm center</p><p className="text-xs tabular-nums text-[#aaa69c]">{FARM_LAT.toFixed(6)}, {FARM_LON.toFixed(6)}</p></div>
  </header>
  <section className="relative min-h-0 flex-1 bg-[#242622]">
   <div ref={mapNode} className="absolute inset-0" aria-label="Satellite map of Black Swan Orchard"/>
   {!ready&&!failed?<div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-[#171715]/60 text-sm text-[#aaa69c]">Loading satellite map…</div>:null}
   {failed?<div className="absolute inset-0 z-[500] grid place-items-center bg-[#171715] p-6 text-center"><div><p className="text-sm text-[#e8e5dc]">Satellite imagery is unavailable.</p><p className="mt-2 max-w-md text-xs leading-5 text-[#8f8a81]">The operational aerial map remains available and no farm data was changed.</p></div></div>:null}
   <div className="pointer-events-none absolute bottom-4 right-4 z-[500] max-w-sm border border-white/10 bg-[#171715]/92 px-3 py-2 text-[10px] leading-4 text-[#aaa69c] backdrop-blur-sm">Reference only. Existing blocks are still anchored to the calibrated operational aerial image until geographic bounds are explicitly confirmed; no crop allocation or bed position is inferred here.</div>
  </section>
 </main></AppLayout>
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Droplets, Plus, PlugZap, RadioTower, Sprout, Trees, Warehouse, X, Minus, RotateCcw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type ObjectType="field_block"|"greenhouse"|"tunnel"|"farm_area"|"water"|"electricity"|"internet"
type MapObject={id:string;location_id:string;plot_id:string|null;object_type:ObjectType;name:string;x_pct:number|string;y_pct:number|string;width_pct:number|string;height_pct:number|string;rotation_deg:number|string;bed_count:number|null;bed_length_m:number|string|null;bed_width_cm:number|string|null;path_width_cm:number|string|null;placement_source:string;is_visible:boolean}

type Draft={type:ObjectType;name:string;beds:string;length:string;bedWidth:string;pathWidth:string}

const copy={
 en:{title:"Farm Map",subtitle:"Map the physical farm before assigning crops",add:"Add to map",choose:"Choose the type of growing location or infrastructure to add.",field:"Field Block",fieldNote:"Outdoor growing area with beds",greenhouse:"Greenhouse",greenhouseNote:"Permanent covered growing structure",tunnel:"Tunnel",tunnelNote:"Movable or semi-permanent structure",area:"Farm area",areaNote:"Free farming space or physical farm boundary",water:"Water",waterNote:"Water connection or supply point",power:"Electricity",powerNote:"Electrical connection point",internet:"Internet",internetNote:"Internet or network connection point",create:"Create",cancel:"Cancel",back:"Back",name:"Name",beds:"Number of beds",length:"Bed length",bedWidth:"Bed width",pathWidth:"Path width",mapNote:"Drag objects to match the aerial image. Positions are visual references; canonical beds and crop allocations stay unchanged.",loading:"Loading farm map…",saveError:"Could not save this map position.",createError:"Could not create this map object.",zoomIn:"Zoom in",zoomOut:"Zoom out",reset:"Reset view",configured:"Configured locations"},
 es:{title:"Mapa de la granja",subtitle:"Mapea el espacio físico antes de asignar cultivos",add:"Agregar al mapa",choose:"Elige el tipo de espacio de cultivo o infraestructura que quieres agregar.",field:"Bloque de campo",fieldNote:"Área exterior de cultivo con camas",greenhouse:"Invernadero",greenhouseNote:"Estructura cubierta permanente",tunnel:"Túnel",tunnelNote:"Estructura móvil o semipermanente",area:"Área de granja",areaNote:"Espacio libre de cultivo o límite físico",water:"Agua",waterNote:"Conexión o punto de abastecimiento",power:"Electricidad",powerNote:"Punto de conexión eléctrica",internet:"Internet",internetNote:"Punto de conexión de red",create:"Crear",cancel:"Cancelar",back:"Atrás",name:"Nombre",beds:"Número de camas",length:"Largo de cama",bedWidth:"Ancho de cama",pathWidth:"Ancho de pasillo",mapNote:"Arrastra los objetos para alinearlos con la foto aérea. Las posiciones son referencias visuales; las camas y asignaciones canónicas no cambian.",loading:"Cargando mapa de la granja…",saveError:"No fue posible guardar esta posición.",createError:"No fue posible crear este objeto.",zoomIn:"Acercar",zoomOut:"Alejar",reset:"Restablecer vista",configured:"Espacios configurados"},
 de:{title:"Hofkarte",subtitle:"Physische Flächen vor der Kulturzuweisung kartieren",add:"Zur Karte hinzufügen",choose:"Wähle Anbaufläche oder Infrastruktur.",field:"Feldblock",fieldNote:"Anbaufläche im Freien mit Beeten",greenhouse:"Gewächshaus",greenhouseNote:"Permanente überdachte Struktur",tunnel:"Tunnel",tunnelNote:"Mobile oder semipermanente Struktur",area:"Hofbereich",areaNote:"Freie Anbaufläche oder physische Grenze",water:"Wasser",waterNote:"Wasseranschluss oder Versorgungspunkt",power:"Strom",powerNote:"Elektrischer Anschlusspunkt",internet:"Internet",internetNote:"Netzwerkanschlusspunkt",create:"Erstellen",cancel:"Abbrechen",back:"Zurück",name:"Name",beds:"Anzahl Beete",length:"Beetlänge",bedWidth:"Beetbreite",pathWidth:"Wegbreite",mapNote:"Objekte auf dem Luftbild verschieben. Positionen sind visuelle Referenzen; kanonische Beete und Kulturzuweisungen bleiben unverändert.",loading:"Hofkarte wird geladen…",saveError:"Position konnte nicht gespeichert werden.",createError:"Objekt konnte nicht erstellt werden.",zoomIn:"Vergrößern",zoomOut:"Verkleinern",reset:"Ansicht zurücksetzen",configured:"Konfigurierte Flächen"}
} as const

const typeIcon=(type:ObjectType)=> type==="field_block"?<Sprout/>:type==="greenhouse"?<Warehouse/>:type==="tunnel"?<Warehouse/>:type==="farm_area"?<Trees/>:type==="water"?<Droplets/>:type==="electricity"?<PlugZap/>:<RadioTower/>
const isGrowing=(type:ObjectType)=>type==="field_block"||type==="greenhouse"
const objectTone=(type:ObjectType)=> type==="water"?"#78b7c9":type==="electricity"?"#d9b263":type==="internet"?"#9b8bc8":type==="greenhouse"?"#6eb1a0":type==="tunnel"?"#8fa69b":type==="farm_area"?"#9aaf77":"#d7b17a"
const n=(value:number|string|null|undefined,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback}

export default function OrchardFarmMapPage(){
 const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]
 const supabase=useMemo(()=>createBrowserClient(),[])
 const canvasRef=useRef<HTMLDivElement>(null)
 const [objects,setObjects]=useState<MapObject[]>([])
 const [locationId,setLocationId]=useState<string|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState<string|null>(null)
 const [zoom,setZoom]=useState(1)
 const [dialog,setDialog]=useState<"types"|"form"|null>(null)
 const [draft,setDraft]=useState<Draft>({type:"field_block",name:"",beds:"8",length:"10",bedWidth:"80",pathWidth:"40"})
 const drag=useRef<{id:string;startX:number;startY:number;x:number;y:number}|null>(null)

 const load=async()=>{
  setLoading(true);setError(null)
  const result=await supabase.from("orchard_farm_map_objects").select("id,location_id,plot_id,object_type,name,x_pct,y_pct,width_pct,height_pct,rotation_deg,bed_count,bed_length_m,bed_width_cm,path_width_cm,placement_source,is_visible").eq("is_visible",true).order("name")
  if(result.error){setError(result.error.message);setLoading(false);return}
  const rows=(result.data??[]) as MapObject[];setObjects(rows)
  if(rows[0]?.location_id)setLocationId(rows[0].location_id)
  else {
   const fallback=await supabase.from("orchard_plots").select("location_id").not("location_id","is",null).eq("status","active").limit(1).maybeSingle()
   if(fallback.data?.location_id)setLocationId(String(fallback.data.location_id))
  }
  setLoading(false)
 }
 useEffect(()=>{void load()},[])

 const selectType=(type:ObjectType)=>{setDraft({type,name:"",beds:isGrowing(type)?"8":"",length:isGrowing(type)?"10":"",bedWidth:isGrowing(type)?"80":"",pathWidth:isGrowing(type)?"40":""});setDialog("form")}
 const createObject=async()=>{
  if(!locationId||!draft.name.trim())return
  const growing=isGrowing(draft.type)
  const result=await supabase.rpc("orchard_create_growing_location",{p_location_id:locationId,p_object_type:draft.type,p_name:draft.name.trim(),p_bed_count:growing?Number(draft.beds):null,p_bed_length_m:growing?Number(draft.length):null,p_bed_width_cm:growing?Number(draft.bedWidth):null,p_path_width_cm:growing?Number(draft.pathWidth):null,p_x_pct:50,p_y_pct:50})
  if(result.error){setError(text.createError);return}
  setDialog(null);await load()
 }
 const pointerDown=(event:React.PointerEvent,mapObject:MapObject)=>{
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId)
  drag.current={id:mapObject.id,startX:event.clientX,startY:event.clientY,x:n(mapObject.x_pct),y:n(mapObject.y_pct)}
 }
 const pointerMove=(event:React.PointerEvent)=>{
  const state=drag.current;const box=canvasRef.current?.getBoundingClientRect();if(!state||!box)return
  const dx=(event.clientX-state.startX)/(box.width*zoom)*100;const dy=(event.clientY-state.startY)/(box.height*zoom)*100
  setObjects(current=>current.map(item=>item.id===state.id?{...item,x_pct:Math.max(2,Math.min(98,state.x+dx)),y_pct:Math.max(2,Math.min(98,state.y+dy))}:item))
 }
 const pointerUp=async(event:React.PointerEvent)=>{
  const state=drag.current;if(!state)return;drag.current=null
  const item=objects.find(row=>row.id===state.id);if(!item)return
  const result=await supabase.from("orchard_farm_map_objects").update({x_pct:n(item.x_pct),y_pct:n(item.y_pct),updated_at:new Date().toISOString()}).eq("id",item.id)
  if(result.error)setError(text.saveError)
 }

 const types:[ObjectType,string,string][]=[
  ["field_block",text.field,text.fieldNote],["greenhouse",text.greenhouse,text.greenhouseNote],["tunnel",text.tunnel,text.tunnelNote],["farm_area",text.area,text.areaNote],
  ["water",text.water,text.waterNote],["electricity",text.power,text.powerNote],["internet",text.internet,text.internetNote]
 ]
 return <AppLayout><OrchardNavigation/><main className="flex h-[calc(100dvh-var(--orchard-nav-height,0px))] min-h-[620px] flex-col overflow-hidden bg-[#171715] text-[#e8e5dc]">
  <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
   <div><h1 className="text-lg font-medium">{text.title}</h1><p className="mt-0.5 text-xs text-[#8f8a81]">{text.subtitle}</p></div>
   <div className="hidden text-right sm:block"><p className="text-[10px] uppercase tracking-[.13em] text-[#77726a]">{text.configured}</p><p className="text-sm">{objects.filter(o=>isGrowing(o.object_type)).length}</p></div>
  </header>
  <section className="relative min-h-0 flex-1 overflow-hidden bg-[#242622]">
   <div ref={canvasRef} className="absolute inset-0 overflow-hidden touch-none select-none" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
    <div className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 transition-transform duration-150" style={{transform:`translate(-50%,-50%) scale(${zoom})`}}>
     <img src="/orchard/farm-map-2026.webp" alt="Fundo Corcovado Orchard aerial reference" className="absolute inset-0 h-full w-full object-cover" draggable={false}/>
     <div className="absolute inset-0 bg-black/10"/>
     {objects.map(item=>{
      const tone=objectTone(item.object_type);const growing=isGrowing(item.object_type);const infrastructure=["water","electricity","internet"].includes(item.object_type)
      return <button key={item.id} type="button" onPointerDown={event=>pointerDown(event,item)} className={`absolute flex cursor-grab items-center justify-center active:cursor-grabbing ${infrastructure?"rounded-full":"border-2"}`} style={{left:`${n(item.x_pct)}%`,top:`${n(item.y_pct)}%`,width:infrastructure?"34px":`${n(item.width_pct,9)}%`,height:infrastructure?"34px":`${n(item.height_pct,12)}%`,transform:`translate(-50%,-50%) rotate(${n(item.rotation_deg)}deg)`,borderColor:tone,background:infrastructure?`${tone}e8`:growing?`repeating-linear-gradient(90deg,rgba(90,58,33,.82) 0,rgba(90,58,33,.82) 10%,rgba(236,226,211,.72) 10%,rgba(236,226,211,.72) 14%)`:`${tone}20`,boxShadow:"0 4px 14px rgba(0,0,0,.28)"}} title={`${item.name}${item.bed_count?` · ${item.bed_count} beds`:""}`}>
       {infrastructure?<span className="h-4 w-4 text-[#151713] [&>svg]:h-4 [&>svg]:w-4">{typeIcon(item.object_type)}</span>:<span className="rotate-0 bg-[#171715]/88 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow" style={{transform:`rotate(${-n(item.rotation_deg)}deg)`}}>{item.name}</span>}
      </button>
     })}
    </div>
   </div>
   <div className="absolute bottom-4 left-4 z-20 flex items-center overflow-hidden border border-white/15 bg-[#171715]/95 shadow-xl">
    <button type="button" onClick={()=>setDialog("types")} className="flex h-11 w-11 items-center justify-center border-r border-white/10 hover:bg-white/[.06]" aria-label={text.add}><Plus className="h-5 w-5"/></button>
    <button type="button" onClick={()=>setZoom(v=>Math.min(1.5,Number((v+.1).toFixed(1))))} className="flex h-11 w-10 items-center justify-center border-r border-white/10 hover:bg-white/[.06]" aria-label={text.zoomIn}><Plus className="h-4 w-4"/></button>
    <span className="w-12 text-center text-xs tabular-nums text-[#aaa69c]">{Math.round(zoom*100)}%</span>
    <button type="button" onClick={()=>setZoom(v=>Math.max(.75,Number((v-.1).toFixed(1))))} className="flex h-11 w-10 items-center justify-center border-l border-white/10 hover:bg-white/[.06]" aria-label={text.zoomOut}><Minus className="h-4 w-4"/></button>
    <button type="button" onClick={()=>setZoom(1)} className="flex h-11 w-10 items-center justify-center border-l border-white/10 hover:bg-white/[.06]" aria-label={text.reset}><RotateCcw className="h-4 w-4"/></button>
   </div>
   <div className="absolute bottom-4 right-4 z-10 max-w-sm border border-white/10 bg-[#171715]/90 px-3 py-2 text-[10px] leading-4 text-[#aaa69c] backdrop-blur-sm">{text.mapNote}</div>
   {loading?<div className="absolute inset-0 z-30 grid place-items-center bg-[#171715]/70 text-sm text-[#aaa69c]">{text.loading}</div>:null}
   {error?<button type="button" onClick={()=>setError(null)} className="absolute left-1/2 top-4 z-40 -translate-x-1/2 border border-red-400/30 bg-[#241b19] px-4 py-2 text-xs text-[#e6c1b9]">{error}</button>:null}
  </section>

  {dialog?<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)setDialog(null)}}>
   <div className={`max-h-[90vh] w-full overflow-y-auto border border-white/15 bg-[#1b1b19] shadow-2xl ${dialog==="form"&&isGrowing(draft.type)?"max-w-4xl":"max-w-md"}`}>
    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-medium">{dialog==="types"?text.add:(types.find(t=>t[0]===draft.type)?.[1]??text.add)}</h2>{dialog==="types"?<p className="mt-1 text-xs text-[#aaa69c]">{text.choose}</p>:null}</div><button type="button" onClick={()=>setDialog(null)} aria-label="Close" className="p-1 text-[#aaa69c] hover:text-white"><X className="h-5 w-5"/></button></div>
    {dialog==="types"?<div className="space-y-2 p-4">{types.map(([type,label,note])=><button key={type} type="button" onClick={()=>selectType(type)} className="flex w-full items-center gap-4 border border-white/15 p-4 text-left hover:bg-white/[.04]"><span className="grid h-9 w-9 place-items-center text-[#8fcbb1] [&>svg]:h-5 [&>svg]:w-5">{typeIcon(type)}</span><span><strong className="block text-sm font-medium">{label}</strong><span className="mt-0.5 block text-xs text-[#8f8a81]">{note}</span></span></button>)}</div>:
    <div className={isGrowing(draft.type)?"grid gap-0 md:grid-cols-[1fr_1.05fr]":""}>
     <div className="space-y-4 p-5">
      <label className="block text-xs text-[#aaa69c]">{text.name}<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} className="mt-1.5 h-10 w-full border border-white/15 bg-transparent px-3 text-sm text-white outline-none focus:border-[#7dc7aa]"/></label>
      {isGrowing(draft.type)?<div className="grid grid-cols-2 gap-3">
       <Field label={text.beds} value={draft.beds} onChange={value=>setDraft({...draft,beds:value})}/><Field label={text.length} suffix="m" value={draft.length} onChange={value=>setDraft({...draft,length:value})}/><Field label={text.bedWidth} suffix="cm" value={draft.bedWidth} onChange={value=>setDraft({...draft,bedWidth:value})}/><Field label={text.pathWidth} suffix="cm" value={draft.pathWidth} onChange={value=>setDraft({...draft,pathWidth:value})}/>
      </div>:null}
      <div className="flex items-center justify-between pt-2"><button type="button" onClick={()=>setDialog("types")} className="text-sm text-[#aaa69c] hover:text-white">{text.back}</button><div className="flex gap-2"><button type="button" onClick={()=>setDialog(null)} className="h-10 border border-white/15 px-4 text-sm text-[#aaa69c] hover:bg-white/[.04]">{text.cancel}</button><button type="button" onClick={()=>void createObject()} disabled={!draft.name.trim()} className="h-10 bg-[#79c5aa] px-5 text-sm font-semibold text-[#102018] disabled:opacity-40">{text.create}</button></div></div>
     </div>
     {isGrowing(draft.type)?<BedPreview beds={Math.max(1,Math.min(30,Number(draft.beds)||1))} bedWidth={Math.max(1,Number(draft.bedWidth)||80)} pathWidth={Math.max(0,Number(draft.pathWidth)||40)} length={Math.max(1,Number(draft.length)||10)}/>:null}
    </div>}
   </div>
  </div>:null}
 </main></AppLayout>
}

function Field({label,value,onChange,suffix}:{label:string;value:string;onChange:(value:string)=>void;suffix?:string}){return <label className="text-xs text-[#aaa69c]">{label}<span className="mt-1.5 flex h-10 items-center border border-white/15 px-3 focus-within:border-[#7dc7aa]"><input inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"/>{suffix?<span className="text-sm text-[#aaa69c]">{suffix}</span>:null}</span></label>}
function BedPreview({beds,bedWidth,pathWidth,length}:{beds:number;bedWidth:number;pathWidth:number;length:number}){const total=beds*bedWidth+Math.max(0,beds-1)*pathWidth;return <div className="border-l border-white/10 bg-[#151513] p-5"><div className="mx-auto flex min-h-[360px] max-w-md flex-col"><div className="relative flex flex-1 items-stretch overflow-hidden rounded-xl border-2 border-[#557468] bg-[#25231f] p-2">{Array.from({length:beds},(_,index)=><div key={index} className="flex" style={{width:`${((bedWidth+(index<beds-1?pathWidth:0))/Math.max(total,1))*100}%`}}><div className="h-full bg-[#9a5d2b]" style={{width:`${bedWidth/(bedWidth+(index<beds-1?pathWidth:0))*100}%`}}/>{index<beds-1?<div className="h-full bg-[#ded0c2]" style={{width:`${pathWidth/(bedWidth+pathWidth)*100}%`}}/>:null}</div>)}</div><div className="mt-3 flex items-center justify-between text-xs text-[#aaa69c]"><span>{beds} beds · {bedWidth} cm</span><span>{length} m</span></div></div></div>}

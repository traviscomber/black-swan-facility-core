"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarDays, Download, MapPin, ShoppingCart, Users, WalletCards } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type EventRow={id:string;event_code:string;name:string;start_date:string;end_date:string;location_name:string|null;status:string;participant_count:number;person_days:number|string|null;estimated_total_clp:number|string|null;actual_total_clp:number|string|null;source_event_id:string|null;source_status:string|null;notes:string|null}
type Participant={id:string;participant_name:string;accommodation_name:string|null;room_name:string|null;arrival_date:string|null;arrival_time:string|null;arrival_transport:string|null;departure_date:string|null;departure_time:string|null;departure_transport:string|null;planned_stay_days:number|string|null;estimated_person_total_clp:number|string|null;confirmation_status:string;notes:string|null}
type BudgetItem={id:string;category:string;item_name:string;unit:string|null;quantity:number|string|null;estimated_unit_price_clp:number|string|null;estimated_subtotal_clp:number|string|null;actual_subtotal_clp:number|string|null;procurement_status:string;source_sheet:string|null;source_row:number|null}
type SourceEvent={id:string;event_code:string;name:string}|null

const COPY={
 en:{back:"Events",export:"Export complete XLSX",shopping:"Hospitality shopping",dates:"Dates",participants:"Participants",location:"Location",budget:"Estimated budget",people:"Participants and lodging",budgetBy:"Budget by category",load:"Kitchen load",confirmed:"Confirmed",pending:"Pending",source:"Baseline",noSource:"Original event",actual:"Actual",item:"Item",qty:"Qty",price:"Unit price",subtotal:"Subtotal"},
 es:{back:"Eventos",export:"Exportar XLSX completo",shopping:"Compras Hospitality",dates:"Fechas",participants:"Participantes",location:"Ubicación",budget:"Presupuesto estimado",people:"Participantes y alojamiento",budgetBy:"Presupuesto por categoría",load:"Carga Cocina",confirmed:"Confirmado",pending:"Pendiente",source:"Baseline",noSource:"Evento original",actual:"Real",item:"Ítem",qty:"Cant.",price:"Precio unitario",subtotal:"Subtotal"},
 de:{back:"Events",export:"Vollständiges XLSX exportieren",shopping:"Hospitality-Einkauf",dates:"Daten",participants:"Teilnehmende",location:"Standort",budget:"Geschätztes Budget",people:"Teilnehmende & Unterkunft",budgetBy:"Budget nach Kategorie",load:"Küchenlast",confirmed:"Bestätigt",pending:"Ausstehend",source:"Baseline",noSource:"Original-Event",actual:"Ist",item:"Artikel",qty:"Menge",price:"Einzelpreis",subtotal:"Zwischensumme"},
} as const

function category(notes:string|null){return notes?.match(/Category:\\s*([^|]+)/i)?.[1]?.trim()||"Adulto"}

export default function OperationalEventPage(){
 const params=useParams<{id:string}>();const id=params.id
 const {language}=useLanguage();const c=COPY[language]
 const supabase=useMemo(()=>createClient(),[])
 const locale=LOCALE[language]
 const money=useMemo(()=>new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}),[locale])
 const [event,setEvent]=useState<EventRow|null>(null);const [participants,setParticipants]=useState<Participant[]>([]);const [items,setItems]=useState<BudgetItem[]>([]);const [source,setSource]=useState<SourceEvent>(null);const [error,setError]=useState<string|null>(null)

 useEffect(()=>{void(async()=>{
   const e=await supabase.from("operational_events").select("id,event_code,name,start_date,end_date,location_name,status,participant_count,person_days,estimated_total_clp,actual_total_clp,source_event_id,source_status,notes").eq("id",id).maybeSingle()
   if(e.error||!e.data){setError(e.error?.message||"Event not found");return}
   setEvent(e.data as EventRow)
   const [p,b]=await Promise.all([
     supabase.from("operational_event_participants").select("id,participant_name,accommodation_name,room_name,arrival_date,arrival_time,arrival_transport,departure_date,departure_time,departure_transport,planned_stay_days,estimated_person_total_clp,confirmation_status,notes").eq("event_id",id).order("arrival_date").order("participant_name"),
     supabase.from("operational_event_budget_items").select("id,category,item_name,unit,quantity,estimated_unit_price_clp,estimated_subtotal_clp,actual_subtotal_clp,procurement_status,source_sheet,source_row").eq("event_id",id).order("source_sheet").order("source_row"),
   ])
   if(p.error||b.error){setError(p.error?.message||b.error?.message||"Unable to load event");return}
   setParticipants((p.data??[]) as Participant[]);setItems((b.data??[]) as BudgetItem[])
   if(e.data.source_event_id){
     const s=await supabase.from("operational_events").select("id,event_code,name").eq("id",e.data.source_event_id).maybeSingle()
     if(!s.error)setSource(s.data as SourceEvent)
   }
 })()},[id,supabase])

 if(error)return <div className="p-6 text-sm text-destructive">{error}</div>
 if(!event)return <div className="p-6 text-sm text-muted-foreground">Loading…</div>

 const totals=items.reduce<Record<string,number>>((acc,item)=>{acc[item.category]=(acc[item.category]??0)+Number(item.estimated_subtotal_clp??0);return acc},{})
 const categories=Object.keys(totals).sort()
 const start=new Date(event.start_date+"T00:00:00Z"),end=new Date(event.end_date+"T00:00:00Z")
 const loadRows:{day:string;adults:number;children:number}[]=[]
 for(let d=new Date(start);d<=end;d=new Date(d.getTime()+86400000)){
   const day=d.toISOString().slice(0,10);let adults=0,children=0
   for(const p of participants){
     if(p.confirmation_status!=="confirmed"||!p.arrival_date||!p.departure_date||day<p.arrival_date||day>p.departure_date)continue
     const cat=category(p.notes).toLowerCase();if(cat==="fiesta")continue;if(cat.startsWith("ni"))children++;else adults++
   }
   loadRows.push({day,adults,children})
 }

 return <main className="space-y-6 p-4 md:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
     <div><Button asChild variant="ghost" size="sm" className="-ml-3"><Link href={"/"+language+"/os/events"}><ArrowLeft className="mr-2 h-4 w-4"/>{c.back}</Link></Button><h1 className="mt-2 text-2xl font-semibold">{event.name}</h1><p className="mt-1 font-mono text-xs text-muted-foreground">{event.event_code}</p></div>
     <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={"/"+language+"/bookings/shopping-list"}><ShoppingCart className="mr-2 h-4 w-4"/>{c.shopping}</Link></Button><Button asChild><a href={"/api/events/"+event.id+"/export"}><Download className="mr-2 h-4 w-4"/>{c.export}</a></Button></div>
   </div>

   <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <Metric icon={CalendarDays} label={c.dates} value={event.start_date+" → "+event.end_date}/>
     <Metric icon={Users} label={c.participants} value={String(participants.length)}/>
     <Metric icon={MapPin} label={c.location} value={event.location_name||"—"}/>
     <Metric icon={WalletCards} label={c.budget} value={money.format(Number(event.estimated_total_clp??0))}/>
   </section>

   <Card><CardHeader><CardTitle>{c.source}</CardTitle><CardDescription>{source?source.name+" · "+source.event_code:c.noSource}</CardDescription></CardHeader><CardContent className="text-sm text-muted-foreground">{event.notes||"—"}</CardContent></Card>

   <Card><CardHeader><CardTitle>{c.people}</CardTitle><CardDescription>{participants.filter(p=>p.confirmation_status==="confirmed").length} {c.confirmed} · {participants.filter(p=>p.confirmation_status!=="confirmed").length} {c.pending}</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Nombre</th><th>Alojamiento</th><th>Llegada</th><th>Salida</th><th>Categoría</th><th>Estado</th><th className="text-right">Monto</th></tr></thead><tbody>{participants.map(p=><tr key={p.id} className="border-b"><td className="py-3 font-medium">{p.participant_name}</td><td>{[p.accommodation_name,p.room_name].filter(Boolean).join(" / ")||"—"}</td><td>{p.arrival_date||"—"} {p.arrival_time?.slice(0,5)||""}</td><td>{p.departure_date||"—"} {p.departure_time?.slice(0,5)||""}</td><td>{category(p.notes)}</td><td><Badge variant={p.confirmation_status==="confirmed"?"secondary":"outline"}>{p.confirmation_status==="confirmed"?c.confirmed:c.pending}</Badge></td><td className="text-right">{money.format(Number(p.estimated_person_total_clp??0))}</td></tr>)}</tbody></table></CardContent></Card>

   <Card><CardHeader><CardTitle>{c.load}</CardTitle><CardDescription>Solo participantes confirmados; excluye categoría Fiesta.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Fecha</th><th>Adultos</th><th>Niños</th><th>Total</th></tr></thead><tbody>{loadRows.map(row=><tr key={row.day} className="border-b"><td className="py-2">{row.day}</td><td>{row.adults}</td><td>{row.children}</td><td className="font-medium">{row.adults+row.children}</td></tr>)}</tbody></table></CardContent></Card>

   <Card><CardHeader><CardTitle>{c.budgetBy}</CardTitle><CardDescription>{items.length} líneas</CardDescription></CardHeader><CardContent className="space-y-5">{categories.map(cat=><section key={cat}><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{cat}</h3><span className="text-sm font-medium">{money.format(totals[cat])}</span></div><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-muted/25 text-left text-xs text-muted-foreground"><th className="px-3 py-2">{c.item}</th><th className="px-3 py-2">{c.qty}</th><th className="px-3 py-2">{c.price}</th><th className="px-3 py-2">{c.subtotal}</th><th className="px-3 py-2">{c.actual}</th></tr></thead><tbody>{items.filter(item=>item.category===cat).map(item=><tr key={item.id} className="border-t"><td className="px-3 py-2">{item.item_name}<div className="text-xs text-muted-foreground">{item.source_sheet||""}</div></td><td className="px-3 py-2">{Number(item.quantity??0)} {item.unit||""}</td><td className="px-3 py-2">{money.format(Number(item.estimated_unit_price_clp??0))}</td><td className="px-3 py-2">{money.format(Number(item.estimated_subtotal_clp??0))}</td><td className="px-3 py-2">{item.actual_subtotal_clp==null?"—":money.format(Number(item.actual_subtotal_clp))}</td></tr>)}</tbody></table></div></section>)}</CardContent></Card>
 </main>
}

function Metric({icon:Icon,label,value}:{icon:typeof CalendarDays;label:string;value:string}){return <Card><CardContent className="p-4"><Icon className="h-4 w-4 text-primary"/><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></CardContent></Card>}

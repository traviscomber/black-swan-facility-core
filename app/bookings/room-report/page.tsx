"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Reservation={ room_id:string|null; check_in:string; check_out:string; num_guests:number|null; total_amount:number|null }
type Room={ id:string; room_number:string; location:string|null; capacity:number|null }

const copy={
  en:{title:"Room report",subtitle:"Stay history summarized by canonical room.",room:"Room",property:"Property",stays:"Stays",nights:"Nights",guests:"Guests",revenue:"Recorded amount"},
  es:{title:"Reporte por habitación",subtitle:"Historial de estadías resumido por habitación canónica.",room:"Habitación",property:"Propiedad",stays:"Estadías",nights:"Noches",guests:"Huéspedes",revenue:"Monto registrado"},
  de:{title:"Zimmerbericht",subtitle:"Aufenthaltsverlauf pro kanonischem Zimmer.",room:"Zimmer",property:"Unterkunft",stays:"Aufenthalte",nights:"Nächte",guests:"Gäste",revenue:"Erfasster Betrag"},
} as const

function days(a:string,b:string){ return Math.max(0,Math.round((new Date(b+"T00:00:00Z").getTime()-new Date(a+"T00:00:00Z").getTime())/86400000)) }

export default function RoomReportPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [rooms,setRooms]=useState<Room[]>([]); const [reservations,setReservations]=useState<Reservation[]>([]); const [error,setError]=useState<string|null>(null)
  useEffect(()=>{ void (async()=>{
    const [rr,rs]=await Promise.all([
      supabase.from("rooms").select("id,room_number,location,capacity").order("location").order("room_number"),
      supabase.from("reservations").select("room_id,check_in,check_out,num_guests,total_amount").not("room_id","is",null).limit(2000),
    ])
    const first=rr.error||rs.error; if(first)setError(first.message); else { setRooms((rr.data??[]) as Room[]); setReservations((rs.data??[]) as Reservation[]) }
  })() },[supabase])

  const summary=useMemo(()=>rooms.map(room=>{
    const stays=reservations.filter(r=>r.room_id===room.id)
    return {room,stays:stays.length,nights:stays.reduce((s,r)=>s+days(r.check_in,r.check_out),0),guests:stays.reduce((s,r)=>s+Number(r.num_guests??1),0),amount:stays.reduce((s,r)=>s+Number(r.total_amount??0),0)}
  }),[reservations,rooms])

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]"><header className="bg-[#211e1a] px-4 py-3"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-xs"><thead className="bg-[#211e1a] text-left text-[#8f867b]"><tr><th className="px-3 py-2">{c.property}</th><th className="px-3 py-2">{c.room}</th><th className="px-3 py-2">{c.stays}</th><th className="px-3 py-2">{c.nights}</th><th className="px-3 py-2">{c.guests}</th><th className="px-3 py-2">{c.revenue}</th></tr></thead><tbody>{summary.map(row=><tr key={row.room.id} className="border-t border-white/[.05]"><td className="px-3 py-2 text-[#b9b0a4]">{row.room.location||"—"}</td><td className="px-3 py-2">{row.room.room_number}</td><td className="px-3 py-2">{row.stays}</td><td className="px-3 py-2">{row.nights}</td><td className="px-3 py-2">{row.guests}</td><td className="px-3 py-2">{new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(row.amount)}</td></tr>)}</tbody></table></div>
  </section>
}
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Save, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Guest = {
  id: string; name: string; email: string | null; phone: string | null; company_name: string | null; vip_status: boolean | null
  preferred_language: string | null; preferred_contact_channel: string | null; dietary_preferences: string | null; allergies: string | null
  mobility_requirements: string | null; room_preferences: string | null; housekeeping_preferences: string | null; privacy_notes: string | null
  consent_marketing: boolean; consent_data_processing: boolean; notes: string | null
}
type Reservation = { id: string; guest_id: string | null; guest_name: string; check_in: string; check_out: string; status: string }

const empty = { name:"", email:"", phone:"", company:"", language:"es", channel:"whatsapp", dietary:"", allergies:"", mobility:"", room:"", housekeeping:"", privacy:"", notes:"", vip:false, marketing:false, dataConsent:false }

export function BookingGuestProfile() {
  const supabase = useMemo(() => createClient(), [])
  const [guests,setGuests] = useState<Guest[]>([])
  const [reservations,setReservations] = useState<Reservation[]>([])
  const [guestId,setGuestId] = useState("")
  const [reservationId,setReservationId] = useState("")
  const [form,setForm] = useState(empty)
  const [saving,setSaving] = useState(false)

  const load = useCallback(async()=>{
    const [g,r] = await Promise.all([
      supabase.from("guests").select("id,name,email,phone,company_name,vip_status,preferred_language,preferred_contact_channel,dietary_preferences,allergies,mobility_requirements,room_preferences,housekeeping_preferences,privacy_notes,consent_marketing,consent_data_processing,notes").order("name"),
      supabase.from("reservations").select("id,guest_id,guest_name,check_in,check_out,status").not("status","in","(cancelled,canceled,void,voided,no_show)").order("check_in")
    ])
    const error=g.error||r.error; if(error) return toast.error(error.message)
    setGuests((g.data??[]) as Guest[]); setReservations((r.data??[]) as Reservation[])
  },[supabase])
  useEffect(()=>{void load()},[load])

  function selectGuest(id:string){
    setGuestId(id)
    const g=guests.find(x=>x.id===id)
    if(!g) return setForm(empty)
    setForm({name:g.name,email:g.email??"",phone:g.phone??"",company:g.company_name??"",language:g.preferred_language??"es",channel:g.preferred_contact_channel??"whatsapp",dietary:g.dietary_preferences??"",allergies:g.allergies??"",mobility:g.mobility_requirements??"",room:g.room_preferences??"",housekeeping:g.housekeeping_preferences??"",privacy:g.privacy_notes??"",notes:g.notes??"",vip:Boolean(g.vip_status),marketing:g.consent_marketing,dataConsent:g.consent_data_processing})
  }

  async function save(){
    if(!form.name.trim()) return toast.error("Indica el nombre del huésped")
    setSaving(true)
    const {data,error}=await supabase.rpc("upsert_guest_profile",{p_guest_id:guestId||null,p_name:form.name.trim(),p_email:form.email||null,p_phone:form.phone||null,p_company_name:form.company||null,p_vip_status:form.vip,p_preferred_language:form.language||null,p_preferred_contact_channel:form.channel||null,p_dietary_preferences:form.dietary||null,p_allergies:form.allergies||null,p_mobility_requirements:form.mobility||null,p_room_preferences:form.room||null,p_housekeeping_preferences:form.housekeeping||null,p_privacy_notes:form.privacy||null,p_consent_marketing:form.marketing,p_consent_data_processing:form.dataConsent,p_notes:form.notes||null})
    setSaving(false); if(error) return toast.error(error.message)
    const saved=data as Guest; setGuestId(saved.id); toast.success("Perfil de huésped guardado"); await load()
  }

  async function link(){
    if(!guestId||!reservationId) return toast.error("Selecciona huésped y reserva")
    const {error}=await supabase.rpc("link_reservation_guest",{p_reservation_id:reservationId,p_guest_id:guestId})
    if(error) return toast.error(error.message)
    toast.success("Perfil vinculado a la reserva"); await load()
  }

  const history=reservations.filter(r=>r.guest_id===guestId)
  return <Card className="mx-4 mb-4"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4"/> Perfil canónico del huésped</CardTitle><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button></div></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>Perfil</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={guestId} onChange={e=>selectGuest(e.target.value)}><option value="">Nuevo huésped</option>{guests.map(g=><option key={g.id} value={g.id}>{g.name}{g.vip_status?" · VIP":""}</option>)}</select></div><div className="space-y-1.5"><Label>Vincular a reserva</Label><div className="flex gap-2"><select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={e=>setReservationId(e.target.value)}><option value="">Seleccionar reserva</option>{reservations.map(r=><option key={r.id} value={r.id}>{r.guest_name} · {r.check_in} → {r.check_out}</option>)}</select><Button variant="outline" onClick={()=>void link()}>Vincular</Button></div></div></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Nombre" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})}/><Field label="Teléfono" value={form.phone} onChange={v=>setForm({...form,phone:v})}/><Field label="Empresa" value={form.company} onChange={v=>setForm({...form,company:v})}/>
      <Field label="Idioma" value={form.language} onChange={v=>setForm({...form,language:v})}/><Field label="Canal preferido" value={form.channel} onChange={v=>setForm({...form,channel:v})}/><Field label="Alimentación" value={form.dietary} onChange={v=>setForm({...form,dietary:v})}/><Field label="Alergias" value={form.allergies} onChange={v=>setForm({...form,allergies:v})}/>
      <Field label="Movilidad" value={form.mobility} onChange={v=>setForm({...form,mobility:v})}/><Field label="Preferencias de habitación" value={form.room} onChange={v=>setForm({...form,room:v})}/><Field label="Preferencias de limpieza" value={form.housekeeping} onChange={v=>setForm({...form,housekeeping:v})}/><Field label="Notas operativas" value={form.notes} onChange={v=>setForm({...form,notes:v})}/>
      <div className="space-y-1.5 xl:col-span-4"><Label>Notas de privacidad</Label><Input value={form.privacy} onChange={e=>setForm({...form,privacy:e.target.value})} placeholder="Acceso restringido; evitar datos innecesarios"/></div>
    </div>
    <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.vip} onChange={e=>setForm({...form,vip:e.target.checked})}/> VIP</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.dataConsent} onChange={e=>setForm({...form,dataConsent:e.target.checked})}/> Consentimiento de tratamiento</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.marketing} onChange={e=>setForm({...form,marketing:e.target.checked})}/> Consentimiento comercial</label></div>
    <div className="flex justify-end"><Button onClick={()=>void save()} disabled={saving}><Save className="mr-2 h-4 w-4"/>{saving?"Guardando…":"Guardar perfil"}</Button></div>
    {guestId&&<div className="rounded-lg border p-4"><h3 className="mb-2 text-sm font-medium">Historial de estadías</h3>{history.length===0?<p className="text-sm text-muted-foreground">Sin reservas vinculadas.</p>:<div className="space-y-2">{history.map(r=><div key={r.id} className="flex justify-between gap-3 text-sm"><span>{r.check_in} → {r.check_out}</span><span className="text-muted-foreground">{r.status}</span></div>)}</div>}</div>}
  </CardContent></Card>
}

function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} onChange={e=>onChange(e.target.value)}/></div>}

"use client"

import { useEffect, useMemo, useState } from "react"
import { Edit, Save, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"

type AccountProfile={ email:string|null; role:string|null; department:string|null }
type PropertyProfile={
  object_name?:string
  country_region?:string
  street?:string
  city?:string
  facility_type?:string
  phone?:string
  email?:string
  website?:string|null
  facebook?:string|null
  logo_present?:boolean
}

const copy={
  en:{title:"Profile",subtitle:"Black Swan property identity plus the current authenticated Booking account.",property:"Property",account:"Authenticated account",name:"Name",type:"Facility type",street:"Street",city:"City",country:"Country",phone:"Phone",email:"Email",website:"Website",facebook:"Facebook",role:"Role",department:"Department",loading:"Loading profile…",unavailable:"Not provided",edit:"Edit property",save:"Save",cancel:"Cancel",saved:"Property profile saved."},
  es:{title:"Perfil",subtitle:"Identidad del alojamiento Black Swan y cuenta autenticada actual de Reservas.",property:"Alojamiento",account:"Cuenta autenticada",name:"Nombre",type:"Tipo",street:"Dirección",city:"Ciudad",country:"País",phone:"Teléfono",email:"Correo",website:"Sitio web",facebook:"Facebook",role:"Rol",department:"Departamento",loading:"Cargando perfil…",unavailable:"No informado",edit:"Editar alojamiento",save:"Guardar",cancel:"Cancelar",saved:"Perfil del alojamiento guardado."},
  de:{title:"Profil",subtitle:"Black-Swan-Unterkunft und aktuell authentifiziertes Booking-Konto.",property:"Unterkunft",account:"Authentifiziertes Konto",name:"Name",type:"Typ",street:"Straße",city:"Stadt",country:"Land",phone:"Telefon",email:"E-Mail",website:"Website",facebook:"Facebook",role:"Rolle",department:"Abteilung",loading:"Profil wird geladen…",unavailable:"Nicht angegeben",edit:"Unterkunft bearbeiten",save:"Speichern",cancel:"Abbrechen",saved:"Unterkunftsprofil gespeichert."},
} as const

const emptyProperty:PropertyProfile={object_name:"",country_region:"",street:"",city:"",facility_type:"",phone:"",email:"",website:"",facebook:"",logo_present:false}

export default function BookingProfilePage(){
  const {language}=useLanguage(); const c=copy[language]
  const {access}=useEffectiveAccess()
  const supabase=useMemo(()=>createClient(),[])
  const [account,setAccount]=useState<AccountProfile|null>(null)
  const [property,setProperty]=useState<PropertyProfile|null>(null)
  const [draft,setDraft]=useState<PropertyProfile>(emptyProperty)
  const [editing,setEditing]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)

  useEffect(()=>{ void (async()=>{
    const [userResult,settingsResult]=await Promise.all([
      supabase.auth.getUser(),
      supabase.from("booking_settings").select("property_profile").eq("id","default").maybeSingle(),
    ])
    const user=userResult.data.user
    setAccount({email:user?.email??null,role:String(user?.app_metadata?.role??user?.app_metadata?.procurement_role??"")||null,department:String(user?.app_metadata?.department??"")||null})
    if(settingsResult.error)setError(settingsResult.error.message)
    else {
      const loaded=(settingsResult.data?.property_profile??emptyProperty) as PropertyProfile
      setProperty(loaded)
      setDraft({...emptyProperty,...loaded})
    }
  })() },[supabase])

  async function save(){
    setSaving(true);setError(null);setNotice(null)
    const cleaned:PropertyProfile={
      object_name:draft.object_name?.trim()||"",
      facility_type:draft.facility_type?.trim()||"",
      street:draft.street?.trim()||"",
      city:draft.city?.trim()||"",
      country_region:draft.country_region?.trim()||"",
      phone:draft.phone?.trim()||"",
      email:draft.email?.trim()||"",
      website:draft.website?.trim()||null,
      facebook:draft.facebook?.trim()||null,
      logo_present:Boolean(draft.logo_present),
    }
    const {error:updateError}=await supabase.from("booking_settings").update({property_profile:cleaned,updated_at:new Date().toISOString()}).eq("id","default")
    if(updateError)setError(updateError.message)
    else {setProperty(cleaned);setDraft(cleaned);setEditing(false);setNotice(c.saved)}
    setSaving(false)
  }

  function cancel(){setDraft({...emptyProperty,...(property??{})});setEditing(false);setError(null)}

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-4 py-3 md:px-5">
      <div><h1 className="text-base font-normal tracking-tight">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></div>
      {access.is_admin&&!editing?<button type="button" onClick={()=>setEditing(true)} className="inline-flex h-8 items-center gap-2 bg-[#2b2722] px-3 text-xs hover:bg-[#332e28]"><Edit className="h-3.5 w-3.5"/>{c.edit}</button>:null}
    </header>
    {error?<div className="bg-[#3a211d] px-5 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    {notice?<div className="bg-[#253128] px-5 py-2 text-xs text-[#a8c2ad]">{notice}</div>:null}
    {!account&&!property?<div className="px-5 py-10 text-sm text-[#8f867b]">{c.loading}</div>:<div className="max-w-4xl">
      <div className="bg-[#2b2722] px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{c.property}</div>
      {editing?<div className="grid gap-px bg-[#39342d] sm:grid-cols-2">
        <EditField label={c.name} value={draft.object_name??""} onChange={value=>setDraft({...draft,object_name:value})}/>
        <EditField label={c.type} value={draft.facility_type??""} onChange={value=>setDraft({...draft,facility_type:value})}/>
        <EditField label={c.street} value={draft.street??""} onChange={value=>setDraft({...draft,street:value})}/>
        <EditField label={c.city} value={draft.city??""} onChange={value=>setDraft({...draft,city:value})}/>
        <EditField label={c.country} value={draft.country_region??""} onChange={value=>setDraft({...draft,country_region:value})}/>
        <EditField label={c.phone} value={draft.phone??""} onChange={value=>setDraft({...draft,phone:value})}/>
        <EditField label={c.email} value={draft.email??""} onChange={value=>setDraft({...draft,email:value})} type="email"/>
        <EditField label={c.website} value={draft.website??""} onChange={value=>setDraft({...draft,website:value})}/>
        <EditField label={c.facebook} value={draft.facebook??""} onChange={value=>setDraft({...draft,facebook:value})}/>
        <div className="flex items-end justify-end gap-2 bg-[#211e1a] p-4"><button type="button" onClick={cancel} className="inline-flex h-9 items-center gap-2 bg-[#2b2722] px-4 text-xs"><X className="h-3.5 w-3.5"/>{c.cancel}</button><button type="button" disabled={saving} onClick={()=>void save()} className="inline-flex h-9 items-center gap-2 bg-[#6f8373] px-4 text-xs font-medium text-[#171512] disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{c.save}</button></div>
      </div>:<dl className="text-sm">
        <ProfileRow label={c.name} value={property?.object_name??c.unavailable}/>
        <ProfileRow label={c.type} value={property?.facility_type??c.unavailable}/>
        <ProfileRow label={c.street} value={property?.street??c.unavailable}/>
        <ProfileRow label={c.city} value={property?.city??c.unavailable}/>
        <ProfileRow label={c.country} value={property?.country_region??c.unavailable}/>
        <ProfileRow label={c.phone} value={property?.phone??c.unavailable}/>
        <ProfileRow label={c.email} value={property?.email??c.unavailable}/>
        <ProfileRow label={c.website} value={property?.website??c.unavailable}/>
        <ProfileRow label={c.facebook} value={property?.facebook??c.unavailable}/>
      </dl>}
      <div className="mt-6 bg-[#2b2722] px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{c.account}</div>
      <dl className="text-sm">
        <ProfileRow label={c.email} value={account?.email??c.unavailable}/>
        <ProfileRow label={c.role} value={account?.role??c.unavailable}/>
        <ProfileRow label={c.department} value={account?.department??c.unavailable}/>
      </dl>
    </div>}
  </section>
}

function ProfileRow({label,value}:{label:string;value:string}){return <div className="grid grid-cols-[minmax(120px,170px)_1fr] border-b border-[#39342d] px-5 py-4"><dt className="text-[#8f867b]">{label}</dt><dd className="min-w-0 break-words text-[#e7e1d8]">{value}</dd></div>}
function EditField({label,value,onChange,type="text"}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){return <label className="bg-[#211e1a] p-4 text-xs text-[#b9b0a4]"><span className="mb-2 block">{label}</span><input type={type} value={value} onChange={event=>onChange(event.target.value)} className="h-9 w-full bg-[#171512] px-3 text-sm text-[#e7e1d8] outline-none focus:ring-1 focus:ring-[#6f8373]"/></label>}

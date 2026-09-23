"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type AccountProfile={ email:string|null; role:string|null; department:string|null }
type PropertyProfile={ object_name?:string; country_region?:string; street?:string; city?:string; facility_type?:string; phone?:string; email?:string; website?:string|null; facebook?:string|null }

const copy={
  en:{title:"Profile",subtitle:"Black Swan property identity plus the current authenticated Booking account.",property:"Property",account:"Authenticated account",name:"Name",type:"Facility type",address:"Address",phone:"Phone",email:"Email",website:"Website",facebook:"Facebook",role:"Role",department:"Department",loading:"Loading profile…",unavailable:"Not provided"},
  es:{title:"Perfil",subtitle:"Identidad del alojamiento Black Swan y cuenta autenticada actual de Reservas.",property:"Alojamiento",account:"Cuenta autenticada",name:"Nombre",type:"Tipo",address:"Dirección",phone:"Teléfono",email:"Correo",website:"Sitio web",facebook:"Facebook",role:"Rol",department:"Departamento",loading:"Cargando perfil…",unavailable:"No informado"},
  de:{title:"Profil",subtitle:"Black-Swan-Unterkunft und aktuell authentifiziertes Booking-Konto.",property:"Unterkunft",account:"Authentifiziertes Konto",name:"Name",type:"Typ",address:"Adresse",phone:"Telefon",email:"E-Mail",website:"Website",facebook:"Facebook",role:"Rolle",department:"Abteilung",loading:"Profil wird geladen…",unavailable:"Nicht angegeben"},
} as const

export default function BookingProfilePage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [account,setAccount]=useState<AccountProfile|null>(null)
  const [property,setProperty]=useState<PropertyProfile|null>(null)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{ void (async()=>{
    const [userResult,propertyResult]=await Promise.all([
      supabase.auth.getUser(),
      supabase.from("booking_import_records").select("payload").eq("source_system","bedbooking").eq("entity_type","profile_snapshot").order("observed_at",{ascending:false}).limit(1).maybeSingle(),
    ])
    const user=userResult.data.user
    setAccount({email:user?.email??null,role:String(user?.app_metadata?.role??user?.app_metadata?.procurement_role??"")||null,department:String(user?.app_metadata?.department??"")||null})
    if(propertyResult.error)setError(propertyResult.error.message)
    else setProperty((propertyResult.data?.payload??null) as PropertyProfile|null)
  })() },[supabase])

  const address=[property?.street,property?.city,property?.country_region].filter(Boolean).join(", ")

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5"><h1 className="text-base font-normal tracking-tight">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error?<div className="bg-[#3a211d] px-5 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    {!account&&!property?<div className="px-5 py-10 text-sm text-[#8f867b]">{c.loading}</div>:<div className="max-w-4xl">
      <div className="bg-[#2b2722] px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{c.property}</div>
      <dl className="text-sm">
        <ProfileRow label={c.name} value={property?.object_name??c.unavailable}/>
        <ProfileRow label={c.type} value={property?.facility_type??c.unavailable}/>
        <ProfileRow label={c.address} value={address||c.unavailable}/>
        <ProfileRow label={c.phone} value={property?.phone??c.unavailable}/>
        <ProfileRow label={c.email} value={property?.email??c.unavailable}/>
        <ProfileRow label={c.website} value={property?.website??c.unavailable}/>
        <ProfileRow label={c.facebook} value={property?.facebook??c.unavailable}/>
      </dl>
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

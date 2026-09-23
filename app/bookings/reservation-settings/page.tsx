"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { BOOKING_TIME_ZONE } from "@/lib/booking/timezone"

type Settings = {
  id:string
  timezone:string|null
  check_in_time:string|null
  check_out_time:string|null
  free_cancellation_days_before:number|null
  paid_cancellation_days_before:number|null
  towels_enabled:boolean|null
  towels_every_days:number|null
  towels_after_checkout:boolean|null
  bedding_enabled:boolean|null
  bedding_every_days:number|null
  bedding_after_checkout:boolean|null
  cleaning_enabled:boolean|null
}

type PublicSettings = {
  id:string
  public_booking_enabled:boolean
  availability_inquiries_enabled:boolean
  children_selector_enabled:boolean
  dining_options_enabled:boolean
  availability_calendar_enabled:boolean
  hide_provider_branding:boolean
  language:string
  accent_color:string
  public_booking_url:string|null
  source_system:string|null
}

const copy={
  en:{title:"Reservation system",subtitle:"Canonical stay defaults and public reservation-system controls.",stay:"Stay times",timezone:"Booking timezone",timezoneHelp:"All booking dates and operational times use Santiago including DST.",checkIn:"Check-in",checkOut:"Check-out",cancellation:"Cancellation",free:"Free cancellation until",paid:"Paid cancellation window",days:"days before arrival",operations:"Stay operations",towels:"Towels",bedding:"Bedding",cleaning:"Cleaning",every:"every",afterCheckout:"after checkout",publicSystem:"Public reservation system",publicBooking:"Public booking",inquiries:"Availability inquiries",children:"Children selector",dining:"Dining options",calendar:"Availability calendar",branding:"Hide provider branding",language:"Language",accent:"Accent color",sourceUrl:"Legacy/reference URL",sourceNote:"The BedBooking URL is preserved only as migration evidence. Black Swan does not depend on it.",save:"Save configuration",saved:"Reservation configuration saved.",invalid:"Use valid times, non-negative whole-day values and a valid hex accent color.",loading:"Loading…"},
  es:{title:"Sistema de reservas",subtitle:"Valores canónicos de estadía y controles del sistema público de reservas.",stay:"Horarios de estadía",timezone:"Zona horaria de Booking",timezoneHelp:"Todas las fechas y horas usan Santiago, incluyendo cambios de horario.",checkIn:"Check-in",checkOut:"Check-out",cancellation:"Cancelación",free:"Cancelación gratuita hasta",paid:"Ventana de cancelación pagada",days:"días antes de la llegada",operations:"Operación de estadía",towels:"Toallas",bedding:"Ropa de cama",cleaning:"Limpieza",every:"cada",afterCheckout:"después del check-out",publicSystem:"Sistema público de reservas",publicBooking:"Reserva pública",inquiries:"Consultas de disponibilidad",children:"Selector de niños",dining:"Opciones de alimentación",calendar:"Calendario de disponibilidad",branding:"Ocultar marca del proveedor",language:"Idioma",accent:"Color de acento",sourceUrl:"URL histórica / referencia",sourceNote:"La URL de BedBooking se conserva sólo como evidencia de migración. Black Swan no depende de ella.",save:"Guardar configuración",saved:"Configuración de reservas guardada.",invalid:"Usa horarios válidos, días enteros no negativos y un color hexadecimal válido.",loading:"Cargando…"},
  de:{title:"Reservierungssystem",subtitle:"Kanonische Aufenthaltswerte und öffentliche Reservierungseinstellungen.",stay:"Aufenthaltszeiten",timezone:"Booking-Zeitzone",timezoneHelp:"Alle Buchungsdaten und Betriebszeiten verwenden Santiago inklusive Sommerzeit.",checkIn:"Check-in",checkOut:"Check-out",cancellation:"Stornierung",free:"Kostenlose Stornierung bis",paid:"Kostenpflichtiges Fenster",days:"Tage vor Anreise",operations:"Aufenthaltsbetrieb",towels:"Handtücher",bedding:"Bettwäsche",cleaning:"Reinigung",every:"alle",afterCheckout:"nach Check-out",publicSystem:"Öffentliches Reservierungssystem",publicBooking:"Öffentliche Buchung",inquiries:"Verfügbarkeitsanfragen",children:"Kinderauswahl",dining:"Verpflegungsoptionen",calendar:"Verfügbarkeitskalender",branding:"Provider-Branding ausblenden",language:"Sprache",accent:"Akzentfarbe",sourceUrl:"Historische / Referenz-URL",sourceNote:"Die BedBooking-URL bleibt nur als Migrationsnachweis erhalten. Black Swan hängt nicht davon ab.",save:"Konfiguration speichern",saved:"Reservierungskonfiguration gespeichert.",invalid:"Gültige Zeiten, nicht negative ganze Tage und gültige Hex-Farbe verwenden.",loading:"Lädt…"},
} as const

function normalizeTime(value:string|null,fallback:string){return (value||fallback).slice(0,5)}

export default function BookingReservationSettingsPage(){
  const {language}=useLanguage(); const c=copy[language]
  const supabase=useMemo(()=>createClient(),[])
  const [settings,setSettings]=useState<Settings|null>(null)
  const [publicSettings,setPublicSettings]=useState<PublicSettings|null>(null)
  const [form,setForm]=useState({check_in_time:"14:00",check_out_time:"10:00",free_cancellation_days_before:"0",paid_cancellation_days_before:"0",towels_enabled:true,towels_every_days:"3",towels_after_checkout:true,bedding_enabled:true,bedding_every_days:"5",bedding_after_checkout:true,cleaning_enabled:true})
  const [publicForm,setPublicForm]=useState({public_booking_enabled:false,availability_inquiries_enabled:true,children_selector_enabled:true,dining_options_enabled:true,availability_calendar_enabled:true,hide_provider_branding:true,language:"en",accent_color:"#00a541"})
  const [saving,setSaving]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)

  const load=useCallback(async()=>{
    setLoading(true)
    const [settingsResult,publicResult]=await Promise.all([
      supabase.from("booking_settings").select("id,timezone,check_in_time,check_out_time,free_cancellation_days_before,paid_cancellation_days_before,towels_enabled,towels_every_days,towels_after_checkout,bedding_enabled,bedding_every_days,bedding_after_checkout,cleaning_enabled").eq("id","default").maybeSingle(),
      supabase.from("booking_public_reservation_settings").select("id,public_booking_enabled,availability_inquiries_enabled,children_selector_enabled,dining_options_enabled,availability_calendar_enabled,hide_provider_branding,language,accent_color,public_booking_url,source_system").eq("id","default").maybeSingle(),
    ])
    const first=settingsResult.error||publicResult.error
    if(first){setError(first.message);setLoading(false);return}
    const row=settingsResult.data as Settings|null
    const pub=publicResult.data as PublicSettings|null
    setSettings(row);setPublicSettings(pub)
    if(row)setForm({check_in_time:normalizeTime(row.check_in_time,"14:00"),check_out_time:normalizeTime(row.check_out_time,"10:00"),free_cancellation_days_before:String(Number(row.free_cancellation_days_before??0)),paid_cancellation_days_before:String(Number(row.paid_cancellation_days_before??0)),towels_enabled:Boolean(row.towels_enabled),towels_every_days:String(Number(row.towels_every_days??0)),towels_after_checkout:Boolean(row.towels_after_checkout),bedding_enabled:Boolean(row.bedding_enabled),bedding_every_days:String(Number(row.bedding_every_days??0)),bedding_after_checkout:Boolean(row.bedding_after_checkout),cleaning_enabled:Boolean(row.cleaning_enabled)})
    if(pub)setPublicForm({public_booking_enabled:Boolean(pub.public_booking_enabled),availability_inquiries_enabled:Boolean(pub.availability_inquiries_enabled),children_selector_enabled:Boolean(pub.children_selector_enabled),dining_options_enabled:Boolean(pub.dining_options_enabled),availability_calendar_enabled:Boolean(pub.availability_calendar_enabled),hide_provider_branding:Boolean(pub.hide_provider_branding),language:pub.language||"en",accent_color:pub.accent_color||"#00a541"})
    setError(null);setLoading(false)
  },[supabase])

  useEffect(()=>{void load()},[load])

  async function save(){
    const freeDays=Number(form.free_cancellation_days_before),paidDays=Number(form.paid_cancellation_days_before),towelDays=Number(form.towels_every_days),beddingDays=Number(form.bedding_every_days)
    if(![freeDays,paidDays,towelDays,beddingDays].every(v=>Number.isInteger(v)&&v>=0)||!/^d{2}:d{2}$/.test(form.check_in_time)||!/^d{2}:d{2}$/.test(form.check_out_time)||!/^#[0-9a-fA-F]{6}$/.test(publicForm.accent_color)){setError(c.invalid);return}
    setSaving(true);setError(null);setNotice(null)
    const operational={timezone:BOOKING_TIME_ZONE,check_in_time:form.check_in_time,check_out_time:form.check_out_time,free_cancellation_days_before:freeDays,paid_cancellation_days_before:paidDays,towels_enabled:form.towels_enabled,towels_every_days:towelDays,towels_after_checkout:form.towels_after_checkout,bedding_enabled:form.bedding_enabled,bedding_every_days:beddingDays,bedding_after_checkout:form.bedding_after_checkout,cleaning_enabled:form.cleaning_enabled,updated_at:new Date().toISOString()}
    const publicPayload={...publicForm,updated_at:new Date().toISOString()}
    const [opResult,pubResult]=await Promise.all([
      settings?supabase.from("booking_settings").update(operational).eq("id","default"):supabase.from("booking_settings").insert({id:"default",...operational}),
      publicSettings?supabase.from("booking_public_reservation_settings").update(publicPayload).eq("id","default"):supabase.from("booking_public_reservation_settings").insert({id:"default",...publicPayload}),
    ])
    const first=opResult.error||pubResult.error
    if(first)setError(first.message);else{setNotice(c.saved);await load()}
    setSaving(false)
  }

  const toggle=(key:"towels_enabled"|"towels_after_checkout"|"bedding_enabled"|"bedding_after_checkout"|"cleaning_enabled")=>setForm(current=>({...current,[key]:!current[key]}))
  const togglePublic=(key:keyof typeof publicForm)=>{if(typeof publicForm[key]!=="boolean")return;setPublicForm(current=>({...current,[key]:!current[key]}))}

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error?<div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    {notice?<div className="bg-[#253128] px-4 py-2 text-xs text-[#a8c2ad]">{notice}</div>:null}
    {loading?<div className="px-5 py-10 text-sm text-[#8f867b]">{c.loading}</div>:<div className="max-w-5xl p-5">
      <Block title={c.stay}><div className="mb-px bg-[#211e1a] p-4"><div className="text-xs text-[#b9b0a4]">{c.timezone}</div><div className="mt-1 text-sm">{settings?.timezone||BOOKING_TIME_ZONE}</div><div className="mt-1 text-[11px] text-[#8f867b]">{c.timezoneHelp}</div></div><div className="grid gap-px bg-[#39342d] sm:grid-cols-2"><TimeField label={c.checkIn} value={form.check_in_time} onChange={value=>setForm({...form,check_in_time:value})}/><TimeField label={c.checkOut} value={form.check_out_time} onChange={value=>setForm({...form,check_out_time:value})}/></div></Block>
      <Block title={c.cancellation}><div className="grid gap-px bg-[#39342d] sm:grid-cols-2"><NumberField label={c.free} value={form.free_cancellation_days_before} suffix={c.days} onChange={value=>setForm({...form,free_cancellation_days_before:value})}/><NumberField label={c.paid} value={form.paid_cancellation_days_before} suffix={c.days} onChange={value=>setForm({...form,paid_cancellation_days_before:value})}/></div></Block>
      <Block title={c.operations}><div className="divide-y divide-[#39342d] bg-[#211e1a]"><OperationRow label={c.towels} enabled={form.towels_enabled} every={form.towels_every_days} after={form.towels_after_checkout} onEnabled={()=>toggle("towels_enabled")} onEvery={value=>setForm({...form,towels_every_days:value})} onAfter={()=>toggle("towels_after_checkout")} everyLabel={c.every} daysLabel={c.days} afterLabel={c.afterCheckout}/><OperationRow label={c.bedding} enabled={form.bedding_enabled} every={form.bedding_every_days} after={form.bedding_after_checkout} onEnabled={()=>toggle("bedding_enabled")} onEvery={value=>setForm({...form,bedding_every_days:value})} onAfter={()=>toggle("bedding_after_checkout")} everyLabel={c.every} daysLabel={c.days} afterLabel={c.afterCheckout}/><ToggleRow label={c.cleaning} enabled={form.cleaning_enabled} onToggle={()=>toggle("cleaning_enabled")}/></div></Block>
      <Block title={c.publicSystem}><div className="divide-y divide-[#39342d] bg-[#211e1a]"><ToggleRow label={c.publicBooking} enabled={publicForm.public_booking_enabled} onToggle={()=>togglePublic("public_booking_enabled")}/><ToggleRow label={c.inquiries} enabled={publicForm.availability_inquiries_enabled} onToggle={()=>togglePublic("availability_inquiries_enabled")}/><ToggleRow label={c.children} enabled={publicForm.children_selector_enabled} onToggle={()=>togglePublic("children_selector_enabled")}/><ToggleRow label={c.dining} enabled={publicForm.dining_options_enabled} onToggle={()=>togglePublic("dining_options_enabled")}/><ToggleRow label={c.calendar} enabled={publicForm.availability_calendar_enabled} onToggle={()=>togglePublic("availability_calendar_enabled")}/><ToggleRow label={c.branding} enabled={publicForm.hide_provider_branding} onToggle={()=>togglePublic("hide_provider_branding")}/><div className="grid gap-px bg-[#39342d] sm:grid-cols-2"><label className="bg-[#211e1a] p-4 text-xs"><span className="mb-2 block text-[#b9b0a4]">{c.language}</span><select value={publicForm.language} onChange={e=>setPublicForm({...publicForm,language:e.target.value})} className="h-9 w-full bg-[#171512] px-2"><option value="en">English</option><option value="es">Español</option><option value="de">Deutsch</option></select></label><label className="bg-[#211e1a] p-4 text-xs"><span className="mb-2 block text-[#b9b0a4]">{c.accent}</span><input value={publicForm.accent_color} onChange={e=>setPublicForm({...publicForm,accent_color:e.target.value})} className="h-9 w-full bg-[#171512] px-2 font-mono"/></label></div>{publicSettings?.public_booking_url?<div className="p-4 text-xs"><div className="text-[#b9b0a4]">{c.sourceUrl}</div><div className="mt-1 font-mono text-[#e7e1d8]">{publicSettings.public_booking_url}</div><div className="mt-2 text-[11px] leading-5 text-[#8f867b]">{c.sourceNote}</div></div>:null}</div></Block>
      <button type="button" disabled={saving} onClick={()=>void save()} className="h-9 bg-[#6f8373] px-4 text-xs font-medium text-[#171512] disabled:opacity-50">{c.save}</button>
    </div>}
  </section>
}

function Block({title,children}:{title:string;children:React.ReactNode}){return <div className="mb-5"><h2 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{title}</h2>{children}</div>}
function TimeField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label className="bg-[#211e1a] p-4"><span className="mb-2 block text-xs text-[#b9b0a4]">{label}</span><input type="time" value={value} onChange={e=>onChange(e.target.value)} className="h-9 w-full bg-[#171512] px-3 text-sm"/></label>}
function NumberField({label,value,suffix,onChange}:{label:string;value:string;suffix:string;onChange:(value:string)=>void}){return <label className="bg-[#211e1a] p-4"><span className="mb-2 block text-xs text-[#b9b0a4]">{label}</span><div className="flex items-center gap-2"><input type="number" min="0" step="1" value={value} onChange={e=>onChange(e.target.value)} className="h-9 w-full bg-[#171512] px-3 text-sm"/><span className="text-xs text-[#8f867b]">{suffix}</span></div></label>}
function ToggleRow({label,enabled,onToggle}:{label:string;enabled:boolean;onToggle:()=>void}){return <div className="flex items-center justify-between px-4 py-3"><span className="text-xs">{label}</span><button type="button" onClick={onToggle} className={`h-7 min-w-16 px-2 text-[11px] ${enabled?"bg-[#6f8373] text-[#171512]":"bg-[#2b2722] text-[#8f867b]"}`}>{enabled?"ON":"OFF"}</button></div>}
function OperationRow({label,enabled,every,after,onEnabled,onEvery,onAfter,everyLabel,daysLabel,afterLabel}:{label:string;enabled:boolean;every:string;after:boolean;onEnabled:()=>void;onEvery:(value:string)=>void;onAfter:()=>void;everyLabel:string;daysLabel:string;afterLabel:string}){return <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div className="flex items-center justify-between gap-3"><span className="text-xs">{label}</span><button type="button" onClick={onEnabled} className={`h-7 min-w-16 px-2 text-[11px] ${enabled?"bg-[#6f8373] text-[#171512]":"bg-[#2b2722] text-[#8f867b]"}`}>{enabled?"ON":"OFF"}</button></div><label className="flex items-center gap-2 text-[11px] text-[#8f867b]">{everyLabel}<input type="number" min="0" step="1" value={every} onChange={e=>onEvery(e.target.value)} className="h-8 w-16 bg-[#171512] px-2 text-xs text-[#e7e1d8]"/>{daysLabel}</label><label className="flex items-center gap-2 text-[11px] text-[#8f867b]"><input type="checkbox" checked={after} onChange={onAfter}/>{afterLabel}</label></div>}

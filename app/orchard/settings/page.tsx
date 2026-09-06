"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Save } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type Settings = {
  id:string; farm_key:string; farm_name:string; country_code:string; currency:string; farm_address:string|null; farm_city:string|null; farm_state:string|null; postal_code:string|null;
  latitude:number|null; longitude:number|null; measurement_system:"metric"|"imperial"; temperature_unit:"celsius"|"fahrenheit"; planting_amount_unit:"bed"|"bed_meter";
  standard_bed_width_cm:number|string; standard_bed_length_m:number|string; standard_path_width_cm:number|string;
  last_hard_frost_md:string|null; last_light_frost_md:string|null; first_light_frost_md:string|null; first_hard_frost_md:string|null; frost_source:string|null;
  weather_timezone:string|null; weather_provider:string|null; weather_enabled:boolean|null; first_weekday:string|null; updated_at:string
}
type Plan = { id:string; name:string; season:string|null; start_date:string|null; end_date:string|null; status:string }

const copy = {
  en:{title:"Farm settings",farmInfo:"Farm Info",farmName:"Farm name",fullAddress:"Farm address",country:"Country",currency:"Currency",latitude:"Latitude",longitude:"Longitude",timezone:"Timezone",measurement:"Measurement System",imperial:"Imperial",metric:"Metric",season:"Season",seasonName:"Season",startSeason:"Start of season",temperature:"Temperature unit",plantingAmount:"Planting amount",firstWeekday:"First weekday",bed:"Bed",bedMeter:"Bed meter",notSet:"Not set",sunday:"Sunday",monday:"Monday",tuesday:"Tuesday",wednesday:"Wednesday",thursday:"Thursday",friday:"Friday",saturday:"Saturday",frost:"Frost Dates",frostHelp:"Canonical frost presets only. No weather-derived date is inferred here.",frostSource:"Evidence source",lastHard:"Last hard frost date",lastLight:"Last light frost date",firstLight:"First light frost date",firstHard:"First hard frost date",dimensions:"Bed Standards",dimensionsHelp:"Black Swan physical planning dimensions. These remain separate from Heirloom reference data.",bedWidth:"Bed width",bedLength:"Bed length",pathWidth:"Path width",save:"Save",saving:"Saving…",saved:"Settings saved",error:"Could not save farm settings.",loading:"Loading settings…",help:"Canonical farm configuration, arranged in the same operator groups used by Heirloom without inventing missing values."},
  es:{title:"Configuración de granja",farmInfo:"Datos de la granja",farmName:"Nombre de la granja",fullAddress:"Dirección de la granja",country:"País",currency:"Moneda",latitude:"Latitud",longitude:"Longitud",timezone:"Zona horaria",measurement:"Sistema de medición",imperial:"Imperial",metric:"Métrico",season:"Temporada",seasonName:"Temporada",startSeason:"Inicio de temporada",temperature:"Unidad de temperatura",plantingAmount:"Cantidad de plantación",firstWeekday:"Primer día de la semana",bed:"Cama",bedMeter:"Metro de cama",notSet:"Sin configurar",sunday:"Domingo",monday:"Lunes",tuesday:"Martes",wednesday:"Miércoles",thursday:"Jueves",friday:"Viernes",saturday:"Sábado",frost:"Fechas de heladas",frostHelp:"Sólo fechas canónicas registradas. Aquí no se infieren fechas a partir del clima.",frostSource:"Fuente de evidencia",lastHard:"Última helada fuerte",lastLight:"Última helada ligera",firstLight:"Primera helada ligera",firstHard:"Primera helada fuerte",dimensions:"Estándares de cama",dimensionsHelp:"Dimensiones físicas de planificación de Black Swan, separadas de los datos de referencia de Heirloom.",bedWidth:"Ancho de cama",bedLength:"Largo de cama",pathWidth:"Ancho de pasillo",save:"Guardar",saving:"Guardando…",saved:"Configuración guardada",error:"No fue posible guardar la configuración.",loading:"Cargando configuración…",help:"Configuración canónica de la granja organizada en los mismos grupos operativos de Heirloom, sin inventar valores faltantes."},
  de:{title:"Hofeinstellungen",farmInfo:"Hofdaten",farmName:"Hofname",fullAddress:"Hofadresse",country:"Land",currency:"Währung",latitude:"Breitengrad",longitude:"Längengrad",timezone:"Zeitzone",measurement:"Maßsystem",imperial:"Imperial",metric:"Metrisch",season:"Saison",seasonName:"Saison",startSeason:"Saisonbeginn",temperature:"Temperatureinheit",plantingAmount:"Pflanzmenge",firstWeekday:"Erster Wochentag",bed:"Beet",bedMeter:"Beetmeter",notSet:"Nicht festgelegt",sunday:"Sonntag",monday:"Montag",tuesday:"Dienstag",wednesday:"Mittwoch",thursday:"Donnerstag",friday:"Freitag",saturday:"Samstag",frost:"Frosttermine",frostHelp:"Nur kanonisch erfasste Frosttermine. Es werden hier keine Wetterdaten abgeleitet.",frostSource:"Evidenzquelle",lastHard:"Letzter harter Frost",lastLight:"Letzter leichter Frost",firstLight:"Erster leichter Frost",firstHard:"Erster harter Frost",dimensions:"Beetstandards",dimensionsHelp:"Physische Black-Swan-Planungsmaße, getrennt von Heirloom-Referenzdaten.",bedWidth:"Beetbreite",bedLength:"Beetlänge",pathWidth:"Wegbreite",save:"Speichern",saving:"Speichern…",saved:"Einstellungen gespeichert",error:"Hofeinstellungen konnten nicht gespeichert werden.",loading:"Einstellungen werden geladen…",help:"Kanonische Hofkonfiguration in denselben Arbeitsgruppen wie Heirloom, ohne fehlende Werte zu erfinden."}
} as const

const blank:Settings = {id:"",farm_key:"black_swan_orchard",farm_name:"Black Swan Orchard",country_code:"CL",currency:"CLP",farm_address:"",farm_city:"",farm_state:"",postal_code:"",latitude:null,longitude:null,measurement_system:"metric",temperature_unit:"celsius",planting_amount_unit:"bed_meter",standard_bed_width_cm:76,standard_bed_length_m:10,standard_path_width_cm:40,last_hard_frost_md:null,last_light_frost_md:null,first_light_frost_md:null,first_hard_frost_md:null,frost_source:null,weather_timezone:null,weather_provider:null,weather_enabled:null,first_weekday:null,updated_at:""}
function mdFromDate(value:string|null){if(!value)return "—";const [,m,d]=value.split("-");return m&&d?`${d}/${m}`:"—"}

export default function OrchardSettingsPage(){
  const {language}=useLanguage(); const lang:Locale=language; const text=copy[lang]; const supabase=useMemo(()=>createBrowserClient(),[]); const searchParams=useSearchParams()
  const [settings,setSettings]=useState<Settings>(blank); const [plans,setPlans]=useState<Plan[]>([]); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState<string|null>(null); const [error,setError]=useState<string|null>(null)

  useEffect(()=>{let live=true;void Promise.all([
    supabase.from("orchard_farm_settings").select("*").eq("farm_key","black_swan_orchard").single(),
    supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date",{ascending:false}),
  ]).then(([s,p])=>{if(!live)return;if(s.error)setError(s.error.message);else setSettings({...blank,...(s.data as Settings)});setPlans((p.data??[]) as Plan[]);setLoading(false)});return()=>{live=false}},[supabase])

  const requested=searchParams.get("game_plan")
  const plan=plans.find(p=>p.id===requested)??plans.find(p=>p.status==="active")??plans.find(p=>p.status==="draft")??plans[0]??null
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(current=>({...current,[key]:value}))
  const save=async(event:FormEvent)=>{event.preventDefault();setSaving(true);setMessage(null);setError(null);const payload={farm_name:settings.farm_name,country_code:settings.country_code,currency:settings.currency,farm_address:settings.farm_address||null,farm_city:settings.farm_city||null,farm_state:settings.farm_state||null,postal_code:settings.postal_code||null,latitude:settings.latitude==null?null:Number(settings.latitude),longitude:settings.longitude==null?null:Number(settings.longitude),measurement_system:settings.measurement_system,temperature_unit:settings.temperature_unit,planting_amount_unit:settings.planting_amount_unit,standard_bed_width_cm:Number(settings.standard_bed_width_cm),standard_bed_length_m:Number(settings.standard_bed_length_m),standard_path_width_cm:Number(settings.standard_path_width_cm),last_hard_frost_md:settings.last_hard_frost_md||null,last_light_frost_md:settings.last_light_frost_md||null,first_light_frost_md:settings.first_light_frost_md||null,first_hard_frost_md:settings.first_hard_frost_md||null,weather_timezone:settings.weather_timezone||null,first_weekday:settings.first_weekday||null};const result=await supabase.from("orchard_farm_settings").update(payload).eq("id",settings.id).select("*").single();if(result.error)setError(text.error);else{setSettings({...blank,...(result.data as Settings)});setMessage(text.saved)}setSaving(false)}

  if(loading)return <AppLayout><OrchardNavigation/><main className="p-8 text-sm text-muted-foreground">{text.loading}</main></AppLayout>
  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1380px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
    <form id="orchard-farm-settings" onSubmit={save}>
      <header className="flex flex-col gap-3 border-b border-[var(--orchard-line)] pb-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-[25px] font-normal tracking-[-.03em]">{text.title}</h1><p className="mt-1 max-w-3xl text-[12px] leading-5 text-muted-foreground">{text.help}</p></div><button type="submit" disabled={saving} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] px-4 text-xs font-medium text-foreground transition-colors hover:bg-[var(--bs-surface-secondary)] disabled:opacity-50"><Save className="h-4 w-4 text-[var(--orchard-green)]"/>{saving?text.saving:text.save}</button></header>
      {message?<p className="mt-3 border-l-2 border-[var(--orchard-green)] pl-3 text-xs text-muted-foreground">{message}</p>:null}{error?<p className="mt-3 border-l-2 border-red-400 pl-3 text-xs text-red-300">{error}</p>:null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.85fr)]">
        <div className="space-y-4">
          <Card title={text.farmInfo}>
            <div className="grid gap-3 md:grid-cols-12">
              <Field label={text.farmName} className="md:col-span-5"><input value={settings.farm_name} onChange={e=>update("farm_name",e.target.value)} className="farm-field"/></Field>
              <Field label={text.country} className="md:col-span-3"><input value={settings.country_code} onChange={e=>update("country_code",e.target.value.toUpperCase())} maxLength={2} className="farm-field"/></Field>
              <Field label={text.currency} className="md:col-span-4"><input value={settings.currency} onChange={e=>update("currency",e.target.value.toUpperCase())} maxLength={3} className="farm-field"/></Field>
              <Field label={text.fullAddress} className="md:col-span-8"><input value={settings.farm_address??""} onChange={e=>update("farm_address",e.target.value)} className="farm-field"/></Field>
              <Field label={text.latitude} className="md:col-span-2"><input type="number" step="0.000001" value={settings.latitude??""} onChange={e=>update("latitude",e.target.value===""?null:Number(e.target.value))} className="farm-field"/></Field>
              <Field label={text.longitude} className="md:col-span-2"><input type="number" step="0.000001" value={settings.longitude??""} onChange={e=>update("longitude",e.target.value===""?null:Number(e.target.value))} className="farm-field"/></Field>
            </div>
          </Card>

          <Card title={text.season}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ReadField label={text.seasonName} value={plan?.season??plan?.name??text.notSet}/>
              <ReadField label={text.startSeason} value={mdFromDate(plan?.start_date??null)}/>
              <Field label={text.firstWeekday}><select value={settings.first_weekday??""} onChange={e=>update("first_weekday",e.target.value||null)} className="farm-field"><option value="">{text.notSet}</option><option value="sunday">{text.sunday}</option><option value="monday">{text.monday}</option><option value="tuesday">{text.tuesday}</option><option value="wednesday">{text.wednesday}</option><option value="thursday">{text.thursday}</option><option value="friday">{text.friday}</option><option value="saturday">{text.saturday}</option></select></Field>
              <Field label={text.plantingAmount}><select value={settings.planting_amount_unit} onChange={e=>update("planting_amount_unit",e.target.value as Settings["planting_amount_unit"])} className="farm-field"><option value="bed">{text.bed}</option><option value="bed_meter">{text.bedMeter}</option></select></Field>
              <Field label={text.timezone} className="sm:col-span-2 lg:col-span-4"><input value={settings.weather_timezone??""} onChange={e=>update("weather_timezone",e.target.value)} placeholder="America/Santiago" className="farm-field"/></Field>
            </div>
          </Card>

          <Card title={text.dimensions} help={text.dimensionsHelp}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={text.bedWidth}><div className="relative"><input type="number" min="1" step="1" value={settings.standard_bed_width_cm} onChange={e=>update("standard_bed_width_cm",e.target.value)} className="farm-field pr-10"/><Unit>cm</Unit></div></Field>
              <Field label={text.bedLength}><div className="relative"><input type="number" min="1" step="0.1" value={settings.standard_bed_length_m} onChange={e=>update("standard_bed_length_m",e.target.value)} className="farm-field pr-8"/><Unit>m</Unit></div></Field>
              <Field label={text.pathWidth}><div className="relative"><input type="number" min="0" step="1" value={settings.standard_path_width_cm} onChange={e=>update("standard_path_width_cm",e.target.value)} className="farm-field pr-10"/><Unit>cm</Unit></div></Field>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={text.frost} help={text.frostHelp}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label={text.lastHard}><input value={settings.last_hard_frost_md??""} onChange={e=>update("last_hard_frost_md",e.target.value||null)} placeholder="MM-DD" className="farm-field"/></Field>
              <Field label={text.lastLight}><input value={settings.last_light_frost_md??""} onChange={e=>update("last_light_frost_md",e.target.value||null)} placeholder="MM-DD" className="farm-field"/></Field>
              <Field label={text.firstLight}><input value={settings.first_light_frost_md??""} onChange={e=>update("first_light_frost_md",e.target.value||null)} placeholder="MM-DD" className="farm-field"/></Field>
              <Field label={text.firstHard}><input value={settings.first_hard_frost_md??""} onChange={e=>update("first_hard_frost_md",e.target.value||null)} placeholder="MM-DD" className="farm-field"/></Field>
            </div>
            <div className="mt-4 border-t border-[var(--orchard-line-soft)] pt-3"><span className="text-[9px] uppercase tracking-[.1em] text-muted-foreground">{text.frostSource}</span><p className="mt-1 text-[11px] text-[#c9c1b6]">{settings.frost_source??text.notSet}</p></div>
          </Card>

          <Card title={text.measurement}>
            <div className="grid grid-cols-2 gap-2"><Choice active={settings.measurement_system==="imperial"} onClick={()=>update("measurement_system","imperial")} label={text.imperial}/><Choice active={settings.measurement_system==="metric"} onClick={()=>update("measurement_system","metric")} label={text.metric}/></div>
            <div className="mt-3"><Field label={text.temperature}><select value={settings.temperature_unit} onChange={e=>update("temperature_unit",e.target.value as Settings["temperature_unit"])} className="farm-field"><option value="celsius">°C</option><option value="fahrenheit">°F</option></select></Field></div>
          </Card>
        </div>
      </div>
    </form>
    <style jsx global>{`.farm-field{height:42px;width:100%;border:1px solid var(--orchard-line);border-radius:10px;background:#191815;padding:0 12px;font-size:12px;color:var(--foreground);outline:none;transition:border-color .16s ease,background .16s ease}.farm-field:focus{border-color:var(--orchard-green);background:#1d1b18}.farm-field option{background:#171614}`}</style>
  </main></AppLayout>
}

function Card({title,help,children}:{title:string;help?:string;children:React.ReactNode}){return <section className="rounded-[18px] border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-4 shadow-[0_14px_40px_rgba(0,0,0,.08)] sm:p-5"><div className="mb-4"><h2 className="text-[15px] font-medium text-[#eee9e1]">{title}</h2>{help?<p className="mt-1 max-w-2xl text-[10px] leading-4 text-muted-foreground">{help}</p>:null}</div>{children}</section>}
function Field({label,children,className=""}:{label:string;children:React.ReactNode;className?:string}){return <label className={className}><span className="mb-1.5 block text-[9px] uppercase tracking-[.08em] text-muted-foreground">{label}</span>{children}</label>}
function ReadField({label,value}:{label:string;value:string}){return <div><span className="mb-1.5 block text-[9px] uppercase tracking-[.08em] text-muted-foreground">{label}</span><div className="flex h-[42px] items-center rounded-[10px] border border-[var(--orchard-line)] bg-[#171614] px-3 text-[12px] text-[#d8d1c7]">{value}</div></div>}
function Choice({active,onClick,label}:{active:boolean;onClick:()=>void;label:string}){return <button type="button" onClick={onClick} className={`h-[42px] rounded-[10px] border px-3 text-left text-[12px] transition-colors ${active?"border-[var(--orchard-green)] bg-[#14382d] text-[#bde1cf]":"border-[var(--orchard-line)] bg-[#191815] text-[#c4bcb1] hover:bg-[var(--bs-surface-secondary)]"}`}>{label}</button>}
function Unit({children}:{children:React.ReactNode}){return <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[.08em] text-muted-foreground">{children}</span>}

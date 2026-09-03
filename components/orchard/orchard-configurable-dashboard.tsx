"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  CloudRain,
  CloudSun,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Leaf,
  Pencil,
  RotateCcw,
  Sprout,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { cropColor } from "@/lib/orchard/crop-identity"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type Locale = "en" | "es" | "de"
type DashboardView = "operation" | "planning"
type WidgetKey = "tasks" | "weather" | "revenue" | "notepad" | "notes" | "crops" | "milestones"
type Plan = { id:string; name:string; season:string|null; status:string; start_date:string|null; end_date:string|null }
type Cycle = { id:string; game_plan_id:string; crop_name:string; cycle_type:string }
type Succession = { id:string; crop_cycle_id:string; sequence_no:number; planned_sow_date:string|null; planned_transplant_date:string|null; planned_first_harvest_date:string|null; planned_last_harvest_date:string|null; planned_bed_m:number|null; knowledge_source_snapshot:Record<string,unknown>|null; status:string }
type Allocation = { crop_succession_id:string }
type Task = { id:string; title:string; status:string; due_date:string|null; location_name:string|null; estimated_minutes:number|null; priority:string|null; source_type:string|null; source_id:string|null }
type Assignment = { task_id:string; employee_id:string|null }
type Employee = { id:string; name:string }
type Note = { id:string; title:string|null; body:string; note_type:string; observed_at:string }
type Preference = { active_view:DashboardView; operation_widget_order:unknown; planning_widget_order:unknown; operation_hidden_widgets:unknown; planning_hidden_widgets:unknown; notepad:string }
type Canonical = { yield_per_week_10m_bed?:number|string|null; price_per_unit_clp?:number|string|null; yield_unit?:string|null }
type WeatherDaily = { time:string[]; weather_code:number[]; temperature_2m_mean:number[]; temperature_2m_max:number[]; temperature_2m_min:number[]; precipitation_probability_max:number[]; precipitation_sum:number[] }
type WeatherPayload = { source:string; timezone:string; unit:string; daily:WeatherDaily|null; error?:string }
type CropSummary = { name:string; bedM:number; successions:number }
type EventRow = { date:string; label:string; crop:string; sequence:number }

const ALL_WIDGETS:WidgetKey[] = ["tasks","weather","revenue","notepad","notes","crops","milestones"]
const DEFAULT_ORDER:Record<DashboardView,WidgetKey[]> = {
  operation:["tasks","weather","revenue","notepad","notes","crops","milestones"],
  planning:["revenue","crops","milestones","tasks","weather","notes","notepad"],
}

const copy = {
  en:{eyebrow:"Orchard · Dashboard",title:"Farm dashboard",operation:"Weekly operation",planning:"Planning",edit:"Edit layout",done:"Done",reset:"Reset layout",editHelp:"Drag widgets to reorder them. Hide anything you do not need; your layout is saved to your user profile.",seasonTasks:"Planned tasks for season",weekTasks:"Planned tasks for week",todayTasks:"Tasks due today",openWeek:"Open tasks next 7 days",weather:"Week weather",weatherError:"Weather temporarily unavailable",weatherSource:"Forecast source",revenue:"Estimated Revenue by Month",revenueHelp:"Only source-backed Black Swan yield and CLP price contribute. Missing prices remain excluded.",notepad:"Notepad",notepadPlaceholder:"write here...",notes:"Notes",newNote:"New note",noNotes:"You have not created any notes yet",crops:"Crop Distribution",bed:"bed m",plantings:"plantings",milestones:"Upcoming physical milestones",noMilestones:"No physical milestones in the next 7 days.",sow:"Direct sow",transplant:"Transplant",harvest:"First harvest",openTasks:"Open tasks",openNotes:"Open notes",openHarvest:"Open season harvests",visible:"Visible",hidden:"Hidden",saveError:"Could not save dashboard preferences.",loading:"Loading dashboard…"},
  es:{eyebrow:"Huerto · Dashboard",title:"Panel de la granja",operation:"Operación semanal",planning:"Planificación",edit:"Editar layout",done:"Listo",reset:"Restablecer",editHelp:"Arrastra los widgets para reordenarlos. Oculta lo que no necesitas; el layout queda guardado en tu perfil.",seasonTasks:"Tareas planificadas de temporada",weekTasks:"Tareas planificadas de la semana",todayTasks:"Tareas para hoy",openWeek:"Tareas abiertas próximos 7 días",weather:"Clima de la semana",weatherError:"Clima temporalmente no disponible",weatherSource:"Fuente del pronóstico",revenue:"Ingreso estimado por mes",revenueHelp:"Sólo aportan rendimiento y precio CLP respaldados por fuente Black Swan. Los precios faltantes se excluyen.",notepad:"Bloc de notas",notepadPlaceholder:"escribe aquí...",notes:"Notas",newNote:"Nueva nota",noNotes:"Todavía no has creado notas",crops:"Distribución de cultivos",bed:"m cama",plantings:"plantaciones",milestones:"Próximos hitos físicos",noMilestones:"No hay hitos físicos en los próximos 7 días.",sow:"Siembra directa",transplant:"Trasplante",harvest:"Primera cosecha",openTasks:"Abrir tareas",openNotes:"Abrir notas",openHarvest:"Abrir cosecha de temporada",visible:"Visible",hidden:"Oculto",saveError:"No fue posible guardar las preferencias del dashboard.",loading:"Cargando dashboard…"},
  de:{eyebrow:"Orchard · Dashboard",title:"Hof-Dashboard",operation:"Wochenbetrieb",planning:"Planung",edit:"Layout bearbeiten",done:"Fertig",reset:"Layout zurücksetzen",editHelp:"Widgets ziehen, um sie neu anzuordnen. Nicht benötigte Widgets ausblenden; das Layout wird im Benutzerprofil gespeichert.",seasonTasks:"Geplante Saisonaufgaben",weekTasks:"Geplante Wochenaufgaben",todayTasks:"Heute fällige Aufgaben",openWeek:"Offene Aufgaben nächste 7 Tage",weather:"Wochenwetter",weatherError:"Wetter vorübergehend nicht verfügbar",weatherSource:"Prognosequelle",revenue:"Geschätzter Umsatz pro Monat",revenueHelp:"Nur belegter Black-Swan-Ertrag und CLP-Preis tragen bei. Fehlende Preise bleiben ausgeschlossen.",notepad:"Notizblock",notepadPlaceholder:"hier schreiben...",notes:"Notizen",newNote:"Neue Notiz",noNotes:"Noch keine Notizen erstellt",crops:"Kulturverteilung",bed:"Beet-m",plantings:"Pflanzungen",milestones:"Nächste physische Meilensteine",noMilestones:"Keine physischen Meilensteine in den nächsten 7 Tagen.",sow:"Direktsaat",transplant:"Verpflanzung",harvest:"Erste Ernte",openTasks:"Aufgaben öffnen",openNotes:"Notizen öffnen",openHarvest:"Saisonernte öffnen",visible:"Sichtbar",hidden:"Ausgeblendet",saveError:"Dashboard-Einstellungen konnten nicht gespeichert werden.",loading:"Dashboard wird geladen…"},
} as const

const localeMap:Record<Locale,string> = { en:"en-US", es:"es-CL", de:"de-DE" }
const widgetNames:Record<WidgetKey,Record<Locale,string>> = {
  tasks:{en:"Tasks",es:"Tareas",de:"Aufgaben"}, weather:{en:"Weather",es:"Clima",de:"Wetter"}, revenue:{en:"Revenue",es:"Ingresos",de:"Umsatz"}, notepad:{en:"Notepad",es:"Bloc",de:"Notizblock"}, notes:{en:"Notes",es:"Notas",de:"Notizen"}, crops:{en:"Crops",es:"Cultivos",de:"Kulturen"}, milestones:{en:"Milestones",es:"Hitos",de:"Meilensteine"},
}

function validWidgets(value:unknown,fallback:WidgetKey[]){
  if(!Array.isArray(value)) return [...fallback]
  const valid=value.filter((item):item is WidgetKey=>typeof item==="string"&&ALL_WIDGETS.includes(item as WidgetKey))
  const missing=ALL_WIDGETS.filter(item=>!valid.includes(item))
  return [...valid,...missing]
}
function validHidden(value:unknown){return Array.isArray(value)?value.filter((item):item is WidgetKey=>typeof item==="string"&&ALL_WIDGETS.includes(item as WidgetKey)):[]}
function chileDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function addDays(value:string,days:number){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function mondayOf(value:string){const d=new Date(`${value}T12:00:00`);const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dateLabel(value:string,locale:string){return new Date(`${value}T12:00:00`).toLocaleDateString(locale,{weekday:"short",day:"2-digit",month:"short"})}
function asFinite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function canonicalFor(snapshot:Record<string,unknown>|null):Canonical{if(!snapshot)return{};const value=snapshot["black_swan_canonical"];return value&&typeof value==="object"?value as Canonical:{}}
function monthStart(value:string){return `${value.slice(0,7)}-01`}
function nextMonth(value:string){const d=new Date(`${value}T12:00:00`);d.setMonth(d.getMonth()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`}
function monthEnd(value:string){return addDays(nextMonth(monthStart(value)),-1)}
function overlapDays(start:string,end:string,periodStart:string,periodEnd:string){const from=start>periodStart?start:periodStart;const to=end<periodEnd?end:periodEnd;if(from>to)return 0;return Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)+1}
function weatherLabel(code:number,locale:Locale){
  const key=code===0?"clear":code<=3?"cloud":code<=57?"drizzle":code<=67?"rain":code<=77?"snow":code<=82?"showers":code<=86?"snow":code>=95?"storm":"cloud"
  const labels={en:{clear:"Clear sky",cloud:"Cloudy",drizzle:"Light drizzle",rain:"Rain",showers:"Showers",snow:"Snow",storm:"Thunderstorm"},es:{clear:"Despejado",cloud:"Nublado",drizzle:"Llovizna",rain:"Lluvia",showers:"Chubascos",snow:"Nieve",storm:"Tormenta"},de:{clear:"Klar",cloud:"Bewölkt",drizzle:"Nieselregen",rain:"Regen",showers:"Schauer",snow:"Schnee",storm:"Gewitter"}} as const
  return labels[locale][key]
}

export function OrchardConfigurableDashboard(){
  const supabase=useMemo(()=>createBrowserClient(),[])
  const searchParams=useSearchParams()
  const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=localeMap[lang]
  const [plans,setPlans]=useState<Plan[]>([]),[cycles,setCycles]=useState<Cycle[]>([]),[successions,setSuccessions]=useState<Succession[]>([]),[allocations,setAllocations]=useState<Allocation[]>([]),[tasks,setTasks]=useState<Task[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[employees,setEmployees]=useState<Employee[]>([]),[notes,setNotes]=useState<Note[]>([])
  const [userId,setUserId]=useState<string|null>(null),[view,setView]=useState<DashboardView>("operation"),[orders,setOrders]=useState<Record<DashboardView,WidgetKey[]>>({operation:[...DEFAULT_ORDER.operation],planning:[...DEFAULT_ORDER.planning]}),[hidden,setHidden]=useState<Record<DashboardView,WidgetKey[]>>({operation:[],planning:[]}),[notepad,setNotepad]=useState("")
  const [weather,setWeather]=useState<WeatherPayload|null>(null),[loading,setLoading]=useState(true),[editing,setEditing]=useState(false),[dragging,setDragging]=useState<WidgetKey|null>(null),[saveError,setSaveError]=useState<string|null>(null)

  useEffect(()=>{let live=true;setLoading(true);void Promise.all([
    supabase.auth.getUser(),
    supabase.from("orchard_game_plans").select("id,name,season,status,start_date,end_date").order("start_date",{ascending:false}),
    supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,cycle_type"),
    supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_last_harvest_date,planned_bed_m,knowledge_source_snapshot,status").neq("status","cancelled"),
    supabase.from("orchard_bed_allocations").select("crop_succession_id"),
    supabase.from("tasks").select("id,title,status,due_date,location_name,estimated_minutes,priority,source_type,source_id").in("operational_area",["orchard","huerto_vinedo"]),
    supabase.from("employees").select("id,name").eq("is_active",true),
    supabase.from("orchard_notes").select("id,title,body,note_type,observed_at").order("observed_at",{ascending:false}).limit(3),
  ]).then(async([auth,p,c,s,a,t,e,n])=>{
    if(!live)return
    const id=auth.data.user?.id??null;setUserId(id)
    setPlans((p.data??[]) as Plan[]);setCycles((c.data??[]) as Cycle[]);setSuccessions((s.data??[]) as Succession[]);setAllocations((a.data??[]) as Allocation[]);const nextTasks=(t.data??[]) as Task[];setTasks(nextTasks);setEmployees((e.data??[]) as Employee[]);setNotes((n.data??[]) as Note[])
    if(nextTasks.length){const ar=await supabase.from("task_assignments").select("task_id,employee_id").in("task_id",nextTasks.map(row=>row.id));if(live)setAssignments((ar.data??[]) as Assignment[])}
    if(id){const pref=await supabase.from("orchard_dashboard_preferences").select("active_view,operation_widget_order,planning_widget_order,operation_hidden_widgets,planning_hidden_widgets,notepad").eq("user_id",id).maybeSingle();if(live&&pref.data){const row=pref.data as Preference;setView(row.active_view==="planning"?"planning":"operation");setOrders({operation:validWidgets(row.operation_widget_order,DEFAULT_ORDER.operation),planning:validWidgets(row.planning_widget_order,DEFAULT_ORDER.planning)});setHidden({operation:validHidden(row.operation_hidden_widgets),planning:validHidden(row.planning_hidden_widgets)});setNotepad(row.notepad??"")}}
    if(live)setLoading(false)
  });return()=>{live=false}},[supabase])

  useEffect(()=>{let live=true;void fetch("/api/orchard/weather",{cache:"no-store"}).then(async response=>{const payload=await response.json() as WeatherPayload;if(live)setWeather(response.ok?payload:{source:"Open-Meteo",timezone:"America/Santiago",unit:"°C",daily:null,error:payload.error})}).catch(()=>{if(live)setWeather({source:"Open-Meteo",timezone:"America/Santiago",unit:"°C",daily:null,error:"unavailable"})});return()=>{live=false}},[])

  const requested=searchParams.get("game_plan")
  const plan=plans.find(row=>row.id===requested)??plans.find(row=>row.status==="active")??plans.find(row=>row.status==="draft")??plans[0]??null
  const cycleById=new Map(cycles.filter(row=>row.game_plan_id===plan?.id).map(row=>[row.id,row]));const allocatedIds=new Set(allocations.map(row=>row.crop_succession_id));const scoped=successions.filter(row=>cycleById.has(row.crop_cycle_id)&&allocatedIds.has(row.id));const scopedIds=new Set(scoped.map(row=>row.id))
  const relevantTasks=tasks.filter(task=>!task.source_id||!task.source_type?.startsWith("orchard_succession")||scopedIds.has(task.source_id));const nonCancelled=relevantTasks.filter(task=>task.status!=="cancelada");const openTasks=nonCancelled.filter(task=>task.status!=="completada")
  const today=chileDate(),in7=addDays(today,7),weekStart=mondayOf(today),weekEnd=addDays(weekStart,6)
  const seasonTasks=nonCancelled.filter(task=>!task.due_date||(!plan?.start_date||task.due_date>=plan.start_date)&&(!plan?.end_date||task.due_date<=plan.end_date));const weekTasks=nonCancelled.filter(task=>task.due_date&&task.due_date>=weekStart&&task.due_date<=weekEnd);const dueToday=openTasks.filter(task=>task.due_date===today);const openWeek=openTasks.filter(task=>task.due_date&&task.due_date>=today&&task.due_date<=in7)
  const employeeById=new Map(employees.map(row=>[row.id,row.name]));const ownerFor=(taskId:string)=>assignments.filter(row=>row.task_id===taskId&&row.employee_id).map(row=>employeeById.get(row.employee_id!)).filter(Boolean).join(", ")

  const cropsMap=new Map<string,CropSummary>();for(const row of scoped){const cycle=cycleById.get(row.crop_cycle_id);if(!cycle)continue;const current=cropsMap.get(cycle.crop_name)??{name:cycle.crop_name,bedM:0,successions:0};current.bedM+=Number(row.planned_bed_m??0);current.successions+=1;cropsMap.set(cycle.crop_name,current)}const crops=[...cropsMap.values()].sort((a,b)=>b.bedM-a.bedM);const maxBed=Math.max(...crops.map(row=>row.bedM),0)

  const harvestable=scoped.filter(row=>row.planned_first_harvest_date&&row.planned_last_harvest_date&&Number(row.planned_bed_m)>0);const first=harvestable.map(row=>row.planned_first_harvest_date!).sort()[0]??null;const last=harvestable.map(row=>row.planned_last_harvest_date!).sort().at(-1)??null;const months:{key:string;revenue:number;priced:number;eligible:number}[]=[];if(first&&last){let key=monthStart(first);while(key<=last&&months.length<18){months.push({key:key.slice(0,7),revenue:0,priced:0,eligible:0});key=nextMonth(key)}}for(const row of harvestable){const canonical=canonicalFor(row.knowledge_source_snapshot);const weeklyYield=asFinite(canonical.yield_per_week_10m_bed),price=asFinite(canonical.price_per_unit_clp);if(weeklyYield==null||!canonical.yield_unit)continue;const dailyYield=weeklyYield/7*(Number(row.planned_bed_m)/10);for(const month of months){const start=`${month.key}-01`,end=monthEnd(start),days=overlapDays(row.planned_first_harvest_date!,row.planned_last_harvest_date!,start,end);if(!days)continue;month.eligible+=1;if(price==null)continue;month.priced+=1;month.revenue+=dailyYield*days*price}}const maxRevenue=Math.max(...months.map(row=>row.revenue),0);const money=(value:number)=>new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(value)

  const events:EventRow[]=[];for(const row of scoped){const cycle=cycleById.get(row.crop_cycle_id);if(!cycle)continue;if(cycle.cycle_type==="direct_sow"&&row.planned_sow_date)events.push({date:row.planned_sow_date,label:text.sow,crop:cycle.crop_name,sequence:row.sequence_no});if(cycle.cycle_type==="transplant"&&row.planned_transplant_date)events.push({date:row.planned_transplant_date,label:text.transplant,crop:cycle.crop_name,sequence:row.sequence_no});if(row.planned_first_harvest_date)events.push({date:row.planned_first_harvest_date,label:text.harvest,crop:cycle.crop_name,sequence:row.sequence_no})}events.sort((a,b)=>a.date.localeCompare(b.date));const upcoming=events.filter(row=>row.date>=today&&row.date<=in7)

  const savePreferences=async(nextView=view,nextOrders=orders,nextHidden=hidden,nextNotepad=notepad)=>{if(!userId)return;setSaveError(null);const payload={user_id:userId,active_view:nextView,operation_widget_order:nextOrders.operation,planning_widget_order:nextOrders.planning,operation_hidden_widgets:nextHidden.operation,planning_hidden_widgets:nextHidden.planning,notepad:nextNotepad.slice(0,300)};const result=await supabase.from("orchard_dashboard_preferences").upsert(payload,{onConflict:"user_id"});if(result.error)setSaveError(text.saveError)}
  const changeView=(next:DashboardView)=>{setView(next);void savePreferences(next,orders,hidden,notepad)}
  const moveWidget=(from:WidgetKey,to:WidgetKey)=>{if(from===to)return;const next=[...orders[view]];const fromIndex=next.indexOf(from),toIndex=next.indexOf(to);if(fromIndex<0||toIndex<0)return;next.splice(fromIndex,1);next.splice(toIndex,0,from);const nextOrders={...orders,[view]:next};setOrders(nextOrders);void savePreferences(view,nextOrders,hidden,notepad)}
  const toggleWidget=(key:WidgetKey)=>{const current=hidden[view];const next=current.includes(key)?current.filter(item=>item!==key):[...current,key];const nextHidden={...hidden,[view]:next};setHidden(nextHidden);void savePreferences(view,orders,nextHidden,notepad)}
  const resetLayout=()=>{const nextOrders={...orders,[view]:[...DEFAULT_ORDER[view]]};const nextHidden={...hidden,[view]:[]};setOrders(nextOrders);setHidden(nextHidden);void savePreferences(view,nextOrders,nextHidden,notepad)}
  const planQuery=plan?`?game_plan=${encodeURIComponent(plan.id)}`:""

  if(loading)return <div className="px-6 py-14 text-sm text-muted-foreground">{text.loading}</div>

  const taskWidget=<WidgetShell title={view==="operation"?text.todayTasks:text.seasonTasks} icon={CalendarDays} wide={false}>
    <div className="grid grid-cols-2 gap-px bg-[var(--orchard-line)]"><Metric label={view==="operation"?text.todayTasks:text.seasonTasks} value={view==="operation"?dueToday.length:seasonTasks.length}/><Metric label={view==="operation"?text.openWeek:text.weekTasks} value={view==="operation"?openWeek.length:weekTasks.length}/></div>
    <div>{(view==="operation"?dueToday:weekTasks).slice(0,5).map(task=><div key={task.id} className="border-t border-[var(--orchard-line)] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{task.due_date?dateLabel(task.due_date,locale):"—"}{task.location_name?` · ${task.location_name}`:""}{ownerFor(task.id)?` · ${ownerFor(task.id)}`:""}</p></div><span className="text-xs tabular-nums text-muted-foreground">{task.estimated_minutes!=null?`${task.estimated_minutes} min`:"—"}</span></div></div>)}</div>
    <div className="border-t border-[var(--orchard-line)] p-3"><Link href={`/${language}/orchard/work/week-board${planQuery}`} className="inline-flex items-center gap-1.5 text-xs">{text.openTasks}<ArrowRight className="h-3.5 w-3.5"/></Link></div>
  </WidgetShell>

  const weatherWidget=<WidgetShell title={text.weather} icon={CloudSun} wide>
    {weather?.daily?<div className="grid min-w-[760px] grid-cols-7 gap-px bg-[var(--orchard-line)]">{weather.daily.time.map((day,index)=><div key={day} className="bg-[var(--bs-surface-primary)] p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{dateLabel(day,locale)}</p><div className="mt-3 flex items-center gap-2"><CloudRain className="h-4 w-4 text-[var(--orchard-green)]"/><strong className="text-xl font-medium">{Math.round(weather.daily!.temperature_2m_mean[index]??0)}{weather.unit}</strong></div><p className="mt-1 text-xs text-muted-foreground">{Math.round(weather.daily!.temperature_2m_min[index]??0)}{weather.unit} / {Math.round(weather.daily!.temperature_2m_max[index]??0)}{weather.unit}</p><p className="mt-3 text-xs">{weatherLabel(weather.daily!.weather_code[index]??0,lang)}</p><p className="mt-1 text-[10px] text-muted-foreground">PoP {Math.round(weather.daily!.precipitation_probability_max[index]??0)}% · {(weather.daily!.precipitation_sum[index]??0).toFixed(1)} mm</p></div>)}</div>:<p className="p-6 text-sm text-muted-foreground">{text.weatherError}</p>}
    <p className="border-t border-[var(--orchard-line)] px-4 py-2 text-[10px] text-muted-foreground">{text.weatherSource}: {weather?.source??"Open-Meteo"}</p>
  </WidgetShell>

  const revenueWidget=<WidgetShell title={text.revenue} icon={CircleDollarSign} wide><p className="px-4 pt-4 text-xs leading-5 text-muted-foreground">{text.revenueHelp}</p><div className="space-y-3 p-4">{months.filter(row=>row.revenue>0).map(month=><div key={month.key} className="grid grid-cols-[72px_1fr_110px] items-center gap-3"><span className="text-xs capitalize text-muted-foreground">{new Date(`${month.key}-01T12:00:00`).toLocaleDateString(locale,{month:"short"})}</span><div className="h-2 bg-[var(--orchard-line)]"><div className="h-full bg-[var(--orchard-green)]" style={{width:`${maxRevenue?Math.max(2,month.revenue/maxRevenue*100):0}%`}}/></div><div className="text-right"><p className="text-xs font-medium">{money(month.revenue)}</p><p className="text-[10px] text-muted-foreground">{month.priced}/{month.eligible}</p></div></div>)}</div><div className="border-t border-[var(--orchard-line)] p-3"><Link href={`/${language}/orchard/harvest/season${planQuery}`} className="inline-flex items-center gap-1.5 text-xs">{text.openHarvest}<ArrowRight className="h-3.5 w-3.5"/></Link></div></WidgetShell>

  const notepadWidget=<WidgetShell title={text.notepad} icon={Pencil} wide={false}><div className="p-4"><textarea value={notepad} maxLength={300} onChange={event=>setNotepad(event.target.value)} onBlur={()=>void savePreferences(view,orders,hidden,notepad)} placeholder={text.notepadPlaceholder} className="min-h-36 w-full resize-none bg-transparent p-0 text-sm outline-none"/><div className="mt-2 text-right text-[10px] tabular-nums text-muted-foreground">{notepad.length} / 300</div></div></WidgetShell>

  const notesWidget=<WidgetShell title={text.notes} icon={FileText} wide={false}>{notes.length?<div>{notes.map(note=><Link key={note.id} href={`/${language}/orchard/notes${planQuery}`} className="block border-t border-[var(--orchard-line)] p-4 first:border-t-0 hover:bg-[var(--bs-surface-secondary)]"><p className="truncate text-sm font-medium">{note.title?.trim()||note.note_type}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{note.body}</p></Link>)}</div>:<p className="p-6 text-sm text-muted-foreground">{text.noNotes}</p>}<div className="border-t border-[var(--orchard-line)] p-3"><Link href={`/${language}/orchard/notes${planQuery}`} className="inline-flex items-center gap-1.5 text-xs">{text.openNotes}<ArrowRight className="h-3.5 w-3.5"/></Link></div></WidgetShell>

  const cropsWidget=<WidgetShell title={text.crops} icon={Sprout} wide><div className="overflow-x-auto"><div className="flex min-w-max gap-px bg-[var(--orchard-line)]">{crops.slice(0,17).map(crop=><div key={crop.name} className="w-40 bg-[var(--bs-surface-primary)] p-4"><div className="h-1.5 w-10" style={{backgroundColor:cropColor(crop.name,null)}}/><p className="mt-3 truncate text-sm font-medium">{crop.name}</p><p className="mt-1 text-xs text-muted-foreground">{crop.successions} {text.plantings}</p><p className="mt-4 text-lg font-medium">{crop.bedM.toLocaleString(locale,{maximumFractionDigits:1})} {text.bed}</p><div className="mt-2 h-1 bg-[var(--orchard-line)]"><div className="h-full" style={{width:`${maxBed?Math.max(3,crop.bedM/maxBed*100):0}%`,backgroundColor:cropColor(crop.name,null)}}/></div></div>)}</div></div></WidgetShell>

  const milestoneWidget=<WidgetShell title={text.milestones} icon={Leaf} wide={false}>{upcoming.length?<div>{upcoming.slice(0,7).map((event,index)=><div key={`${event.date}-${event.crop}-${event.sequence}-${index}`} className="grid grid-cols-[78px_1fr] gap-3 border-t border-[var(--orchard-line)] p-4 first:border-t-0"><span className="text-xs text-muted-foreground">{dateLabel(event.date,locale)}</span><div><p className="text-sm font-medium">{event.crop} #{event.sequence}</p><p className="mt-1 text-xs text-muted-foreground">{event.label}</p></div></div>)}</div>:<p className="p-6 text-sm text-muted-foreground">{text.noMilestones}</p>}</WidgetShell>

  const content:Record<WidgetKey,React.ReactNode>={tasks:taskWidget,weather:weatherWidget,revenue:revenueWidget,notepad:notepadWidget,notes:notesWidget,crops:cropsWidget,milestones:milestoneWidget}
  const isWide=(key:WidgetKey)=>key==="weather"||key==="revenue"||key==="crops"

  return <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-7 sm:px-6 lg:px-8" data-orchard-dashboard>
    <header className="mb-6 flex flex-col gap-5 border-b border-[var(--orchard-line)] pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-2 text-4xl font-normal">{text.title}</h1><p className="mt-2 text-sm text-muted-foreground">{plan?.name??"Black Swan Orchard"} · {plan?.season??"—"}</p></div><div className="flex flex-wrap items-center gap-2"><select value={view} onChange={event=>changeView(event.target.value as DashboardView)} className="min-w-52 px-3 text-sm"><option value="operation">{text.operation}</option><option value="planning">{text.planning}</option></select><button type="button" onClick={()=>setEditing(value=>!value)} className="inline-flex items-center gap-2 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] px-3 text-sm"><Pencil className="h-4 w-4"/>{editing?text.done:text.edit}</button></div></header>
    {saveError?<div className="mb-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{saveError}</div>:null}
    {editing?<section className="mb-6 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-medium">{text.edit}</p><p className="mt-1 text-xs text-muted-foreground">{text.editHelp}</p></div><button type="button" onClick={resetLayout} className="inline-flex items-center gap-2 text-xs text-muted-foreground"><RotateCcw className="h-3.5 w-3.5"/>{text.reset}</button></div><div className="mt-4 flex flex-wrap gap-2">{ALL_WIDGETS.map(key=>{const off=hidden[view].includes(key);return <button key={key} type="button" onClick={()=>toggleWidget(key)} className="inline-flex items-center gap-2 border border-[var(--orchard-line)] bg-[var(--bs-bg-secondary)] px-3 text-xs">{off?<EyeOff className="h-3.5 w-3.5"/>:<Eye className="h-3.5 w-3.5"/>}{widgetNames[key][lang]}<span className="text-muted-foreground">· {off?text.hidden:text.visible}</span></button>})}</div></section>:null}
    <section className="grid gap-5 xl:grid-cols-2">{orders[view].filter(key=>!hidden[view].includes(key)).map(key=><div key={key} draggable={editing} onDragStart={()=>setDragging(key)} onDragEnd={()=>setDragging(null)} onDragOver={event=>{if(editing)event.preventDefault()}} onDrop={event=>{event.preventDefault();if(editing&&dragging)moveWidget(dragging,key)}} className={cn(isWide(key)&&"xl:col-span-2",editing&&"cursor-grab",dragging===key&&"opacity-60")}><div className="relative">{editing?<div className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-[var(--bs-bg-secondary)] text-muted-foreground"><GripVertical className="h-4 w-4"/></div>:null}{content[key]}</div></div>)}</section>
  </main>
}

function WidgetShell({title,icon:Icon,wide,children}:{title:string;icon:typeof Sprout;wide:boolean;children:React.ReactNode}){return <article className={cn("overflow-hidden border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)]",wide&&"min-w-0")}><header className="flex items-center gap-2 border-b border-[var(--orchard-line)] px-4 py-3"><Icon className="h-4 w-4 text-[var(--orchard-green)]"/><h2 className="text-lg font-medium">{title}</h2></header>{children}</article>}
function Metric({label,value}:{label:string;value:number}){return <div className="bg-[var(--bs-surface-primary)] p-4"><strong className="text-3xl font-normal tabular-nums">{value}</strong><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale="en"|"es"|"de"
type Status="nueva"|"en_progreso"|"completada"|"cancelada"
type Task={id:string;title:string;priority:string;status:Status;due_date:string|null;location_name:string|null;task_category:string|null;estimated_minutes:number|null;source_label:string|null}
type Assignment={task_id:string;employee_id:string|null}
type Employee={id:string;name:string}

const DAY_W=52
const LEFT_W=300
const copy={
 en:{eyebrow:"Orchard · Task Calendar",title:"Tasks",description:"Continuous operating calendar. Add work in seconds; the morning task dispatch keeps reading the same canonical task records.",today:"Today",earlier:"Earlier",later:"Later",quick:"Quick add",task:"Task",date:"Date",owner:"Owner",unassigned:"Unassigned",minutes:"min",add:"Add task",saving:"Saving…",search:"Search tasks…",open:"Open",done:"Done",empty:"No dated tasks match the current search.",loadError:"Could not load Orchard tasks.",saveError:"Could not create task.",source:"Quick task",allOwners:"All owners"},
 es:{eyebrow:"Huerto · Calendario de tareas",title:"Tareas",description:"Calendario operativo continuo. Agrega trabajo en segundos; el envío matinal sigue leyendo los mismos registros canónicos de tareas.",today:"Hoy",earlier:"Anterior",later:"Siguiente",quick:"Agregar rápido",task:"Tarea",date:"Fecha",owner:"Responsable",unassigned:"Sin asignar",minutes:"min",add:"Agregar tarea",saving:"Guardando…",search:"Buscar tareas…",open:"Abierta",done:"Lista",empty:"No hay tareas con fecha para la búsqueda actual.",loadError:"No fue posible cargar las tareas Orchard.",saveError:"No fue posible crear la tarea.",source:"Tarea rápida",allOwners:"Todos"},
 de:{eyebrow:"Orchard · Aufgabenkalender",title:"Aufgaben",description:"Durchgehender Betriebskalender. Arbeit in Sekunden hinzufügen; der morgendliche Versand liest weiterhin dieselben kanonischen Aufgaben.",today:"Heute",earlier:"Früher",later:"Später",quick:"Schnell hinzufügen",task:"Aufgabe",date:"Datum",owner:"Verantwortlich",unassigned:"Nicht zugewiesen",minutes:"Min",add:"Aufgabe hinzufügen",saving:"Speichern…",search:"Aufgaben suchen…",open:"Offen",done:"Erledigt",empty:"Keine terminierten Aufgaben für die aktuelle Suche.",loadError:"Orchard-Aufgaben konnten nicht geladen werden.",saveError:"Aufgabe konnte nicht erstellt werden.",source:"Schnellaufgabe",allOwners:"Alle"}
} as const
const locales:Record<Locale,string>={en:"en-US",es:"es-CL",de:"de-DE"}
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
const parseDate=(value:string)=>new Date(`${value}T12:00:00`)
const addDays=(date:Date,days:number)=>{const d=new Date(date);d.setDate(d.getDate()+days);return d}
const startOfToday=()=>{const d=new Date();d.setHours(12,0,0,0);return d}

export function OrchardTaskCalendar(){
 const supabase=useMemo(()=>createBrowserClient(),[])
 const {language}=useLanguage();const lang:Locale=language;const text=copy[lang];const locale=locales[lang]
 const viewportRef=useRef<HTMLDivElement|null>(null)
 const [tasks,setTasks]=useState<Task[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[employees,setEmployees]=useState<Employee[]>([])
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null)
 const [pastDays,setPastDays]=useState(60),[futureDays,setFutureDays]=useState(180),[search,setSearch]=useState(""),[ownerFilter,setOwnerFilter]=useState("all")
 const [title,setTitle]=useState(""),[dueDate,setDueDate]=useState(()=>dateKey(startOfToday())),[ownerId,setOwnerId]=useState("none"),[minutes,setMinutes]=useState("60")

 const load=useCallback(async()=>{setLoading(true);setError(null);const [t,e]=await Promise.all([
  supabase.from("tasks").select("id,title,priority,status,due_date,location_name,task_category,estimated_minutes,source_label").in("operational_area",["orchard","huerto_vinedo"]).order("due_date",{ascending:true,nullsFirst:false}),
  supabase.from("employees").select("id,name").eq("is_active",true).order("name")
 ]);if(t.error||e.error){setError(`${text.loadError} ${(t.error??e.error)?.message??""}`);setLoading(false);return}const next=(t.data??[]) as Task[];let a:Assignment[]=[];if(next.length){const ar=await supabase.from("task_assignments").select("task_id,employee_id").in("task_id",next.map(item=>item.id));if(ar.error){setError(`${text.loadError} ${ar.error.message}`);setLoading(false);return}a=(ar.data??[]) as Assignment[]}setTasks(next);setAssignments(a);setEmployees((e.data??[]) as Employee[]);setLoading(false)},[supabase,text.loadError])
 useEffect(()=>{void load()},[load])

 const employeeById=useMemo(()=>new Map(employees.map(e=>[e.id,e.name])),[employees])
 const ownerIds=(taskId:string)=>assignments.filter(a=>a.task_id===taskId&&a.employee_id).map(a=>a.employee_id!)
 const ownerLabel=(taskId:string)=>ownerIds(taskId).map(id=>employeeById.get(id)).filter(Boolean).join(", ")||text.unassigned
 const today=startOfToday(),todayKey=dateKey(today),rangeStart=addDays(today,-pastDays),rangeEnd=addDays(today,futureDays)
 const days=useMemo(()=>Array.from({length:pastDays+futureDays+1},(_,i)=>addDays(rangeStart,i)),[pastDays,futureDays,todayKey])
 const dated=tasks.filter(t=>t.due_date&&t.due_date>=dateKey(rangeStart)&&t.due_date<=dateKey(rangeEnd)).filter(t=>{if(search.trim()){const hay=`${t.title} ${t.location_name??""} ${t.task_category??""} ${ownerLabel(t.id)}`.toLowerCase();if(!hay.includes(search.trim().toLowerCase()))return false}if(ownerFilter!=="all"&&!ownerIds(t.id).includes(ownerFilter))return false;return true})
 const monthGroups=useMemo(()=>{const groups:{label:string;start:number;span:number}[]=[];days.forEach((d,i)=>{const label=d.toLocaleDateString(locale,{month:"short",year:"numeric"});const prev=groups.at(-1);if(prev?.label===label)prev.span++;else groups.push({label,start:i,span:1})});return groups},[days,locale])

 const scrollToday=useCallback(()=>{const el=viewportRef.current;if(!el)return;el.scrollLeft=Math.max(0,pastDays*DAY_W-el.clientWidth/2+DAY_W/2)},[pastDays])
 useEffect(()=>{if(!loading)requestAnimationFrame(scrollToday)},[loading,scrollToday])

 async function createTask(){if(!title.trim()||!dueDate||saving)return;setSaving(true);setError(null);const mins=Math.max(5,Math.min(1440,Number(minutes)||60));const inserted=await supabase.from("tasks").insert({title:title.trim(),priority:"media",status:"nueva",due_date:dueDate,operational_area:"orchard",task_category:"General field work",estimated_minutes:mins,source_type:"orchard_general",source_label:text.source,source_path:"/orchard/work/week-board"}).select("id").single();if(inserted.error){setError(`${text.saveError} ${inserted.error.message}`);setSaving(false);return}if(ownerId!=="none"){const assigned=await supabase.from("task_assignments").insert({task_id:inserted.data.id,employee_id:ownerId});if(assigned.error){setError(`${text.saveError} ${assigned.error.message}`);setSaving(false);await load();return}}setTitle("");setSaving(false);await load()}
 async function toggle(task:Task){const complete=task.status!=="completada";const r=await supabase.from("tasks").update({status:complete?"completada":"nueva",completed_at:complete?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",task.id);if(r.error)setError(r.error.message);else await load()}
 const dayIndex=(value:string)=>Math.round((parseDate(value).getTime()-rangeStart.getTime())/86400000)

 return <AppLayout><OrchardNavigation/><main className="flex min-h-[720px] flex-col bg-[var(--bs-canvas)] text-foreground lg:h-[calc(100dvh-var(--orchard-nav-height,0px))] lg:overflow-hidden">
  <header className="shrink-0 border-b border-[var(--orchard-line)] px-4 py-4 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">{text.eyebrow}</p><h1 className="mt-1 text-2xl font-normal">{text.title}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{text.description}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setPastDays(v=>v+90)}><ChevronLeft className="mr-1 h-4 w-4"/>{text.earlier}</Button><Button variant="outline" size="sm" onClick={scrollToday}>{text.today}</Button><Button variant="outline" size="sm" onClick={()=>setFutureDays(v=>v+90)}>{text.later}<ChevronRight className="ml-1 h-4 w-4"/></Button></div></div></header>
  <section className="shrink-0 border-b border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] px-4 py-3 sm:px-6"><p className="mb-2 text-[10px] uppercase tracking-[.14em] text-muted-foreground">{text.quick}</p><div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_150px_210px_100px_auto]"><Input autoFocus aria-label={text.task} placeholder={text.task} value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void createTask()}}/><Input aria-label={text.date} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/><Select value={ownerId} onValueChange={setOwnerId}><SelectTrigger aria-label={text.owner}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{text.unassigned}</SelectItem>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select><Input aria-label={text.minutes} type="number" min={5} max={1440} step={5} value={minutes} onChange={e=>setMinutes(e.target.value)}/><Button onClick={()=>void createTask()} disabled={!title.trim()||saving}><Plus className="mr-1 h-4 w-4"/>{saving?text.saving:text.add}</Button></div></section>
  <section className="shrink-0 border-b border-[var(--orchard-line)] px-4 py-2 sm:px-6"><div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_220px_auto]"><Input aria-label={text.search} placeholder={text.search} value={search} onChange={e=>setSearch(e.target.value)}/><Select value={ownerFilter} onValueChange={setOwnerFilter}><SelectTrigger aria-label={text.owner}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{text.allOwners}</SelectItem>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select><div className="flex items-center text-xs text-muted-foreground">{dated.length} / {tasks.filter(t=>t.due_date).length}</div></div>{error?<p className="mt-2 text-xs text-red-300">{error}</p>:null}</section>
  <div className="min-h-0 flex-1 overflow-hidden"><div ref={viewportRef} className="h-full overflow-auto">
   <div className="min-w-max" style={{width:LEFT_W+days.length*DAY_W}}>
    <div className="sticky top-0 z-30 flex h-11 border-b border-[var(--orchard-line)] bg-[var(--bs-canvas)]"><div className="sticky left-0 z-40 flex shrink-0 items-end border-r border-[var(--orchard-line)] bg-[var(--bs-canvas)] px-3 pb-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground" style={{width:LEFT_W}}>{text.task}</div><div className="relative h-full" style={{width:days.length*DAY_W}}>{monthGroups.map(g=><div key={`${g.label}-${g.start}`} className="absolute top-0 flex h-5 items-center border-r border-[var(--orchard-line)] px-2 text-[9px] uppercase tracking-[.1em] text-muted-foreground" style={{left:g.start*DAY_W,width:g.span*DAY_W}}>{g.label}</div>)}<div className="absolute inset-x-0 bottom-0 flex h-6">{days.map(d=>{const key=dateKey(d),todayCell=key===todayKey;return <button key={key} type="button" onClick={()=>setDueDate(key)} className={`shrink-0 border-r border-[var(--orchard-line)] text-center text-[9px] ${todayCell?"bg-[var(--orchard-green)]/15 text-[var(--orchard-green)]":"text-muted-foreground hover:bg-white/[.04]"}`} style={{width:DAY_W}} title={d.toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long"})}>{d.toLocaleDateString(locale,{weekday:"narrow"})} {d.getDate()}</button>})}</div></div></div>
    {loading?<div className="p-8 text-sm text-muted-foreground">…</div>:dated.length?dated.map(task=>{const idx=dayIndex(task.due_date!);const done=task.status==="completada";return <div key={task.id} className="flex min-h-14 border-b border-[var(--orchard-line)]"><div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-[var(--orchard-line)] bg-[var(--bs-canvas)] px-3" style={{width:LEFT_W}}><button onClick={()=>void toggle(task)} className="shrink-0 text-[var(--orchard-green)]" aria-label={done?text.done:text.open}>{done?<CheckCircle2 className="h-4 w-4"/>:<Circle className="h-4 w-4"/>}</button><div className="min-w-0"><p className={`truncate text-xs font-medium ${done?"line-through opacity-60":""}`}>{task.title}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{ownerLabel(task.id)}{task.estimated_minutes?` · ${task.estimated_minutes} ${text.minutes}`:""}</p></div></div><div className="relative" style={{width:days.length*DAY_W}}><div className="absolute inset-0 flex">{days.map(d=><button key={dateKey(d)} type="button" onClick={()=>setDueDate(dateKey(d))} className={`h-full shrink-0 border-r border-[var(--orchard-line)] hover:bg-white/[.025] ${dateKey(d)===todayKey?"bg-[var(--orchard-green)]/[.035]":""}`} style={{width:DAY_W}} aria-label={dateKey(d)}/>)}</div>{idx>=0&&idx<days.length?<div className={`absolute top-2 z-10 flex h-10 items-center overflow-hidden border px-2 text-[10px] ${done?"border-white/10 bg-white/[.03] text-muted-foreground":"border-[var(--orchard-green)]/40 bg-[var(--orchard-green)]/12 text-foreground"}`} style={{left:idx*DAY_W+3,width:Math.max(DAY_W-6,Math.min(220,Math.max(80,task.title.length*6)))}} title={`${task.due_date} · ${task.title}`}><span className="truncate">{task.title}</span></div>:null}</div></div>}):<p className="p-8 text-sm text-muted-foreground">{text.empty}</p>}
   </div>
  </div></div>
 </main></AppLayout>
}

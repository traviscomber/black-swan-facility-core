"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, List, Plus, RefreshCw, Users, X } from "lucide-react"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { cn } from "@/lib/utils"

type Mode = "list" | "week-board" | "workload-graph"
type Locale = "en" | "es" | "de"
type TaskStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
type Task = {
  id: string
  title: string
  description: string | null
  priority: string
  status: TaskStatus
  due_date: string | null
  location_name: string | null
  task_category: string | null
  estimated_minutes: number | null
  source_label: string | null
}
type Assignment = { task_id: string; employee_id: string | null }
type Employee = { id: string; name: string; role: string | null }
type OrchardLocation = { id: string; name: string }
type PlotLocation = { location_id: string | null }
type AddForm = { title: string; minutes: string; employeeId: string; locationId: string; date: string; notes: string }

const copy = {
  en: {
    title: "Tasks",
    description: "A simple operating surface for daily work. The advanced accountable-work cockpit remains available behind this view.",
    list: "List", week: "Week Board", graph: "My Workload Graph", advanced: "Advanced work", add: "Add task", refresh: "Refresh",
    search: "Search tasks…", date: "Date", task: "Task Name", type: "Type", amount: "Estimated time", location: "Location", owner: "Owner", empty: "No Orchard tasks match this view.",
    today: "Today", prev: "Previous week", next: "Next week", minutes: "minutes", noDate: "No date", unassigned: "Not assigned", completed: "Completed", open: "Open",
    average: "Average per week", peak: "Peak week", total: "Open workload", weekLabel: "Week", noWorkload: "No dated open workload is available.",
    createTitle: "Create ad hoc Task", taskField: "Task", estimated: "Estimated time", assign: "Assign to", locationField: "Orchard location", selectLocation: "Select location", notes: "Notes", recurrence: "Recurrence", noRepeat: "Does not repeat", cancel: "Cancel", create: "Create", saveError: "Could not create task", loadError: "Could not load workload", recurrenceGap: "Recurring tasks are not yet a canonical Core field; this parity view creates one-off tasks only.", ownerRequired: "Select a responsible person.", locationRequired: "Select an Orchard location.",
  },
  es: {
    title: "Tareas",
    description: "Una superficie simple para el trabajo diario. El cockpit avanzado de trabajo responsable sigue disponible detrás de esta vista.",
    list: "Lista", week: "Week Board", graph: "Mi gráfico de carga", advanced: "Trabajo avanzado", add: "Agregar tarea", refresh: "Actualizar",
    search: "Buscar tareas…", date: "Fecha", task: "Nombre de tarea", type: "Tipo", amount: "Tiempo estimado", location: "Ubicación", owner: "Responsable", empty: "No hay tareas de Orchard para esta vista.",
    today: "Hoy", prev: "Semana anterior", next: "Semana siguiente", minutes: "minutos", noDate: "Sin fecha", unassigned: "Sin asignar", completed: "Completada", open: "Abierta",
    average: "Promedio por semana", peak: "Semana peak", total: "Carga abierta", weekLabel: "Semana", noWorkload: "No hay carga abierta con fecha disponible.",
    createTitle: "Crear tarea ad hoc", taskField: "Tarea", estimated: "Tiempo estimado", assign: "Asignar a", locationField: "Ubicación Orchard", selectLocation: "Seleccionar ubicación", notes: "Notas", recurrence: "Recurrencia", noRepeat: "No se repite", cancel: "Cancelar", create: "Crear", saveError: "No fue posible crear la tarea", loadError: "No fue posible cargar la carga de trabajo", recurrenceGap: "Las tareas recurrentes aún no son un campo canónico de Core; esta vista crea sólo tareas únicas.", ownerRequired: "Selecciona una persona responsable.", locationRequired: "Selecciona una ubicación de Orchard.",
  },
  de: {
    title: "Aufgaben",
    description: "Eine einfache Betriebsansicht für die tägliche Arbeit. Das erweiterte verantwortliche Arbeits-Cockpit bleibt dahinter verfügbar.",
    list: "Liste", week: "Wochenboard", graph: "Meine Arbeitslast", advanced: "Erweiterte Arbeit", add: "Aufgabe hinzufügen", refresh: "Aktualisieren",
    search: "Aufgaben suchen…", date: "Datum", task: "Aufgabe", type: "Typ", amount: "Geschätzte Zeit", location: "Ort", owner: "Verantwortlich", empty: "Keine Orchard-Aufgaben für diese Ansicht.",
    today: "Heute", prev: "Vorherige Woche", next: "Nächste Woche", minutes: "Minuten", noDate: "Kein Datum", unassigned: "Nicht zugewiesen", completed: "Abgeschlossen", open: "Offen",
    average: "Durchschnitt pro Woche", peak: "Spitzenwoche", total: "Offene Arbeitslast", weekLabel: "Woche", noWorkload: "Keine datierte offene Arbeitslast verfügbar.",
    createTitle: "Ad-hoc-Aufgabe erstellen", taskField: "Aufgabe", estimated: "Geschätzte Zeit", assign: "Zuweisen an", locationField: "Orchard-Ort", selectLocation: "Ort auswählen", notes: "Notizen", recurrence: "Wiederholung", noRepeat: "Keine Wiederholung", cancel: "Abbrechen", create: "Erstellen", saveError: "Aufgabe konnte nicht erstellt werden", loadError: "Arbeitslast konnte nicht geladen werden", recurrenceGap: "Wiederkehrende Aufgaben sind noch kein kanonisches Core-Feld; diese Ansicht erstellt nur einmalige Aufgaben.", ownerRequired: "Wähle eine verantwortliche Person.", locationRequired: "Wähle einen Orchard-Ort.",
  },
} as const

const locales: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}` }
function parseDate(value: string) { return new Date(`${value}T12:00:00`) }
function mondayOf(date: Date) { const d = new Date(date); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(12,0,0,0); return d }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate()+days); return d }
function formatDate(value: string | null, locale: string) { return value ? parseDate(value).toLocaleDateString(locale, { day:"2-digit", month:"2-digit", year:"numeric" }) : "—" }
function weekKey(value: string) { return dateKey(mondayOf(parseDate(value))) }

const modePath: Record<Mode,string> = { list:"/orchard/work/list", "week-board":"/orchard/work/week-board", "workload-graph":"/orchard/work/workload-graph" }

export function OrchardWorkloadParity({ mode }: { mode: Mode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const locale: Locale = language
  const text = copy[locale]
  const dateLocale = locales[locale]
  const [tasks,setTasks] = useState<Task[]>([])
  const [assignments,setAssignments] = useState<Assignment[]>([])
  const [employees,setEmployees] = useState<Employee[]>([])
  const [locations,setLocations] = useState<OrchardLocation[]>([])
  const [search,setSearch] = useState("")
  const [weekStart,setWeekStart] = useState(() => mondayOf(new Date()))
  const [dialogOpen,setDialogOpen] = useState(false)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState<string|null>(null)
  const [form,setForm] = useState<AddForm>({ title:"", minutes:"30", employeeId:"none", locationId:"none", date:dateKey(new Date()), notes:"" })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [taskResult, employeeResult, plotResult] = await Promise.all([
      supabase.from("tasks").select("id,title,description,priority,status,due_date,location_name,task_category,estimated_minutes,source_label").in("operational_area",["orchard","huerto_vinedo"]).order("due_date",{ascending:true,nullsFirst:false}),
      supabase.from("employees").select("id,name,role").eq("is_active",true).order("name"),
      supabase.from("orchard_plots").select("location_id").not("location_id","is",null),
    ])
    if (taskResult.error || employeeResult.error || plotResult.error) {
      setError(`${text.loadError}: ${(taskResult.error ?? employeeResult.error ?? plotResult.error)?.message ?? "unknown"}`); setLoading(false); return
    }
    const plotLocationIds=[...new Set(((plotResult.data??[]) as PlotLocation[]).map(row=>row.location_id).filter((id):id is string=>Boolean(id)))]
    let nextLocations:OrchardLocation[]=[]
    if(plotLocationIds.length){const l=await supabase.from("locations").select("id,name").in("id",plotLocationIds).eq("is_active",true).order("name");if(l.error){setError(`${text.loadError}: ${l.error.message}`);setLoading(false);return}else nextLocations=(l.data??[]) as OrchardLocation[]}
    const nextTasks=(taskResult.data??[]) as Task[]
    let nextAssignments:Assignment[]=[]
    if(nextTasks.length){const a=await supabase.from("task_assignments").select("task_id,employee_id").in("task_id",nextTasks.map(t=>t.id));if(a.error)setError(`${text.loadError}: ${a.error.message}`);else nextAssignments=(a.data??[]) as Assignment[]}
    setTasks(nextTasks);setAssignments(nextAssignments);setEmployees((employeeResult.data??[]) as Employee[]);setLocations(nextLocations);setLoading(false)
  },[supabase,text.loadError])
  useEffect(()=>{void load()},[load])

  const employeeById=useMemo(()=>new Map(employees.map(e=>[e.id,e])),[employees])
  const ownerFor=(taskId:string)=>assignments.filter(a=>a.task_id===taskId&&a.employee_id).map(a=>employeeById.get(a.employee_id!)?.name).filter(Boolean).join(", ")||text.unassigned
  const filtered=tasks.filter(task=>!search.trim()||[task.title,task.task_category,task.source_label,task.location_name].some(value=>value?.toLowerCase().includes(search.toLowerCase())))
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i))
  const weekEnd=weekDays[6]
  const weekTasks=filtered.filter(t=>t.due_date&&t.due_date>=dateKey(weekStart)&&t.due_date<=dateKey(weekEnd))
  const openTasks=filtered.filter(t=>t.status!=="completada"&&t.status!=="cancelada")
  const workloadWeeks=useMemo(()=>{const map=new Map<string,{minutes:number;tasks:number}>();for(const t of openTasks){if(!t.due_date)continue;const key=weekKey(t.due_date);const current=map.get(key)??{minutes:0,tasks:0};current.minutes+=Number(t.estimated_minutes??0);current.tasks+=1;map.set(key,current)}return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(0,16)},[openTasks])
  const peakMinutes=Math.max(0,...workloadWeeks.map(([,v])=>v.minutes))
  const averageMinutes=workloadWeeks.length?Math.round(workloadWeeks.reduce((sum,[,v])=>sum+v.minutes,0)/workloadWeeks.length):0
  const totalMinutes=workloadWeeks.reduce((sum,[,v])=>sum+v.minutes,0)
  const peakWeek=workloadWeeks.find(([,v])=>v.minutes===peakMinutes)?.[0]??null

  async function toggleComplete(task:Task){
    const complete=task.status!=="completada"
    const result=await supabase.from("tasks").update({status:complete?"completada":"nueva",completed_at:complete?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",task.id)
    if(result.error)setError(result.error.message);else await load()
  }

  async function createTask(){
    const title=form.title.trim();if(!title||!form.date)return
    if(form.employeeId==="none"){setError(`${text.saveError}: ${text.ownerRequired}`);return}
    if(form.locationId==="none"){setError(`${text.saveError}: ${text.locationRequired}`);return}
    const location=locations.find(item=>item.id===form.locationId)
    if(!location){setError(`${text.saveError}: ${text.locationRequired}`);return}
    setSaving(true);setError(null)
    const created=await supabase.rpc("create_operational_task_atomic",{
      p_title:title,
      p_description:form.notes.trim()||null,
      p_priority:"media",
      p_due_date:form.date,
      p_location_id:location.id,
      p_location_name:location.name,
      p_latitude:null,
      p_longitude:null,
      p_operational_area:"orchard",
      p_task_category:"ad_hoc",
      p_estimated_minutes:form.minutes?Number(form.minutes):null,
      p_animal_handling:false,
      p_safety_notes:null,
      p_employee_ids:[form.employeeId],
      p_volunteer_ids:[],
      p_source_type:null,
      p_source_id:null,
      p_source_label:"Orchard",
      p_source_path:`/${language}${modePath[mode]}`,
    })
    if(created.error){setError(`${text.saveError}: ${created.error.message}`);setSaving(false);return}
    setForm({title:"",minutes:"30",employeeId:"none",locationId:"none",date:dateKey(new Date()),notes:""});setDialogOpen(false);await load();setSaving(false)
  }

  const href=(target:Mode)=>`/${language}${modePath[target]}`
  return <AppLayout><OrchardNavigation/><main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-5 border-b border-[var(--orchard-line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--orchard-green)]">Orchard · Workload</p><h1 className="mt-2 text-3xl font-normal">{text.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{text.description}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>{text.refresh}</Button><Button onClick={()=>setDialogOpen(true)}><Plus className="mr-2 h-4 w-4"/>{text.add}</Button></div>
    </header>

    <nav className="mt-5 flex flex-wrap gap-1 border-b border-[var(--orchard-line)]" aria-label="Workload views">
      <Tab href={href("list")} active={mode==="list"} icon={List} label={text.list}/><Tab href={href("week-board")} active={mode==="week-board"} icon={CalendarDays} label={text.week}/><Tab href={href("workload-graph")} active={mode==="workload-graph"} icon={BarChart3} label={text.graph}/><Link href={`/${language}/orchard/work`} className="ml-auto inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground hover:text-[var(--orchard-green)]">{text.advanced}</Link>
    </nav>

    {error&&<div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {loading?<div className="py-16 text-sm text-muted-foreground">…</div>:<>
      {mode==="list"&&<section className="mt-6"><div className="mb-4 max-w-sm"><Input aria-label={text.search} placeholder={text.search} value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[900px] text-sm"><thead><tr><th className="w-14 p-3"></th><th className="p-3 text-left">{text.date}</th><th className="p-3 text-left">{text.task}</th><th className="p-3 text-left">{text.type}</th><th className="p-3 text-left">{text.amount}</th><th className="p-3 text-left">{text.location}</th><th className="p-3 text-left">{text.owner}</th></tr></thead><tbody>{filtered.length===0?<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{text.empty}</td></tr>:filtered.map(task=><tr key={task.id} className="border-t border-[#edf0ed]"><td className="p-3"><button aria-label={task.status==="completada"?text.completed:text.open} onClick={()=>void toggleComplete(task)} className={cn("grid h-8 w-8 place-items-center rounded-full border",task.status==="completada"?"border-[#1f624d] bg-[#1f624d] text-white":"border-[#bcc5bd] text-transparent hover:text-[#1f624d]")}><Check className="h-4 w-4"/></button></td><td className="p-3 tabular-nums">{formatDate(task.due_date,dateLocale)}</td><td className="p-3"><p className="font-medium">{task.title}</p>{task.source_label&&<p className="mt-1 text-xs text-muted-foreground">{task.source_label}</p>}</td><td className="p-3 text-muted-foreground">{task.task_category??"—"}</td><td className="p-3 tabular-nums">{task.estimated_minutes?`${task.estimated_minutes} min`:"—"}</td><td className="p-3 text-muted-foreground">{task.location_name??"—"}</td><td className="p-3 text-muted-foreground">{ownerFor(task.id)}</td></tr>)}</tbody></table></div></section>}

      {mode==="week-board"&&<section className="mt-6"><div className="mb-5 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={()=>setWeekStart(mondayOf(new Date()))}>{text.today}</Button><Button variant="ghost" size="icon" aria-label={text.prev} onClick={()=>setWeekStart(addDays(weekStart,-7))}><ChevronLeft className="h-4 w-4"/></Button><Button variant="ghost" size="icon" aria-label={text.next} onClick={()=>setWeekStart(addDays(weekStart,7))}><ChevronRight className="h-4 w-4"/></Button><p className="ml-1 text-sm font-medium">{formatDate(dateKey(weekStart),dateLocale)} – {formatDate(dateKey(weekEnd),dateLocale)}</p></div><div className="grid gap-3 xl:grid-cols-7">{weekDays.map(day=>{const key=dateKey(day);const dayTasks=weekTasks.filter(t=>t.due_date===key);return <article key={key} className="min-h-64 rounded-xl border bg-white p-3"><div className="border-b border-[#edf0ed] pb-3"><p className="text-xs uppercase tracking-[.12em] text-muted-foreground">{day.toLocaleDateString(dateLocale,{weekday:"long"})}</p><p className="mt-1 text-lg font-medium">{day.toLocaleDateString(dateLocale,{day:"2-digit",month:"short"})}</p><p className="mt-1 text-xs text-muted-foreground">{dayTasks.reduce((sum,t)=>sum+Number(t.estimated_minutes??0),0)} min</p></div><div className="mt-3 space-y-2">{dayTasks.map(task=><div key={task.id} className="rounded-lg border border-[#e4e8e4] p-3"><div className="flex items-start gap-2"><button onClick={()=>void toggleComplete(task)} className="mt-0.5 shrink-0 text-[var(--orchard-green)]">{task.status==="completada"?<CheckCircle2 className="h-4 w-4"/>:<Circle className="h-4 w-4"/>}</button><div className="min-w-0"><p className="text-sm font-medium leading-5">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.estimated_minutes?`${task.estimated_minutes} min`:"—"} · {ownerFor(task.id)}</p></div></div></div>)}{dayTasks.length===0&&<p className="py-4 text-xs text-muted-foreground">—</p>}</div></article>})}</div></section>}

      {mode==="workload-graph"&&<section className="mt-6"><div className="grid gap-px overflow-hidden rounded-xl border bg-[var(--orchard-line)] md:grid-cols-3"><Metric icon={Clock3} label={text.average} value={`${averageMinutes} min`}/><Metric icon={BarChart3} label={text.peak} value={peakWeek?`${formatDate(peakWeek,dateLocale)} · ${peakMinutes} min`:"—"}/><Metric icon={Users} label={text.total} value={`${totalMinutes} min`}/></div><div className="mt-5 rounded-xl border bg-white p-5"><h2 className="text-lg font-normal">{text.graph}</h2>{workloadWeeks.length===0?<p className="mt-6 text-sm text-muted-foreground">{text.noWorkload}</p>:<div className="mt-6 space-y-4">{workloadWeeks.map(([week,value])=><div key={week} className="grid grid-cols-[110px_1fr_90px] items-center gap-3"><p className="text-xs tabular-nums text-muted-foreground">{formatDate(week,dateLocale)}</p><div className="h-8 overflow-hidden rounded-md bg-[#edf1ed]"><div className="flex h-full items-center bg-[#d8e7df] px-2 text-xs font-medium text-[#1f624d]" style={{width:`${peakMinutes?Math.max(4,(value.minutes/peakMinutes)*100):0}%`}}>{value.tasks}</div></div><p className="text-right text-sm tabular-nums">{value.minutes} min</p></div>)}</div>}</div></section>}
    </>}

    {dialogOpen&&<div className="fixed inset-0 z-[110] grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label={text.createTitle}><div className="w-full max-w-lg rounded-2xl border bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-normal">{text.createTitle}</h2><button aria-label={text.cancel} onClick={()=>setDialogOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#f1f4f1]"><X className="h-4 w-4"/></button></div><div className="space-y-4 p-5"><Field label={text.taskField}><Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={text.estimated}><div className="flex items-center gap-2"><Input type="number" min="5" max="1440" value={form.minutes} onChange={e=>setForm(f=>({...f,minutes:e.target.value}))}/><span className="text-sm text-muted-foreground">min</span></div></Field><Field label={text.assign}><Select value={form.employeeId} onValueChange={value=>setForm(f=>({...f,employeeId:value}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">{text.unassigned}</SelectItem>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></Field></div><Field label={text.locationField}><Select value={form.locationId} onValueChange={value=>setForm(f=>({...f,locationId:value}))}><SelectTrigger><SelectValue placeholder={text.selectLocation}/></SelectTrigger><SelectContent><SelectItem value="none">{text.selectLocation}</SelectItem>{locations.map(item=><SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label={text.date}><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></Field><Field label={text.notes}><Textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></Field><Field label={text.recurrence}><Input value={text.noRepeat} disabled/><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.recurrenceGap}</p></Field></div><div className="flex justify-end gap-2 border-t p-4"><Button variant="outline" onClick={()=>setDialogOpen(false)}>{text.cancel}</Button><Button disabled={saving||!form.title.trim()||!form.date||form.employeeId==="none"||form.locationId==="none"} onClick={()=>void createTask()}>{text.create}</Button></div></div></div>}
  </main></AppLayout>
}

function Tab({href,active,icon:Icon,label}:{href:string;active:boolean;icon:typeof List;label:string}){return <Link href={href} aria-current={active?"page":undefined} className={cn("inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium",active?"border-[var(--orchard-green)] text-[var(--orchard-green)]":"border-transparent text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4"/>{label}</Link>}
function Field({label,children}:{label:string;children:ReactNode}){return <div><Label className="mb-2 block">{label}</Label>{children}</div>}
function Metric({icon:Icon,label,value}:{icon:typeof Clock3;label:string;value:string}){return <div className="bg-white p-5"><Icon className="h-4 w-4 text-[var(--orchard-green)]"/><p className="mt-4 text-xs uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl tabular-nums">{value}</p></div>}

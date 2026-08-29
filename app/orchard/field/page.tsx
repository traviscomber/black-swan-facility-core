"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, ArrowRight, Bug, CheckCircle2, ClipboardCheck, Clock3, Leaf, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Task = { id: string; title: string; priority: string; status: string; due_date: string | null; location_name: string | null; source_label: string | null }
type Lifecycle = { crop_succession_id: string; effective_status: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null; seeds_sown: number; transplanted_count: number; harvest_passes: number }
type Nursery = { id: string; crop_succession_id: string | null; status: string; expected_ready_date: string | null; ready_count: number | null; transplanted_count: number | null; location: string | null }
type Health = { id: string; crop_id: string; severity_level: string | null; treatment_effectiveness: string | null; observation_date: string }
type QuickAction = { href: string; title: string; description: string; icon: typeof Activity; photo: string }

const photo = (id: string, width = 1800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=92&w=${width}`

const PHOTOS = {
  hero: photo("1501004318641-b39e6451bec6", 2200),
  tasks: photo("1416879595882-3373a0480b5b"),
  care: photo("1598512752271-33f913a5af13"),
  health: photo("1585320806297-9794b3e4eeae"),
  harvest: photo("1464226184884-fa280b87c399"),
  nursery: photo("1466692476868-aef1dfb1e735"),
} as const

const copy = {
  en: {
    eyebrow: "Orchard · Field",
    title: "Field Mode",
    description: "A fast visual surface for the work that matters now: tasks, nursery readiness, harvest readiness and field recording.",
    refresh: "Refresh",
    today: "Today",
    overdue: "Overdue",
    upcoming: "Upcoming",
    noTasks: "No open Orchard tasks need attention right now.",
    complete: "Complete",
    start: "Start",
    nurseryReady: "Nursery ready",
    harvestReady: "Harvest ready",
    healthRisk: "Health attention",
    signals: "Field signals",
    signalsHelp: "What needs a field decision next.",
    noSignals: "No urgent field signals right now.",
    quick: "Quick record",
    quickHelp: "Choose the workflow visually and record from the field.",
    tasks: "Tasks",
    care: "Record care",
    health: "Record health",
    harvest: "Quick harvest",
    nursery: "Nursery actions",
    openWork: "Open task cockpit",
    loadError: "Could not load Field Mode",
    open: "Open",
  },
  es: {
    eyebrow: "Orchard · Terreno",
    title: "Modo Terreno",
    description: "Una superficie visual rápida para lo importante ahora: tareas, almácigos listos, cosecha próxima y registro en terreno.",
    refresh: "Actualizar",
    today: "Hoy",
    overdue: "Atrasadas",
    upcoming: "Próximas",
    noTasks: "No hay tareas abiertas de Orchard que requieran atención ahora.",
    complete: "Completar",
    start: "Iniciar",
    nurseryReady: "Almácigo listo",
    harvestReady: "Listo para cosecha",
    healthRisk: "Atención sanitaria",
    signals: "Señales de terreno",
    signalsHelp: "Lo próximo que requiere una decisión en terreno.",
    noSignals: "No hay señales urgentes de terreno ahora.",
    quick: "Registro rápido",
    quickHelp: "Elige visualmente el flujo y registra desde terreno.",
    tasks: "Tareas",
    care: "Registrar cuidado",
    health: "Registrar sanidad",
    harvest: "Cosecha rápida",
    nursery: "Acciones de almácigo",
    openWork: "Abrir cockpit de tareas",
    loadError: "No fue posible cargar Modo Terreno",
    open: "Abrir",
  },
} as const

function localDateKey(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function OrchardFieldPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const [tasks, setTasks] = useState<Task[]>([])
  const [lifecycle, setLifecycle] = useState<Lifecycle[]>([])
  const [nursery, setNursery] = useState<Nursery[]>([])
  const [health, setHealth] = useState<Health[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTask, setSavingTask] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [taskResult, lifecycleResult, nurseryResult, healthResult] = await Promise.all([
      supabase.from("tasks").select("id,title,priority,status,due_date,location_name,source_label").eq("operational_area", "huerto_vinedo").in("status", ["nueva", "en_progreso"]).order("due_date", { ascending: true, nullsFirst: false }).limit(40),
      supabase.from("orchard_succession_lifecycle").select("crop_succession_id,effective_status,planned_transplant_date,planned_first_harvest_date,seeds_sown,transplanted_count,harvest_passes").limit(80),
      supabase.from("orchard_nursery_batches").select("id,crop_succession_id,status,expected_ready_date,ready_count,transplanted_count,location").in("status", ["ready", "hardening", "growing"]).order("expected_ready_date", { ascending: true, nullsFirst: false }).limit(50),
      supabase.from("orchard_pest_logs").select("id,crop_id,severity_level,treatment_effectiveness,observation_date").in("severity_level", ["high", "critical"]).order("observation_date", { ascending: false }).limit(30),
    ])
    const firstError = taskResult.error ?? lifecycleResult.error ?? nurseryResult.error ?? healthResult.error
    if (firstError) setError(`${text.loadError}: ${firstError.message}`)
    else {
      setTasks((taskResult.data ?? []) as Task[])
      setLifecycle((lifecycleResult.data ?? []) as Lifecycle[])
      setNursery((nurseryResult.data ?? []) as Nursery[])
      setHealth((healthResult.data ?? []) as Health[])
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  async function transitionTask(task: Task, nextStatus: "en_progreso" | "completada") {
    setSavingTask(task.id)
    setError(null)
    const changes = nextStatus === "completada" ? { status: nextStatus, completed_at: new Date().toISOString() } : { status: nextStatus }
    const { error: updateError } = await supabase.from("tasks").update(changes).eq("id", task.id)
    if (updateError) setError(updateError.message)
    else await load()
    setSavingTask(null)
  }

  const today = localDateKey()
  const inSevenDays = localDateKey(7)
  const overdue = tasks.filter((task) => task.due_date && task.due_date < today)
  const dueToday = tasks.filter((task) => task.due_date === today)
  const upcoming = tasks.filter((task) => task.due_date && task.due_date > today && task.due_date <= inSevenDays)
  const readyNursery = nursery.filter((batch) => batch.status === "ready" || (batch.expected_ready_date && batch.expected_ready_date <= today && (batch.ready_count ?? 0) > (batch.transplanted_count ?? 0)))
  const harvestReady = lifecycle.filter((item) => item.effective_status === "harvest_ready" || (item.effective_status === "growing" && item.planned_first_harvest_date && item.planned_first_harvest_date <= today))
  const unresolvedHealth = health.filter((item) => !["effective", "very_effective"].includes(item.treatment_effectiveness ?? ""))

  const quickActions: QuickAction[] = [
    { href: `/${language}/orchard/work`, title: text.tasks, description: text.openWork, icon: ClipboardCheck, photo: PHOTOS.tasks },
    { href: `/${language}/orchard/care`, title: text.care, description: text.quickHelp, icon: Activity, photo: PHOTOS.care },
    { href: `/${language}/orchard/pests`, title: text.health, description: text.quickHelp, icon: Bug, photo: PHOTOS.health },
    { href: `/${language}/orchard/field/harvest`, title: text.harvest, description: text.quickHelp, icon: Leaf, photo: PHOTOS.harvest },
    { href: `/${language}/orchard/field/nursery`, title: text.nursery, description: text.quickHelp, icon: Sprout, photo: PHOTOS.nursery },
  ]

  const attentionTasks = [...overdue, ...dueToday, ...upcoming].filter((task, index, all) => all.findIndex((other) => other.id === task.id) === index)

  return (
    <AppLayout>
      <OrchardNavigation />
      <main className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <section className="relative isolate min-h-[360px] overflow-hidden bg-neutral-950 sm:min-h-[420px]">
          <img src={PHOTOS.hero} alt="Hands working among healthy vegetable crops" className="absolute inset-0 h-full w-full object-cover [filter:none] [opacity:1]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,11,9,.88)_0%,rgba(12,11,9,.58)_42%,rgba(12,11,9,.12)_100%)]" />
          <div className="relative flex min-h-[360px] max-w-2xl flex-col justify-end p-6 text-white sm:min-h-[420px] sm:p-10 lg:p-12">
            <p className="text-xs uppercase tracking-[0.22em] text-white/65">{text.eyebrow}</p>
            <h1 className="mt-3 text-4xl tracking-tight text-white sm:text-5xl">{text.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">{text.description}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void load()} disabled={loading} className="bg-[var(--bs-cool-sage)] text-[var(--bs-bg-primary)] hover:opacity-90"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>
              <Button asChild variant="outline" className="border-white/25 bg-black/20 text-white hover:bg-black/35 hover:text-white"><Link href={`/${language}/orchard/work`}>{text.openWork}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
          <div className="absolute bottom-6 right-6 hidden grid-cols-3 bg-black/45 text-white md:grid">
            <HeroMetric label={text.overdue} value={overdue.length} />
            <HeroMetric label={text.today} value={dueToday.length} />
            <HeroMetric label={text.upcoming} value={upcoming.length} />
          </div>
        </section>

        {error && <Card className="mt-5 border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <section className="mt-10">
          <div className="mb-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">01</p><h2 className="mt-2 text-2xl">{text.today}</h2></div>
          {attentionTasks.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{text.noTasks}</div> : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{attentionTasks.slice(0, 9).map((task) => <TaskTile key={task.id} task={task} saving={savingTask === task.id} text={text} onTransition={transitionTask} />)}</div>}
        </section>

        <section className="mt-12">
          <div className="mb-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">02</p><h2 className="mt-2 text-2xl">{text.signals}</h2><p className="mt-1 text-sm text-muted-foreground">{text.signalsHelp}</p></div>
          {readyNursery.length === 0 && harvestReady.length === 0 && unresolvedHealth.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{text.noSignals}</div> : <div className="grid gap-3 md:grid-cols-3">
            <SignalTile href={`/${language}/orchard/field/nursery`} photo={PHOTOS.nursery} icon={Sprout} label={text.nurseryReady} value={readyNursery.length} detail={readyNursery[0]?.location || readyNursery[0]?.expected_ready_date || "—"} />
            <SignalTile href={`/${language}/orchard/field/harvest`} photo={PHOTOS.harvest} icon={Leaf} label={text.harvestReady} value={harvestReady.length} detail={harvestReady[0]?.planned_first_harvest_date || "—"} />
            <SignalTile href={`/${language}/orchard/pests`} photo={PHOTOS.health} icon={Bug} label={text.healthRisk} value={unresolvedHealth.length} detail={unresolvedHealth[0]?.severity_level || "—"} />
          </div>}
        </section>

        <section className="mt-12">
          <div className="mb-5"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">03</p><h2 className="mt-2 text-2xl">{text.quick}</h2><p className="mt-1 text-sm text-muted-foreground">{text.quickHelp}</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {quickActions.map(({ href, title, description, icon: Icon, photo: actionPhoto }) => <Link key={href} href={href} className="group relative min-h-[210px] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src={actionPhoto} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover [filter:none] [opacity:1] transition-transform duration-500 group-hover:scale-[1.02]" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.02)_20%,rgba(0,0,0,.78)_100%)]" /><div className="absolute inset-x-0 bottom-0 p-4 text-white"><Icon className="mb-3 h-5 w-5" /><p className="font-medium">{title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">{description}</p><span className="mt-3 inline-flex items-center text-xs font-medium">{text.open}<ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></div></Link>)}
          </div>
        </section>
      </main>
    </AppLayout>
  )
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-28 border-l border-white/15 px-5 py-4"><p className="text-2xl tabular-nums">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/60">{label}</p></div>
}

function TaskTile({ task, saving, text, onTransition }: { task: Task; saving: boolean; text: (typeof copy)["en"] | (typeof copy)["es"]; onTransition: (task: Task, status: "en_progreso" | "completada") => Promise<void> }) {
  return <article className="border bg-[var(--bs-surface-primary)] p-5"><div className="flex flex-wrap gap-2"><Badge variant={task.priority === "urgente" || task.priority === "alta" ? "destructive" : "secondary"}>{task.priority}</Badge>{task.due_date && <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{task.due_date}</Badge>}</div><p className="mt-5 text-lg leading-snug">{task.title}</p>{(task.location_name || task.source_label) && <p className="mt-2 text-sm text-muted-foreground">{task.location_name || task.source_label}</p>}<div className="mt-6 grid grid-cols-2 gap-2">{task.status === "nueva" ? <Button variant="outline" disabled={saving} onClick={() => void onTransition(task, "en_progreso")}>{text.start}</Button> : <div className="flex min-h-10 items-center justify-center border px-3 text-xs text-muted-foreground">{task.status.replaceAll("_", " ")}</div>}<Button disabled={saving} onClick={() => void onTransition(task, "completada")}><CheckCircle2 className="mr-2 h-4 w-4" />{text.complete}</Button></div></article>
}

function SignalTile({ href, photo: signalPhoto, icon: Icon, label, value, detail }: { href: string; photo: string; icon: typeof Activity; label: string; value: number; detail: string }) {
  return <Link href={href} className="group relative min-h-[240px] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src={signalPhoto} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover [filter:none] [opacity:1] transition-transform duration-500 group-hover:scale-[1.02]" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.05)_10%,rgba(0,0,0,.82)_100%)]" /><div className="absolute inset-x-0 bottom-0 p-5 text-white"><div className="flex items-center justify-between"><Icon className="h-5 w-5" /><span className="text-3xl tabular-nums">{value}</span></div><p className="mt-8 text-lg">{label}</p><p className="mt-1 text-xs text-white/65">{detail}</p></div></Link>
}

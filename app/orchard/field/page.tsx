"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Bug, CheckCircle2, ClipboardCheck, Clock3, Leaf, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Task = { id: string; title: string; priority: string; status: string; due_date: string | null; location_name: string | null; source_label: string | null }
type Lifecycle = { crop_succession_id: string; effective_status: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null; seeds_sown: number; transplanted_count: number; harvest_passes: number }
type Nursery = { id: string; crop_succession_id: string | null; status: string; expected_ready_date: string | null; ready_count: number | null; transplanted_count: number | null; location: string | null }
type Health = { id: string; crop_id: string; severity_level: string | null; treatment_effectiveness: string | null; observation_date: string }

type QuickAction = { href: string; title: string; description: string; icon: typeof Activity }

const copy = {
  en: {
    title: "Field Mode",
    description: "A fast mobile surface for the work that matters now: tasks, nursery readiness, harvest readiness and field recording.",
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
    signalsHelp: "Derived from canonical Orchard records. No synthetic scores.",
    noSignals: "No urgent field signals right now.",
    quick: "Quick record",
    quickHelp: "Jump directly to the field workflow you need.",
    tasks: "Tasks",
    care: "Record care",
    health: "Record health",
    harvest: "Quick harvest",
    nursery: "Nursery actions",
    openWork: "Open task cockpit",
    loadError: "Could not load Field Mode",
  },
  es: {
    title: "Modo Terreno",
    description: "Una superficie móvil rápida para lo importante ahora: tareas, almácigos listos, cosecha próxima y registro en terreno.",
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
    signalsHelp: "Derivadas de registros canónicos de Orchard. Sin puntajes sintéticos.",
    noSignals: "No hay señales urgentes de terreno ahora.",
    quick: "Registro rápido",
    quickHelp: "Ve directo al flujo de terreno que necesitas.",
    tasks: "Tareas",
    care: "Registrar cuidado",
    health: "Registrar sanidad",
    harvest: "Cosecha rápida",
    nursery: "Acciones de almácigo",
    openWork: "Abrir cockpit de tareas",
    loadError: "No fue posible cargar Modo Terreno",
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
    { href: `/${language}/orchard/work`, title: text.tasks, description: text.openWork, icon: ClipboardCheck },
    { href: `/${language}/orchard/care`, title: text.care, description: text.quickHelp, icon: Activity },
    { href: `/${language}/orchard/pests`, title: text.health, description: text.quickHelp, icon: Bug },
    { href: `/${language}/orchard/field/harvest`, title: text.harvest, description: text.quickHelp, icon: Leaf },
    { href: `/${language}/orchard/field/nursery`, title: text.nursery, description: text.quickHelp, icon: Sprout },
  ]

  const attentionTasks = [...overdue, ...dueToday, ...upcoming].filter((task, index, all) => all.findIndex((other) => other.id === task.id) === index)

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} />
      <OrchardNavigation />
      <div className="space-y-5 p-3 pb-24 sm:p-6 lg:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Metric label={text.overdue} value={overdue.length} urgent={overdue.length > 0} />
          <Metric label={text.today} value={dueToday.length} urgent={dueToday.length > 0} />
          <Metric label={text.upcoming} value={upcoming.length} />
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">{text.today}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {attentionTasks.length === 0 ? <p className="text-sm text-muted-foreground">{text.noTasks}</p> : attentionTasks.map((task) => (
              <div key={task.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2"><Badge variant={task.priority === "urgente" || task.priority === "alta" ? "destructive" : "secondary"}>{task.priority}</Badge>{task.due_date && <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{task.due_date}</Badge>}</div>
                    <p className="mt-2 font-semibold leading-snug">{task.title}</p>
                    {(task.location_name || task.source_label) && <p className="mt-1 text-sm text-muted-foreground">{task.location_name || task.source_label}</p>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {task.status === "nueva" ? <Button variant="outline" className="min-h-11" disabled={savingTask === task.id} onClick={() => void transitionTask(task, "en_progreso")}>{text.start}</Button> : <div className="flex min-h-11 items-center justify-center rounded-md border px-3 text-sm text-muted-foreground">{task.status.replaceAll("_", " ")}</div>}
                  <Button className="min-h-11" disabled={savingTask === task.id} onClick={() => void transitionTask(task, "completada")}><CheckCircle2 className="mr-2 h-4 w-4" />{text.complete}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">{text.signals}</CardTitle><CardDescription>{text.signalsHelp}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {readyNursery.length === 0 && harvestReady.length === 0 && unresolvedHealth.length === 0 ? <p className="text-sm text-muted-foreground">{text.noSignals}</p> : <>
              {readyNursery.slice(0, 5).map((batch) => <Signal key={`nursery-${batch.id}`} href={`/${language}/orchard/field/nursery`} icon={Sprout} label={text.nurseryReady} detail={`${Math.max((batch.ready_count ?? 0) - (batch.transplanted_count ?? 0), 0)} ready${batch.location ? ` · ${batch.location}` : ""}`} />)}
              {harvestReady.slice(0, 5).map((item) => <Signal key={`harvest-${item.crop_succession_id}`} href={`/${language}/orchard/field/harvest`} icon={Leaf} label={text.harvestReady} detail={item.planned_first_harvest_date ?? item.effective_status} />)}
              {unresolvedHealth.slice(0, 5).map((item) => <Signal key={`health-${item.id}`} href={`/${language}/orchard/pests`} icon={Bug} label={text.healthRisk} detail={`${item.severity_level ?? "—"} · ${item.observation_date}`} />)}
            </>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">{text.quick}</CardTitle><CardDescription>{text.quickHelp}</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {quickActions.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="flex min-h-20 items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="rounded-lg border p-2"><Icon className="h-5 w-5" /></div><div><p className="font-medium">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></Link>)}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ label, value, urgent = false }: { label: string; value: number; urgent?: boolean }) {
  return <Card className={urgent ? "border-destructive/50" : undefined}><CardContent className="p-3 sm:p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p></CardContent></Card>
}

function Signal({ href, icon: Icon, label, detail }: { href: string; icon: typeof Activity; label: string; detail: string }) {
  return <Link href={href} className="flex min-h-14 items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="h-5 w-5 shrink-0" /><div className="min-w-0"><p className="font-medium">{label}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div></Link>
}

"use client"

import Link from "next/link"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, ArrowRight, CalendarClock, HeartPulse, MapPin, Plus, RefreshCw, Sprout, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { ALL_GAME_PLANS, gamePlanScopeLabel, resolveRequestedGamePlanId, resolveSelectedGamePlan, scopeBySuccessionId, scopeGamePlanGraph, syncGamePlanQuery, withGamePlanQuery } from "@/lib/orchard/game-plan-scope"

type GamePlan = { id: string; name: string; season: string | null; start_date: string; end_date: string; status: string }
type Crop = { id: string; plot_id: string; crop_succession_id: string | null; crop_name: string; crop_type: string; variety: string | null; planting_date: string; expected_harvest_date: string | null; actual_harvest_date: string | null; quantity_planted: number | null; planting_unit: string | null; status: string; estimated_yield: number | null; actual_yield: number | null; yield_unit: string | null; spacing_cm: number | null; depth_cm: number | null; water_frequency: string | null; fertilizer_schedule: string | null; notes: string | null }
type Plot = { id: string; name: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null; planned_plants: number | null; plant_spacing_cm: number | null }
type Cycle = { id: string; game_plan_id: string; crop_name: string; variety: string | null; cycle_type: string }
type Allocation = { crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Care = { crop_id: string; activity_date: string; activity_type: string }
type Health = { crop_id: string; observation_date: string; severity_level: string | null; treatment_effectiveness: string | null }
type Task = { id: string; title: string; status: string; due_date: string | null; source_id: string | null; priority: string }

const statuses = ["seedling", "growing", "mature", "harvested", "failed"]
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=92`
const cropPhoto = (name: string) => {
  const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (key.includes("tomato") || key.includes("tomate")) return photo("photo-1592924357228-91a4daadcfea")
  if (key.includes("lettuce") || key.includes("lechuga")) return photo("photo-1622206151226-18ca2c9ab4a1")
  if (key.includes("radish") || key.includes("rabanito") || key.includes("rabano")) return photo("photo-1582284540020-8acbe03f4924")
  if (key.includes("onion") || key.includes("cebolla")) return photo("photo-1508747703725-719777637510")
  if (key.includes("carrot") || key.includes("zanahoria")) return photo("photo-1447175008436-054170c2e979")
  if (key.includes("arugula") || key.includes("rocket") || key.includes("rucula")) return photo("photo-1603048719539-9ecb4aa395e3")
  if (key.includes("spinach") || key.includes("espinaca")) return photo("photo-1576045057995-568f588f82fb")
  if (key.includes("basil") || key.includes("albahaca")) return photo("photo-1618375569909-3c8616cf7733")
  if (key.includes("parsley") || key.includes("perejil")) return photo("photo-1590759668628-05b0fc34bb70")
  if (key.includes("potato") || key.includes("papa")) return photo("photo-1518977676601-b53f82aba655")
  if (key.includes("beet") || key.includes("betarraga")) return photo("photo-1593105544559-ecb03bf76f82")
  if (key.includes("pepper") || key.includes("pimenton")) return photo("photo-1563565375-f3fdfdbefa83")
  if (key.includes("zucchini") || key.includes("zapallo italiano")) return photo("photo-1563252722-6434563a985d")
  return photo("photo-1416879595882-3373a0480b5b")
}
const localDateKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const daysUntil = (value: string | null) => value ? Math.ceil((new Date(`${value}T12:00:00`).getTime() - new Date(`${localDateKey()}T12:00:00`).getTime()) / 86400000) : null
const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()

const copy = {
  en: { title: "Crops", description: "Operate every live crop from one visual cockpit with lineage, care, health, work and harvest context in view.", newCrop: "Create live crop", succession: "Planned succession", manual: "Manual / unplanned crop", plot: "Plot", crop: "Crop", type: "Crop type", variety: "Variety", planted: "Planting date", harvest: "Expected harvest", quantity: "Quantity planted", unit: "Unit", spacing: "Spacing (cm)", depth: "Depth (cm)", water: "Water frequency", yield: "Estimated yield", yieldUnit: "Yield unit", fertilizer: "Fertilizer schedule", notes: "Notes", create: "Create crop", refresh: "Refresh", loading: "Loading…", empty: "No operational crops in this scope.", saveError: "Could not save crop", delete: "Delete this crop and its related logs?", actualYield: "Actual yield", actualHarvest: "Actual harvest", lineage: "Planning lineage", command: "Live crop operations", commandHelp: "See what is growing, where it lives, what happened recently and what is scheduled next.", active: "Active crops", mature: "Mature", healthObservations: "High-severity observations", openWork: "Open work", lastCare: "Last care", health: "Health observations", nextTask: "Next task", harvestIn: "Harvest in", days: "days", noCare: "No care logged", noHighSeverity: "No high-severity observations", recorded: "Recorded", noTask: "No open task", careAction: "Open care", healthAction: "Health observations", lifecycleAction: "Lifecycle", plannedLineage: "Planned", manualLineage: "Manual", fieldStatus: "Field status", scope: "Game Plan scope", allPlans: "All Game Plans", scopedHelp: "Scoped views include only crops linked to successions in this Game Plan. Manual crops remain visible only in All Game Plans." },
  es: { title: "Cultivos", description: "Opera cada cultivo vivo desde un cockpit visual con trazabilidad, cuidados, sanidad, trabajo y contexto de cosecha a la vista.", newCrop: "Crear cultivo vivo", succession: "Sucesión planificada", manual: "Cultivo manual / no planificado", plot: "Sector", crop: "Cultivo", type: "Tipo", variety: "Variedad", planted: "Fecha de plantación", harvest: "Cosecha esperada", quantity: "Cantidad plantada", unit: "Unidad", spacing: "Distancia (cm)", depth: "Profundidad (cm)", water: "Frecuencia de riego", yield: "Rendimiento estimado", yieldUnit: "Unidad rendimiento", fertilizer: "Plan de fertilización", notes: "Notas", create: "Crear cultivo", refresh: "Actualizar", loading: "Cargando…", empty: "No hay cultivos operativos en este alcance.", saveError: "No fue posible guardar el cultivo", delete: "¿Eliminar este cultivo y sus registros relacionados?", actualYield: "Rendimiento real", actualHarvest: "Cosecha real", lineage: "Trazabilidad del plan", command: "Operación de cultivos vivos", commandHelp: "Mira qué está creciendo, dónde está, qué pasó recientemente y qué está programado después.", active: "Cultivos activos", mature: "Maduros", healthObservations: "Observaciones de alta severidad", openWork: "Trabajo abierto", lastCare: "Último cuidado", health: "Observaciones sanitarias", nextTask: "Próxima tarea", harvestIn: "Cosecha en", days: "días", noCare: "Sin cuidados registrados", noHighSeverity: "Sin observaciones de alta severidad", recorded: "Registradas", noTask: "Sin tarea abierta", careAction: "Abrir cuidados", healthAction: "Observaciones sanitarias", lifecycleAction: "Ciclo", plannedLineage: "Planificado", manualLineage: "Manual", fieldStatus: "Estado en terreno", scope: "Alcance Game Plan", allPlans: "Todos los Game Plans", scopedHelp: "Las vistas acotadas incluyen solo cultivos ligados a sucesiones de este Game Plan. Los cultivos manuales aparecen únicamente en Todos los Game Plans." },
} as const

export default function OrchardCropsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [plans, setPlans] = useState<GamePlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL_GAME_PLANS)
  const [crops, setCrops] = useState<Crop[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [care, setCare] = useState<Care[]>([])
  const [health, setHealth] = useState<Health[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emptyForm = () => ({ crop_succession_id: "none", plot_id: "", crop_name: "", crop_type: "vegetable", variety: "", planting_date: "", expected_harvest_date: "", quantity_planted: "", planting_unit: "plants", spacing_cm: "", depth_cm: "", water_frequency: "", estimated_yield: "", yield_unit: "kg", fertilizer_schedule: "", notes: "" })
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [gp, c, p, s, cy, a, b, careResult, healthResult, taskResult] = await Promise.all([
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date", { ascending: false }),
      supabase.from("orchard_crops").select("id,plot_id,crop_succession_id,crop_name,crop_type,variety,planting_date,expected_harvest_date,actual_harvest_date,quantity_planted,planting_unit,status,estimated_yield,actual_yield,yield_unit,spacing_cm,depth_cm,water_frequency,fertilizer_schedule,notes").order("planting_date", { ascending: false }),
      supabase.from("orchard_plots").select("id,name").order("name"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_plants,plant_spacing_cm").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id,crop_name,variety,cycle_type"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id,bed_id"),
      supabase.from("orchard_beds").select("id,plot_id,name"),
      supabase.from("orchard_care_logs").select("crop_id,activity_date,activity_type").order("activity_date", { ascending: false }),
      supabase.from("orchard_pest_logs").select("crop_id,observation_date,severity_level,treatment_effectiveness").order("observation_date", { ascending: false }),
      supabase.from("tasks").select("id,title,status,due_date,source_id,priority").eq("operational_area", "huerto_vinedo").like("source_type", "orchard_%").order("due_date", { ascending: true, nullsFirst: false }),
    ])
    const queryError = gp.error ?? c.error ?? p.error ?? s.error ?? cy.error ?? a.error ?? b.error ?? careResult.error ?? healthResult.error ?? taskResult.error
    if (queryError) setError(queryError.message)
    else {
      const nextPlans = (gp.data ?? []) as GamePlan[]
      setPlans(nextPlans); setCrops((c.data ?? []) as Crop[]); setPlots((p.data ?? []) as Plot[]); setSuccessions((s.data ?? []) as Succession[]); setCycles((cy.data ?? []) as Cycle[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setCare((careResult.data ?? []) as Care[]); setHealth((healthResult.data ?? []) as Health[]); setTasks((taskResult.data ?? []) as Task[])
      if (typeof window !== "undefined") setSelectedPlanId(resolveRequestedGamePlanId(nextPlans, window.location.search))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const selectedPlan = useMemo(() => resolveSelectedGamePlan(plans, selectedPlanId), [plans, selectedPlanId])
  const { scopedCycles, scopedSuccessions, successionIds } = useMemo(() => scopeGamePlanGraph(cycles, successions, selectedPlanId), [cycles, successions, selectedPlanId])
  const scopedCrops = useMemo(() => scopeBySuccessionId(crops, successionIds, selectedPlanId, (crop) => crop.crop_succession_id), [crops, successionIds, selectedPlanId])
  const scopedCropIds = useMemo(() => new Set(scopedCrops.map((crop) => crop.id)), [scopedCrops])
  const scopedCare = useMemo(() => selectedPlanId === ALL_GAME_PLANS ? care : care.filter((item) => scopedCropIds.has(item.crop_id)), [care, scopedCropIds, selectedPlanId])
  const scopedHealth = useMemo(() => selectedPlanId === ALL_GAME_PLANS ? health : health.filter((item) => scopedCropIds.has(item.crop_id)), [health, scopedCropIds, selectedPlanId])
  const scopedTasks = useMemo(() => selectedPlanId === ALL_GAME_PLANS ? tasks : tasks.filter((task) => Boolean(task.source_id && successionIds.has(task.source_id))), [tasks, successionIds, selectedPlanId])
  const scopedAllocations = useMemo(() => scopeBySuccessionId(allocations, successionIds, selectedPlanId, (item) => item.crop_succession_id), [allocations, successionIds, selectedPlanId])
  const cycleById = useMemo(() => new Map(scopedCycles.map((item) => [item.id, item])), [scopedCycles])
  const successionById = useMemo(() => new Map(scopedSuccessions.map((item) => [item.id, item])), [scopedSuccessions])
  const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds])
  const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots])
  const successionLabel = (id: string) => { const succession = successionById.get(id); const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null; return succession && cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${succession.sequence_no}` : id }
  const openTasks = scopedTasks.filter((task) => !["done", "completed", "cancelled", "completada", "cancelada"].includes(normalize(task.status)))
  const activeCrops = scopedCrops.filter((crop) => !["harvested", "failed"].includes(crop.status))
  const highSeverityObservations = scopedHealth.filter((item) => ["high", "critical"].includes(normalize(item.severity_level))).length

  function changePlan(value: string) {
    setSelectedPlanId(value); syncGamePlanQuery(value); setForm(emptyForm())
  }

  function chooseSuccession(id: string) {
    if (id === "none") { setForm((current) => ({ ...current, crop_succession_id: "none" })); return }
    const succession = successionById.get(id); const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null; const allocation = scopedAllocations.find((item) => item.crop_succession_id === id); const bed = allocation ? bedById.get(allocation.bed_id) : null
    setForm((current) => ({ ...current, crop_succession_id: id, plot_id: bed?.plot_id ?? current.plot_id, crop_name: cycle?.crop_name ?? current.crop_name, variety: cycle?.variety ?? current.variety, crop_type: cycle?.cycle_type ?? current.crop_type, planting_date: succession?.planned_transplant_date || succession?.planned_sow_date || current.planting_date, expected_harvest_date: succession?.planned_first_harvest_date ?? current.expected_harvest_date, quantity_planted: succession?.planned_plants?.toString() ?? current.quantity_planted, spacing_cm: succession?.plant_spacing_cm?.toString() ?? current.spacing_cm }))
  }

  async function createCrop(event: FormEvent) {
    event.preventDefault(); if (!form.plot_id || !form.crop_name || !form.crop_type || !form.planting_date) return
    if (selectedPlanId !== ALL_GAME_PLANS && (form.crop_succession_id === "none" || !successionIds.has(form.crop_succession_id))) { setError(text.saveError); return }
    const numberOrNull = (value: string) => value ? Number(value) : null
    setSaving(true); setError(null)
    const result = await supabase.from("orchard_crops").insert({ crop_succession_id: form.crop_succession_id === "none" ? null : form.crop_succession_id, plot_id: form.plot_id, crop_name: form.crop_name.trim(), crop_type: form.crop_type.trim(), variety: form.variety.trim() || null, planting_date: form.planting_date, expected_harvest_date: form.expected_harvest_date || null, quantity_planted: numberOrNull(form.quantity_planted), planting_unit: form.planting_unit || null, spacing_cm: numberOrNull(form.spacing_cm), depth_cm: numberOrNull(form.depth_cm), water_frequency: form.water_frequency.trim() || null, estimated_yield: numberOrNull(form.estimated_yield), yield_unit: form.yield_unit || null, fertilizer_schedule: form.fertilizer_schedule.trim() || null, notes: form.notes.trim() || null })
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else { setForm(emptyForm()); await load() }
    setSaving(false)
  }

  async function updateCrop(crop: Crop, changes: Partial<Crop>) {
    if (!scopedCropIds.has(crop.id)) return
    setSaving(true); const result = await supabase.from("orchard_crops").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", crop.id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false)
  }
  async function remove(id: string) {
    if (!scopedCropIds.has(id) || !window.confirm(text.delete)) return
    setSaving(true); const result = await supabase.from("orchard_crops").delete().eq("id", id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false)
  }

  return <AppLayout><PageHeader title={text.title} description={text.description} actions={<div className="flex flex-wrap gap-2"><Select value={selectedPlanId} onValueChange={changePlan}><SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_GAME_PLANS}>{text.allPlans}</SelectItem>{plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{gamePlanScopeLabel(plan, plan.name)}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button></div>} /><OrchardNavigation /><div className="space-y-7 p-4 sm:p-8">
    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    {selectedPlan && <Card><CardContent className="p-4 text-sm"><span className="font-medium">{text.scope}: {gamePlanScopeLabel(selectedPlan, selectedPlan.name)}</span><span className="ml-2 text-muted-foreground">{text.scopedHelp}</span></CardContent></Card>}

    <section className="relative min-h-[340px] overflow-hidden bg-neutral-950 text-white"><img src={photo("photo-1464226184884-fa280b87c399")} alt="Healthy crops in active field operations" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0" style={{background:"linear-gradient(90deg,rgba(5,8,7,.94),rgba(5,8,7,.66) 58%,rgba(5,8,7,.18)),linear-gradient(0deg,rgba(5,8,7,.72),rgba(5,8,7,.05) 60%)"}}/><div className="relative flex min-h-[340px] max-w-3xl flex-col justify-end p-6 sm:p-9"><p className="text-xs uppercase tracking-[.2em] text-white/60">Orchard · Operations</p><h2 className="mt-3 text-4xl font-medium tracking-[-.04em] sm:text-5xl">{text.command}</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">{text.commandHelp}</p><div className="mt-6 grid max-w-2xl grid-cols-2 gap-px bg-white/10 sm:grid-cols-4"><HeroMetric label={text.active} value={activeCrops.length} /><HeroMetric label={text.mature} value={scopedCrops.filter((crop) => crop.status === "mature").length} /><HeroMetric label={text.healthObservations} value={highSeverityObservations} /><HeroMetric label={text.openWork} value={openTasks.length} /></div></div></section>

    <section><div className="mb-5"><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01</p><h2 className="mt-2">{text.fieldStatus}</h2><p className="mt-1 text-sm text-muted-foreground">{text.commandHelp}</p></div>{loading ? <p className="text-sm text-muted-foreground">{text.loading}</p> : scopedCrops.length === 0 ? <div className="border border-dashed p-6 text-sm text-muted-foreground">{text.empty}</div> : <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{scopedCrops.map((crop) => {
      const plot = plotById.get(crop.plot_id); const cropCare = scopedCare.filter((item) => item.crop_id === crop.id); const lastCare = cropCare[0] ?? null; const cropHealth = scopedHealth.filter((item) => item.crop_id === crop.id); const highSeverity = cropHealth.filter((item) => ["high", "critical"].includes(normalize(item.severity_level))); const cropTasks = crop.crop_succession_id ? openTasks.filter((task) => task.source_id === crop.crop_succession_id) : []; const nextTask = cropTasks.find((task) => task.due_date) ?? cropTasks[0] ?? null; const harvestDays = daysUntil(crop.expected_harvest_date); const allocation = crop.crop_succession_id ? scopedAllocations.find((item) => item.crop_succession_id === crop.crop_succession_id) : null; const bed = allocation ? bedById.get(allocation.bed_id) : null
      return <article key={crop.id} className="overflow-hidden border bg-background"><div className="relative h-52 overflow-hidden"><img src={cropPhoto(crop.crop_name)} alt={crop.crop_name} className="h-full w-full object-cover opacity-100 [filter:none] transition-transform duration-500 hover:scale-[1.015]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,8,7,.9)_0%,rgba(5,8,7,.08)_72%)]"/><div className="absolute inset-x-4 bottom-4 text-white"><div className="flex flex-wrap gap-2"><Badge className="border-white/15 bg-black/35 text-white">{crop.status}</Badge><Badge className="border-white/15 bg-black/35 text-white"><MapPin className="mr-1 h-3 w-3" />{plot?.name ?? "—"}{bed ? ` · ${bed.name}` : ""}</Badge></div><h3 className="mt-3 text-2xl font-medium text-white!">{crop.crop_name}{crop.variety ? ` · ${crop.variety}` : ""}</h3><p className="mt-1 text-xs text-white/65">{crop.crop_succession_id ? `${text.plannedLineage} · ${successionLabel(crop.crop_succession_id)}` : text.manualLineage}</p></div></div>
        <div className="grid grid-cols-3 gap-px bg-border"><Signal icon={<Activity className="h-4 w-4"/>} label={text.lastCare} value={lastCare ? `${lastCare.activity_type} · ${new Date(`${lastCare.activity_date}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" })}` : text.noCare} /><Signal icon={<HeartPulse className="h-4 w-4"/>} label={text.health} value={highSeverity.length ? `${highSeverity.length} · ${text.recorded}` : text.noHighSeverity} /><Signal icon={<CalendarClock className="h-4 w-4"/>} label={text.nextTask} value={nextTask ? `${nextTask.title}${nextTask.due_date ? ` · ${new Date(`${nextTask.due_date}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" })}` : ""}` : text.noTask} /></div>
        <div className="space-y-4 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-muted-foreground">{crop.quantity_planted ?? "—"} {crop.planting_unit ?? ""}{harvestDays != null && harvestDays >= 0 ? ` · ${text.harvestIn} ${harvestDays} ${text.days}` : ""}</div><Select value={crop.status} onValueChange={(value) => void updateCrop(crop, { status: value })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2 sm:grid-cols-3"><Button asChild variant="outline" size="sm"><Link href={withGamePlanQuery(`/${language}/orchard/care`, selectedPlanId)}><Activity className="mr-2 h-4 w-4" />{text.careAction}</Link></Button><Button asChild variant="outline" size="sm"><Link href={withGamePlanQuery(`/${language}/orchard/pests`, selectedPlanId)}><HeartPulse className="mr-2 h-4 w-4" />{text.healthAction}</Link></Button><Button asChild variant="outline" size="sm"><Link href={withGamePlanQuery(`/${language}/orchard/lifecycle`, selectedPlanId)}><Sprout className="mr-2 h-4 w-4" />{text.lifecycleAction}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><div className="grid gap-3 border-t pt-4 sm:grid-cols-2"><Field label={text.actualHarvest}><Input type="date" defaultValue={crop.actual_harvest_date ?? ""} onBlur={(event) => void updateCrop(crop, { actual_harvest_date: event.target.value || null })} /></Field><Field label={text.actualYield}><Input type="number" min="0" step="0.1" defaultValue={crop.actual_yield ?? ""} onBlur={(event) => void updateCrop(crop, { actual_yield: event.target.value ? Number(event.target.value) : null })} /></Field><div className="sm:col-span-2"><Field label={text.notes}><Textarea defaultValue={crop.notes ?? ""} onBlur={(event) => void updateCrop(crop, { notes: event.target.value || null })} /></Field></div></div><div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => void remove(crop.id)}><Trash2 className="mr-2 h-4 w-4" />{text.delete.split("?")[0]}</Button></div></div>
      </article>})}</div>}</section>

    <Card><CardHeader><CardTitle>{text.newCrop}</CardTitle><CardDescription>{text.lineage}</CardDescription></CardHeader><CardContent><form onSubmit={createCrop} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="md:col-span-2"><Field label={text.succession}><Select value={form.crop_succession_id} onValueChange={chooseSuccession}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{selectedPlanId === ALL_GAME_PLANS && <SelectItem value="none">{text.manual}</SelectItem>}{scopedSuccessions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item.id)}</SelectItem>)}</SelectContent></Select></Field></div><Field label={text.plot}><Select value={form.plot_id} onValueChange={(value) => setForm((current) => ({ ...current, plot_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{plots.map((plot) => <SelectItem key={plot.id} value={plot.id}>{plot.name}</SelectItem>)}</SelectContent></Select></Field><Field label={text.crop}><Input value={form.crop_name} onChange={(event) => setForm((current) => ({ ...current, crop_name: event.target.value }))} required /></Field><Field label={text.type}><Input value={form.crop_type} onChange={(event) => setForm((current) => ({ ...current, crop_type: event.target.value }))} required /></Field><Field label={text.variety}><Input value={form.variety} onChange={(event) => setForm((current) => ({ ...current, variety: event.target.value }))} /></Field><Field label={text.planted}><Input type="date" value={form.planting_date} onChange={(event) => setForm((current) => ({ ...current, planting_date: event.target.value }))} required /></Field><Field label={text.harvest}><Input type="date" value={form.expected_harvest_date} onChange={(event) => setForm((current) => ({ ...current, expected_harvest_date: event.target.value }))} /></Field><Field label={text.quantity}><Input type="number" min="0" value={form.quantity_planted} onChange={(event) => setForm((current) => ({ ...current, quantity_planted: event.target.value }))} /></Field><Field label={text.unit}><Input value={form.planting_unit} onChange={(event) => setForm((current) => ({ ...current, planting_unit: event.target.value }))} /></Field><Field label={text.spacing}><Input type="number" min="0" step="0.1" value={form.spacing_cm} onChange={(event) => setForm((current) => ({ ...current, spacing_cm: event.target.value }))} /></Field><Field label={text.depth}><Input type="number" min="0" step="0.1" value={form.depth_cm} onChange={(event) => setForm((current) => ({ ...current, depth_cm: event.target.value }))} /></Field><Field label={text.water}><Input value={form.water_frequency} onChange={(event) => setForm((current) => ({ ...current, water_frequency: event.target.value }))} /></Field><Field label={text.yield}><Input type="number" min="0" step="0.1" value={form.estimated_yield} onChange={(event) => setForm((current) => ({ ...current, estimated_yield: event.target.value }))} /></Field><Field label={text.yieldUnit}><Input value={form.yield_unit} onChange={(event) => setForm((current) => ({ ...current, yield_unit: event.target.value }))} /></Field><div className="md:col-span-2"><Field label={text.fertilizer}><Textarea value={form.fertilizer_schedule} onChange={(event) => setForm((current) => ({ ...current, fertilizer_schedule: event.target.value }))} /></Field></div><div className="md:col-span-2"><Field label={text.notes}><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field></div><div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving || plots.length === 0 || (selectedPlanId !== ALL_GAME_PLANS && form.crop_succession_id === "none")}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></div></form></CardContent></Card>
  </div></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="bg-black/35 p-4"><p className="text-[10px] uppercase tracking-[.14em] text-white/55">{label}</p><p className="mt-1 text-2xl font-medium text-white">{value}</p></div> }
function Signal({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="bg-background p-3"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">{icon}{label}</div><p className="mt-2 line-clamp-2 text-xs text-foreground">{value}</p></div> }

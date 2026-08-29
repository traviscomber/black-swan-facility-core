"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarRange, Plus, RefreshCw, Sprout, Trash2 } from "lucide-react"
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

type GamePlan = {
  id: string
  name: string
  season: string | null
  start_date: string
  end_date: string
  status: "draft" | "active" | "completed" | "archived"
  objective: string | null
  notes: string | null
}

type CropCycle = {
  id: string
  game_plan_id: string
  crop_name: string
  variety: string | null
  cycle_type: "direct_sow" | "transplant" | "perennial" | "cover_crop"
  planned_start_date: string
  target_harvest_date: string | null
  status: "planned" | "nursery" | "planted" | "growing" | "harvest_ready" | "completed" | "cancelled"
  planned_area_sqm: number | null
  target_quantity: number | null
  target_unit: string | null
  notes: string | null
}

type Succession = {
  id: string
  crop_cycle_id: string
  sequence_no: number
  planned_sow_date: string
  planned_transplant_date: string | null
  planned_first_harvest_date: string | null
  planned_last_harvest_date: string | null
  days_to_maturity: number | null
  planned_plants: number | null
  planned_area_sqm: number | null
  plant_spacing_cm: number | null
  row_spacing_cm: number | null
  germination_rate_pct: number | null
  seeds_per_plant: number | null
  status: "planned" | "sown" | "transplanted" | "harvesting" | "completed" | "cancelled"
  notes: string | null
}

type PlanningEvent = {
  date: string
  type: "sow" | "transplant" | "harvest"
  crop: string
  succession: number
}

const copy = {
  en: {
    title: "Game Plan",
    description: "Plan crops through time before they become field records: successions, seed needs, workload and harvest windows.",
    newPlan: "New game plan",
    newPlanDescription: "Define a season or operating window, objective, and dates.",
    planName: "Plan name",
    season: "Season",
    start: "Start date",
    end: "End date",
    objective: "Objective",
    notes: "Notes",
    createPlan: "Create game plan",
    plans: "Game plans",
    noPlans: "No game plans yet. Create the first operating plan.",
    cycles: "Crop cycles",
    cyclesDescription: "A crop cycle groups one crop/variety and its repeated successions through the season.",
    addCycle: "Add crop cycle",
    crop: "Crop",
    variety: "Variety",
    cycleType: "Cycle type",
    targetHarvest: "Target harvest",
    area: "Planned area (m²)",
    quantity: "Target quantity",
    unit: "Unit",
    createCycle: "Create crop cycle",
    noCycles: "No crop cycles in this plan yet.",
    selectPlan: "Select a game plan to add crop cycles.",
    loadError: "Could not load planning data",
    saveError: "Could not save changes",
    deleteConfirmPlan: "Delete this game plan and all of its crop cycles and successions?",
    deleteConfirmCycle: "Delete this crop cycle and all of its successions?",
    deleteConfirmSuccession: "Delete this succession?",
    activeWindow: "Operating window",
    refresh: "Refresh",
    loading: "Loading…",
    successions: "Successions",
    succession: "Succession",
    addSuccession: "Add succession",
    sowDate: "Sow date",
    transplantDate: "Transplant date",
    firstHarvest: "First harvest",
    lastHarvest: "Last harvest",
    maturity: "Days to maturity",
    plants: "Planned plants",
    plantSpacing: "Plant spacing (cm)",
    rowSpacing: "Row spacing (cm)",
    germination: "Germination (%)",
    seedsPerPlant: "Seeds / plant",
    seedRequirement: "Estimated seeds",
    createSuccession: "Create succession",
    noSuccessions: "No successions yet. Add the first sowing window.",
    planningSummary: "Planning summary",
    totalArea: "Planned area",
    plannedPlants: "Planned plants",
    estimatedSeeds: "Estimated seeds",
    harvestWindows: "Harvest windows",
    weeklyWorkload: "Weekly workload",
    weeklyWorkloadDescription: "Deterministic planning events from successions. Actual assigned tasks are created in the Tasks step.",
    noEvents: "No sow, transplant or harvest events have been planned yet.",
    sow: "Sow",
    transplant: "Transplant",
    harvest: "Harvest",
    cycleCount: (count: number) => `${count} cycle${count === 1 ? "" : "s"}`,
    successionCount: (count: number) => `${count} succession${count === 1 ? "" : "s"}`,
    events: (count: number) => `${count} event${count === 1 ? "" : "s"}`,
  },
  es: {
    title: "Plan de Cultivo",
    description: "Planifica cultivos en el tiempo antes de convertirlos en registros de terreno: sucesiones, semillas, carga de trabajo y ventanas de cosecha.",
    newPlan: "Nuevo plan",
    newPlanDescription: "Define temporada o ventana operativa, objetivo y fechas.",
    planName: "Nombre del plan",
    season: "Temporada",
    start: "Fecha de inicio",
    end: "Fecha de término",
    objective: "Objetivo",
    notes: "Notas",
    createPlan: "Crear plan",
    plans: "Planes",
    noPlans: "Aún no hay planes. Crea el primer plan operativo.",
    cycles: "Ciclos de cultivo",
    cyclesDescription: "Un ciclo agrupa un cultivo/variedad y sus siembras sucesivas durante la temporada.",
    addCycle: "Agregar ciclo",
    crop: "Cultivo",
    variety: "Variedad",
    cycleType: "Tipo de ciclo",
    targetHarvest: "Cosecha objetivo",
    area: "Área planificada (m²)",
    quantity: "Cantidad objetivo",
    unit: "Unidad",
    createCycle: "Crear ciclo",
    noCycles: "Aún no hay ciclos en este plan.",
    selectPlan: "Selecciona un plan para agregar ciclos.",
    loadError: "No fue posible cargar la planificación",
    saveError: "No fue posible guardar los cambios",
    deleteConfirmPlan: "¿Eliminar este plan y todos sus ciclos y sucesiones?",
    deleteConfirmCycle: "¿Eliminar este ciclo y todas sus sucesiones?",
    deleteConfirmSuccession: "¿Eliminar esta sucesión?",
    activeWindow: "Ventana operativa",
    refresh: "Actualizar",
    loading: "Cargando…",
    successions: "Sucesiones",
    succession: "Sucesión",
    addSuccession: "Agregar sucesión",
    sowDate: "Fecha de siembra",
    transplantDate: "Fecha de trasplante",
    firstHarvest: "Primera cosecha",
    lastHarvest: "Última cosecha",
    maturity: "Días a madurez",
    plants: "Plantas planificadas",
    plantSpacing: "Distancia entre plantas (cm)",
    rowSpacing: "Distancia entre hileras (cm)",
    germination: "Germinación (%)",
    seedsPerPlant: "Semillas / planta",
    seedRequirement: "Semillas estimadas",
    createSuccession: "Crear sucesión",
    noSuccessions: "Aún no hay sucesiones. Agrega la primera ventana de siembra.",
    planningSummary: "Resumen de planificación",
    totalArea: "Área planificada",
    plannedPlants: "Plantas planificadas",
    estimatedSeeds: "Semillas estimadas",
    harvestWindows: "Ventanas de cosecha",
    weeklyWorkload: "Carga semanal",
    weeklyWorkloadDescription: "Eventos determinísticos generados desde las sucesiones. Las tareas con responsables se crean en el paso Tareas.",
    noEvents: "Aún no hay eventos de siembra, trasplante o cosecha planificados.",
    sow: "Sembrar",
    transplant: "Trasplantar",
    harvest: "Cosechar",
    cycleCount: (count: number) => `${count} ciclo${count === 1 ? "" : "s"}`,
    successionCount: (count: number) => `${count} sucesión${count === 1 ? "" : "es"}`,
    events: (count: number) => `${count} evento${count === 1 ? "" : "s"}`,
  },
} as const

const planStatuses: GamePlan["status"][] = ["draft", "active", "completed", "archived"]
const cycleStatuses: CropCycle["status"][] = ["planned", "nursery", "planted", "growing", "harvest_ready", "completed", "cancelled"]
const cycleTypes: CropCycle["cycle_type"][] = ["direct_sow", "transplant", "perennial", "cover_crop"]
const successionStatuses: Succession["status"][] = ["planned", "sown", "transplanted", "harvesting", "completed", "cancelled"]

function titleize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateLabel(value: string | null, locale: string) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale) : "—"
}

function estimatedSeeds(succession: Succession) {
  if (!succession.planned_plants || !succession.germination_rate_pct || !succession.seeds_per_plant) return 0
  return Math.ceil((succession.planned_plants * succession.seeds_per_plant) / (succession.germination_rate_pct / 100))
}

function weekKey(date: string) {
  const value = new Date(`${date}T12:00:00`)
  const day = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - day)
  return value.toISOString().slice(0, 10)
}

export default function OrchardGamePlanPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"

  const [plans, setPlans] = useState<GamePlan[]>([])
  const [cycles, setCycles] = useState<CropCycle[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [openSuccessionCycleId, setOpenSuccessionCycleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [planForm, setPlanForm] = useState({ name: "", season: "", start_date: "", end_date: "", objective: "", notes: "" })
  const [cycleForm, setCycleForm] = useState({ crop_name: "", variety: "", cycle_type: "direct_sow" as CropCycle["cycle_type"], planned_start_date: "", target_harvest_date: "", planned_area_sqm: "", target_quantity: "", target_unit: "kg", notes: "" })
  const [successionForm, setSuccessionForm] = useState({ planned_sow_date: "", planned_transplant_date: "", planned_first_harvest_date: "", planned_last_harvest_date: "", days_to_maturity: "", planned_plants: "", planned_area_sqm: "", plant_spacing_cm: "", row_spacing_cm: "", germination_rate_pct: "85", seeds_per_plant: "1", notes: "" })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [plansResult, cyclesResult, successionsResult] = await Promise.all([
      supabase.from("orchard_game_plans").select("id, name, season, start_date, end_date, status, objective, notes").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id, game_plan_id, crop_name, variety, cycle_type, planned_start_date, target_harvest_date, status, planned_area_sqm, target_quantity, target_unit, notes").order("planned_start_date"),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_first_harvest_date, planned_last_harvest_date, days_to_maturity, planned_plants, planned_area_sqm, plant_spacing_cm, row_spacing_cm, germination_rate_pct, seeds_per_plant, status, notes").order("planned_sow_date"),
    ])

    const loadError = plansResult.error ?? cyclesResult.error ?? successionsResult.error
    if (loadError) {
      setError(`${text.loadError}: ${loadError.message}`)
      setPlans([])
      setCycles([])
      setSuccessions([])
    } else {
      const nextPlans = (plansResult.data ?? []) as GamePlan[]
      setPlans(nextPlans)
      setCycles((cyclesResult.data ?? []) as CropCycle[])
      setSuccessions((successionsResult.data ?? []) as Succession[])
      setSelectedPlanId((current) => current && nextPlans.some((plan) => plan.id === current) ? current : nextPlans[0]?.id ?? null)
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void loadData() }, [loadData])

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null
  const selectedCycles = cycles.filter((cycle) => cycle.game_plan_id === selectedPlanId)
  const selectedCycleIds = new Set(selectedCycles.map((cycle) => cycle.id))
  const selectedSuccessions = successions.filter((succession) => selectedCycleIds.has(succession.crop_cycle_id))

  const planningEvents = useMemo<PlanningEvent[]>(() => {
    const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle]))
    return selectedSuccessions.flatMap((succession) => {
      const cycle = cycleById.get(succession.crop_cycle_id)
      if (!cycle) return []
      const base = { crop: cycle.variety ? `${cycle.crop_name} · ${cycle.variety}` : cycle.crop_name, succession: succession.sequence_no }
      const events: PlanningEvent[] = [{ ...base, date: succession.planned_sow_date, type: "sow" }]
      if (succession.planned_transplant_date) events.push({ ...base, date: succession.planned_transplant_date, type: "transplant" })
      if (succession.planned_first_harvest_date) events.push({ ...base, date: succession.planned_first_harvest_date, type: "harvest" })
      return events
    }).sort((a, b) => a.date.localeCompare(b.date))
  }, [cycles, selectedSuccessions])

  const workloadByWeek = useMemo(() => {
    const groups = new Map<string, PlanningEvent[]>()
    for (const event of planningEvents) groups.set(weekKey(event.date), [...(groups.get(weekKey(event.date)) ?? []), event])
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [planningEvents])

  const totalArea = selectedSuccessions.reduce((sum, item) => sum + (item.planned_area_sqm ?? 0), 0)
  const totalPlants = selectedSuccessions.reduce((sum, item) => sum + (item.planned_plants ?? 0), 0)
  const totalSeeds = selectedSuccessions.reduce((sum, item) => sum + estimatedSeeds(item), 0)
  const harvestWindows = selectedSuccessions.filter((item) => item.planned_first_harvest_date).length

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planForm.name || !planForm.start_date || !planForm.end_date) return
    setSaving(true); setError(null)
    const { data, error: insertError } = await supabase.from("orchard_game_plans").insert({ name: planForm.name.trim(), season: planForm.season.trim() || null, start_date: planForm.start_date, end_date: planForm.end_date, objective: planForm.objective.trim() || null, notes: planForm.notes.trim() || null }).select("id").single()
    if (insertError) setError(`${text.saveError}: ${insertError.message}`)
    else { setPlanForm({ name: "", season: "", start_date: "", end_date: "", objective: "", notes: "" }); await loadData(); if (data?.id) setSelectedPlanId(data.id as string) }
    setSaving(false)
  }

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPlanId || !cycleForm.crop_name || !cycleForm.planned_start_date) return
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from("orchard_crop_cycles").insert({ game_plan_id: selectedPlanId, crop_name: cycleForm.crop_name.trim(), variety: cycleForm.variety.trim() || null, cycle_type: cycleForm.cycle_type, planned_start_date: cycleForm.planned_start_date, target_harvest_date: cycleForm.target_harvest_date || null, planned_area_sqm: cycleForm.planned_area_sqm ? Number(cycleForm.planned_area_sqm) : null, target_quantity: cycleForm.target_quantity ? Number(cycleForm.target_quantity) : null, target_unit: cycleForm.target_unit.trim() || null, notes: cycleForm.notes.trim() || null })
    if (insertError) setError(`${text.saveError}: ${insertError.message}`)
    else { setCycleForm({ crop_name: "", variety: "", cycle_type: "direct_sow", planned_start_date: "", target_harvest_date: "", planned_area_sqm: "", target_quantity: "", target_unit: "kg", notes: "" }); await loadData() }
    setSaving(false)
  }

  async function createSuccession(event: FormEvent<HTMLFormElement>, cycleId: string) {
    event.preventDefault()
    if (!successionForm.planned_sow_date) return
    const cycleSuccessions = successions.filter((item) => item.crop_cycle_id === cycleId)
    const sequenceNo = cycleSuccessions.reduce((max, item) => Math.max(max, item.sequence_no), 0) + 1
    setSaving(true); setError(null)
    const numeric = (value: string) => value ? Number(value) : null
    const { error: insertError } = await supabase.from("orchard_crop_successions").insert({ crop_cycle_id: cycleId, sequence_no: sequenceNo, planned_sow_date: successionForm.planned_sow_date, planned_transplant_date: successionForm.planned_transplant_date || null, planned_first_harvest_date: successionForm.planned_first_harvest_date || null, planned_last_harvest_date: successionForm.planned_last_harvest_date || null, days_to_maturity: numeric(successionForm.days_to_maturity), planned_plants: numeric(successionForm.planned_plants), planned_area_sqm: numeric(successionForm.planned_area_sqm), plant_spacing_cm: numeric(successionForm.plant_spacing_cm), row_spacing_cm: numeric(successionForm.row_spacing_cm), germination_rate_pct: numeric(successionForm.germination_rate_pct), seeds_per_plant: numeric(successionForm.seeds_per_plant), notes: successionForm.notes.trim() || null })
    if (insertError) setError(`${text.saveError}: ${insertError.message}`)
    else { setSuccessionForm({ planned_sow_date: "", planned_transplant_date: "", planned_first_harvest_date: "", planned_last_harvest_date: "", days_to_maturity: "", planned_plants: "", planned_area_sqm: "", plant_spacing_cm: "", row_spacing_cm: "", germination_rate_pct: "85", seeds_per_plant: "1", notes: "" }); setOpenSuccessionCycleId(null); await loadData() }
    setSaving(false)
  }

  async function updatePlanStatus(planId: string, status: GamePlan["status"]) {
    setSaving(true); const { error: updateError } = await supabase.from("orchard_game_plans").update({ status, updated_at: new Date().toISOString() }).eq("id", planId); if (updateError) setError(`${text.saveError}: ${updateError.message}`); else await loadData(); setSaving(false)
  }

  async function updateCycleStatus(cycleId: string, status: CropCycle["status"]) {
    setSaving(true); const { error: updateError } = await supabase.from("orchard_crop_cycles").update({ status, updated_at: new Date().toISOString() }).eq("id", cycleId); if (updateError) setError(`${text.saveError}: ${updateError.message}`); else await loadData(); setSaving(false)
  }

  async function updateSuccessionStatus(successionId: string, status: Succession["status"]) {
    setSaving(true); const { error: updateError } = await supabase.from("orchard_crop_successions").update({ status, updated_at: new Date().toISOString() }).eq("id", successionId); if (updateError) setError(`${text.saveError}: ${updateError.message}`); else await loadData(); setSaving(false)
  }

  async function deletePlan(planId: string) { if (!window.confirm(text.deleteConfirmPlan)) return; setSaving(true); const { error: deleteError } = await supabase.from("orchard_game_plans").delete().eq("id", planId); if (deleteError) setError(`${text.saveError}: ${deleteError.message}`); else await loadData(); setSaving(false) }
  async function deleteCycle(cycleId: string) { if (!window.confirm(text.deleteConfirmCycle)) return; setSaving(true); const { error: deleteError } = await supabase.from("orchard_crop_cycles").delete().eq("id", cycleId); if (deleteError) setError(`${text.saveError}: ${deleteError.message}`); else await loadData(); setSaving(false) }
  async function deleteSuccession(successionId: string) { if (!window.confirm(text.deleteConfirmSuccession)) return; setSaving(true); const { error: deleteError } = await supabase.from("orchard_crop_successions").delete().eq("id", successionId); if (deleteError) setError(`${text.saveError}: ${deleteError.message}`); else await loadData(); setSaving(false) }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
      <OrchardNavigation />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <Card className="h-fit"><CardHeader><CardTitle>{text.newPlan}</CardTitle><CardDescription>{text.newPlanDescription}</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={createPlan}>
            <Field label={text.planName}><Input value={planForm.name} onChange={(e) => setPlanForm((c) => ({ ...c, name: e.target.value }))} required /></Field>
            <Field label={text.season}><Input value={planForm.season} onChange={(e) => setPlanForm((c) => ({ ...c, season: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label={text.start}><Input type="date" value={planForm.start_date} onChange={(e) => setPlanForm((c) => ({ ...c, start_date: e.target.value }))} required /></Field><Field label={text.end}><Input type="date" value={planForm.end_date} onChange={(e) => setPlanForm((c) => ({ ...c, end_date: e.target.value }))} required /></Field></div>
            <Field label={text.objective}><Textarea value={planForm.objective} onChange={(e) => setPlanForm((c) => ({ ...c, objective: e.target.value }))} /></Field>
            <Field label={text.notes}><Textarea value={planForm.notes} onChange={(e) => setPlanForm((c) => ({ ...c, notes: e.target.value }))} /></Field>
            <Button className="w-full" type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.createPlan}</Button>
          </form></CardContent></Card>

          <div className="space-y-6">
            <Card><CardHeader><CardTitle>{text.plans}</CardTitle><CardDescription>{plans.length} {text.plans.toLowerCase()}</CardDescription></CardHeader><CardContent>
              {loading ? <p className="py-8 text-center text-sm text-muted-foreground">{text.loading}</p> : plans.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{text.noPlans}</p> : <div className="grid gap-3 lg:grid-cols-2">{plans.map((plan) => { const selected = plan.id === selectedPlanId; const cycleCount = cycles.filter((cycle) => cycle.game_plan_id === plan.id).length; return <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-lg border p-4 text-left transition-colors ${selected ? "border-foreground bg-muted/40" : "hover:bg-muted/20"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plan.name}</p><p className="text-sm text-muted-foreground">{plan.season || text.activeWindow}</p></div><Badge variant="outline">{titleize(plan.status)}</Badge></div><div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>{dateLabel(plan.start_date, locale)} – {dateLabel(plan.end_date, locale)}</span><span>{text.cycleCount(cycleCount)}</span></div></button> })}</div>}
            </CardContent></Card>

            {selectedPlan && <>
              <Card><CardHeader><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" />{selectedPlan.name}</CardTitle><CardDescription>{selectedPlan.objective || text.cyclesDescription}</CardDescription></div><div className="flex flex-wrap gap-2"><Select value={selectedPlan.status} onValueChange={(value) => void updatePlanStatus(selectedPlan.id, value as GamePlan["status"])} disabled={saving}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{planStatuses.map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" onClick={() => void deletePlan(selectedPlan.id)} disabled={saving} aria-label="Delete game plan"><Trash2 className="h-4 w-4" /></Button></div></div></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.totalArea} value={`${totalArea.toFixed(1)} m²`} /><Metric label={text.plannedPlants} value={totalPlants.toLocaleString(locale)} /><Metric label={text.estimatedSeeds} value={totalSeeds.toLocaleString(locale)} /><Metric label={text.harvestWindows} value={harvestWindows.toLocaleString(locale)} /></div>
                  <div><h3 className="font-semibold">{text.cycles}</h3><p className="text-sm text-muted-foreground">{text.cyclesDescription}</p></div>
                  {selectedCycles.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center"><Sprout className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{text.noCycles}</p></div> : <div className="space-y-4">{selectedCycles.map((cycle) => {
                    const cycleSuccessions = successions.filter((item) => item.crop_cycle_id === cycle.id).sort((a, b) => a.sequence_no - b.sequence_no)
                    return <div key={cycle.id} className="rounded-lg border">
                      <div className="p-4"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{cycle.crop_name}</p>{cycle.variety && <Badge variant="secondary">{cycle.variety}</Badge>}<Badge variant="outline">{titleize(cycle.cycle_type)}</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">{dateLabel(cycle.planned_start_date, locale)}{cycle.target_harvest_date ? ` → ${dateLabel(cycle.target_harvest_date, locale)}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">{text.successionCount(cycleSuccessions.length)}{cycle.planned_area_sqm != null ? ` · ${cycle.planned_area_sqm} m²` : ""}{cycle.target_quantity != null ? ` · ${cycle.target_quantity} ${cycle.target_unit || ""}` : ""}</p></div><div className="flex flex-wrap gap-2"><Select value={cycle.status} onValueChange={(value) => void updateCycleStatus(cycle.id, value as CropCycle["status"])} disabled={saving}><SelectTrigger className="w-[155px]"><SelectValue /></SelectTrigger><SelectContent>{cycleStatuses.map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => setOpenSuccessionCycleId(openSuccessionCycleId === cycle.id ? null : cycle.id)}><Plus className="mr-2 h-4 w-4" />{text.addSuccession}</Button><Button variant="outline" size="icon" onClick={() => void deleteCycle(cycle.id)} disabled={saving} aria-label="Delete crop cycle"><Trash2 className="h-4 w-4" /></Button></div></div></div>
                      <div className="border-t bg-muted/10 p-4"><p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{text.successions}</p>{cycleSuccessions.length === 0 ? <p className="text-sm text-muted-foreground">{text.noSuccessions}</p> : <div className="space-y-2">{cycleSuccessions.map((item) => <div key={item.id} className="rounded-md border bg-background p-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-5"><div><p className="text-xs text-muted-foreground">{text.succession} #{item.sequence_no}</p><p className="font-medium">{dateLabel(item.planned_sow_date, locale)}</p></div><Mini label={text.transplantDate} value={dateLabel(item.planned_transplant_date, locale)} /><Mini label={text.firstHarvest} value={dateLabel(item.planned_first_harvest_date, locale)} /><Mini label={text.plants} value={item.planned_plants?.toLocaleString(locale) ?? "—"} /><Mini label={text.seedRequirement} value={estimatedSeeds(item).toLocaleString(locale)} /></div><div className="flex gap-2"><Select value={item.status} onValueChange={(value) => void updateSuccessionStatus(item.id, value as Succession["status"])} disabled={saving}><SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger><SelectContent>{successionStatuses.map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" onClick={() => void deleteSuccession(item.id)} disabled={saving} aria-label="Delete succession"><Trash2 className="h-4 w-4" /></Button></div></div></div>)}</div>}</div>
                      {openSuccessionCycleId === cycle.id && <div className="border-t p-4"><form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => void createSuccession(event, cycle.id)}><Field label={text.sowDate}><Input type="date" value={successionForm.planned_sow_date} onChange={(e) => setSuccessionForm((c) => ({ ...c, planned_sow_date: e.target.value }))} required /></Field><Field label={text.transplantDate}><Input type="date" value={successionForm.planned_transplant_date} onChange={(e) => setSuccessionForm((c) => ({ ...c, planned_transplant_date: e.target.value }))} /></Field><Field label={text.firstHarvest}><Input type="date" value={successionForm.planned_first_harvest_date} onChange={(e) => setSuccessionForm((c) => ({ ...c, planned_first_harvest_date: e.target.value }))} /></Field><Field label={text.lastHarvest}><Input type="date" value={successionForm.planned_last_harvest_date} onChange={(e) => setSuccessionForm((c) => ({ ...c, planned_last_harvest_date: e.target.value }))} /></Field><Field label={text.maturity}><Input type="number" min="1" value={successionForm.days_to_maturity} onChange={(e) => setSuccessionForm((c) => ({ ...c, days_to_maturity: e.target.value }))} /></Field><Field label={text.plants}><Input type="number" min="0" value={successionForm.planned_plants} onChange={(e) => setSuccessionForm((c) => ({ ...c, planned_plants: e.target.value }))} /></Field><Field label={text.area}><Input type="number" min="0" step="0.01" value={successionForm.planned_area_sqm} onChange={(e) => setSuccessionForm((c) => ({ ...c, planned_area_sqm: e.target.value }))} /></Field><Field label={text.germination}><Input type="number" min="1" max="100" step="0.1" value={successionForm.germination_rate_pct} onChange={(e) => setSuccessionForm((c) => ({ ...c, germination_rate_pct: e.target.value }))} /></Field><Field label={text.seedsPerPlant}><Input type="number" min="0.1" step="0.1" value={successionForm.seeds_per_plant} onChange={(e) => setSuccessionForm((c) => ({ ...c, seeds_per_plant: e.target.value }))} /></Field><Field label={text.plantSpacing}><Input type="number" min="0.1" step="0.1" value={successionForm.plant_spacing_cm} onChange={(e) => setSuccessionForm((c) => ({ ...c, plant_spacing_cm: e.target.value }))} /></Field><Field label={text.rowSpacing}><Input type="number" min="0.1" step="0.1" value={successionForm.row_spacing_cm} onChange={(e) => setSuccessionForm((c) => ({ ...c, row_spacing_cm: e.target.value }))} /></Field><div className="md:col-span-2 xl:col-span-4"><Field label={text.notes}><Textarea value={successionForm.notes} onChange={(e) => setSuccessionForm((c) => ({ ...c, notes: e.target.value }))} /></Field></div><div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.createSuccession}</Button></div></form></div>}
                    </div>
                  })}</div>}

                  <div className="border-t pt-6"><h3 className="mb-4 font-semibold">{text.addCycle}</h3><form className="grid gap-4 md:grid-cols-2" onSubmit={createCycle}><Field label={text.crop}><Input value={cycleForm.crop_name} onChange={(e) => setCycleForm((c) => ({ ...c, crop_name: e.target.value }))} required /></Field><Field label={text.variety}><Input value={cycleForm.variety} onChange={(e) => setCycleForm((c) => ({ ...c, variety: e.target.value }))} /></Field><Field label={text.cycleType}><Select value={cycleForm.cycle_type} onValueChange={(value) => setCycleForm((c) => ({ ...c, cycle_type: value as CropCycle["cycle_type"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cycleTypes.map((type) => <SelectItem key={type} value={type}>{titleize(type)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.start}><Input type="date" value={cycleForm.planned_start_date} onChange={(e) => setCycleForm((c) => ({ ...c, planned_start_date: e.target.value }))} required /></Field><Field label={text.targetHarvest}><Input type="date" value={cycleForm.target_harvest_date} onChange={(e) => setCycleForm((c) => ({ ...c, target_harvest_date: e.target.value }))} /></Field><Field label={text.area}><Input type="number" min="0" step="0.01" value={cycleForm.planned_area_sqm} onChange={(e) => setCycleForm((c) => ({ ...c, planned_area_sqm: e.target.value }))} /></Field><Field label={text.quantity}><Input type="number" min="0" step="0.01" value={cycleForm.target_quantity} onChange={(e) => setCycleForm((c) => ({ ...c, target_quantity: e.target.value }))} /></Field><Field label={text.unit}><Input value={cycleForm.target_unit} onChange={(e) => setCycleForm((c) => ({ ...c, target_unit: e.target.value }))} /></Field><div className="md:col-span-2"><Field label={text.notes}><Textarea value={cycleForm.notes} onChange={(e) => setCycleForm((c) => ({ ...c, notes: e.target.value }))} /></Field></div><div className="md:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.createCycle}</Button></div></form></div>
                </CardContent>
              </Card>

              <Card><CardHeader><CardTitle>{text.weeklyWorkload}</CardTitle><CardDescription>{text.weeklyWorkloadDescription}</CardDescription></CardHeader><CardContent>{workloadByWeek.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{text.noEvents}</p> : <div className="space-y-4">{workloadByWeek.map(([week, events]) => <div key={week} className="grid gap-3 border-b pb-4 last:border-0 sm:grid-cols-[170px_1fr]"><div><p className="font-medium">{dateLabel(week, locale)}</p><p className="text-xs text-muted-foreground">{text.events(events.length)}</p></div><div className="flex flex-wrap gap-2">{events.map((event, index) => <Badge key={`${event.date}-${event.crop}-${index}`} variant="secondary">{event.type === "sow" ? text.sow : event.type === "transplant" ? text.transplant : text.harvest} · {event.crop} #{event.succession} · {dateLabel(event.date, locale)}</Badge>)}</div></div>)}</div>}</CardContent></Card>
            </>}
            {!selectedPlan && !loading && plans.length > 0 && <p className="text-sm text-muted-foreground">{text.selectPlan}</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div> }
function Mini({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div> }

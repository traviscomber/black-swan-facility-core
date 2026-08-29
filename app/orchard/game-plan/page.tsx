"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
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

const copy = {
  en: {
    title: "Game Plan",
    description: "Plan crop cycles before planting and carry each cycle into field execution.",
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
    cyclesDescription: "Each cycle is a planned crop journey that can later connect to beds, nursery, tasks, care, and harvest.",
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
    deleteConfirmPlan: "Delete this game plan and all of its crop cycles?",
    deleteConfirmCycle: "Delete this crop cycle?",
    status: "Status",
    activeWindow: "Operating window",
    refresh: "Refresh",
  },
  es: {
    title: "Plan de Cultivo",
    description: "Planifica ciclos antes de sembrar y lleva cada ciclo hasta la ejecución en terreno.",
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
    cyclesDescription: "Cada ciclo representa un cultivo planificado que luego podrá conectarse con camas, almácigos, tareas, cuidados y cosecha.",
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
    deleteConfirmPlan: "¿Eliminar este plan y todos sus ciclos de cultivo?",
    deleteConfirmCycle: "¿Eliminar este ciclo de cultivo?",
    status: "Estado",
    activeWindow: "Ventana operativa",
    refresh: "Actualizar",
  },
} as const

const planStatuses: GamePlan["status"][] = ["draft", "active", "completed", "archived"]
const cycleStatuses: CropCycle["status"][] = ["planned", "nursery", "planted", "growing", "harvest_ready", "completed", "cancelled"]
const cycleTypes: CropCycle["cycle_type"][] = ["direct_sow", "transplant", "perennial", "cover_crop"]

function titleize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function OrchardGamePlanPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"

  const [plans, setPlans] = useState<GamePlan[]>([])
  const [cycles, setCycles] = useState<CropCycle[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [planForm, setPlanForm] = useState({ name: "", season: "", start_date: "", end_date: "", objective: "", notes: "" })
  const [cycleForm, setCycleForm] = useState({ crop_name: "", variety: "", cycle_type: "direct_sow" as CropCycle["cycle_type"], planned_start_date: "", target_harvest_date: "", planned_area_sqm: "", target_quantity: "", target_unit: "kg", notes: "" })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [plansResult, cyclesResult] = await Promise.all([
      supabase.from("orchard_game_plans").select("id, name, season, start_date, end_date, status, objective, notes").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id, game_plan_id, crop_name, variety, cycle_type, planned_start_date, target_harvest_date, status, planned_area_sqm, target_quantity, target_unit, notes").order("planned_start_date"),
    ])

    const loadError = plansResult.error ?? cyclesResult.error
    if (loadError) {
      setError(`${text.loadError}: ${loadError.message}`)
      setPlans([])
      setCycles([])
    } else {
      const nextPlans = (plansResult.data ?? []) as GamePlan[]
      setPlans(nextPlans)
      setCycles((cyclesResult.data ?? []) as CropCycle[])
      setSelectedPlanId((current) => current && nextPlans.some((plan) => plan.id === current) ? current : nextPlans[0]?.id ?? null)
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void loadData() }, [loadData])

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null
  const selectedCycles = cycles.filter((cycle) => cycle.game_plan_id === selectedPlanId)

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planForm.name || !planForm.start_date || !planForm.end_date) return
    setSaving(true)
    setError(null)
    const { data, error: insertError } = await supabase.from("orchard_game_plans").insert({
      name: planForm.name.trim(),
      season: planForm.season.trim() || null,
      start_date: planForm.start_date,
      end_date: planForm.end_date,
      objective: planForm.objective.trim() || null,
      notes: planForm.notes.trim() || null,
    }).select("id").single()

    if (insertError) setError(`${text.saveError}: ${insertError.message}`)
    else {
      setPlanForm({ name: "", season: "", start_date: "", end_date: "", objective: "", notes: "" })
      await loadData()
      if (data?.id) setSelectedPlanId(data.id as string)
    }
    setSaving(false)
  }

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPlanId || !cycleForm.crop_name || !cycleForm.planned_start_date) return
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from("orchard_crop_cycles").insert({
      game_plan_id: selectedPlanId,
      crop_name: cycleForm.crop_name.trim(),
      variety: cycleForm.variety.trim() || null,
      cycle_type: cycleForm.cycle_type,
      planned_start_date: cycleForm.planned_start_date,
      target_harvest_date: cycleForm.target_harvest_date || null,
      planned_area_sqm: cycleForm.planned_area_sqm ? Number(cycleForm.planned_area_sqm) : null,
      target_quantity: cycleForm.target_quantity ? Number(cycleForm.target_quantity) : null,
      target_unit: cycleForm.target_unit.trim() || null,
      notes: cycleForm.notes.trim() || null,
    })

    if (insertError) setError(`${text.saveError}: ${insertError.message}`)
    else {
      setCycleForm({ crop_name: "", variety: "", cycle_type: "direct_sow", planned_start_date: "", target_harvest_date: "", planned_area_sqm: "", target_quantity: "", target_unit: "kg", notes: "" })
      await loadData()
    }
    setSaving(false)
  }

  async function updatePlanStatus(planId: string, status: GamePlan["status"]) {
    setSaving(true)
    const { error: updateError } = await supabase.from("orchard_game_plans").update({ status, updated_at: new Date().toISOString() }).eq("id", planId)
    if (updateError) setError(`${text.saveError}: ${updateError.message}`)
    else await loadData()
    setSaving(false)
  }

  async function updateCycleStatus(cycleId: string, status: CropCycle["status"]) {
    setSaving(true)
    const { error: updateError } = await supabase.from("orchard_crop_cycles").update({ status, updated_at: new Date().toISOString() }).eq("id", cycleId)
    if (updateError) setError(`${text.saveError}: ${updateError.message}`)
    else await loadData()
    setSaving(false)
  }

  async function deletePlan(planId: string) {
    if (!window.confirm(text.deleteConfirmPlan)) return
    setSaving(true)
    const { error: deleteError } = await supabase.from("orchard_game_plans").delete().eq("id", planId)
    if (deleteError) setError(`${text.saveError}: ${deleteError.message}`)
    else await loadData()
    setSaving(false)
  }

  async function deleteCycle(cycleId: string) {
    if (!window.confirm(text.deleteConfirmCycle)) return
    setSaving(true)
    const { error: deleteError } = await supabase.from("orchard_crop_cycles").delete().eq("id", cycleId)
    if (deleteError) setError(`${text.saveError}: ${deleteError.message}`)
    else await loadData()
    setSaving(false)
  }

  return (
    <AppLayout>
      <PageHeader
        title={text.title}
        description={text.description}
        actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>}
      />
      <OrchardNavigation />

      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{text.newPlan}</CardTitle>
              <CardDescription>{text.newPlanDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createPlan}>
                <Field label={text.planName}><Input value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} required /></Field>
                <Field label={text.season}><Input value={planForm.season} onChange={(event) => setPlanForm((current) => ({ ...current, season: event.target.value }))} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={text.start}><Input type="date" value={planForm.start_date} onChange={(event) => setPlanForm((current) => ({ ...current, start_date: event.target.value }))} required /></Field>
                  <Field label={text.end}><Input type="date" value={planForm.end_date} onChange={(event) => setPlanForm((current) => ({ ...current, end_date: event.target.value }))} required /></Field>
                </div>
                <Field label={text.objective}><Textarea value={planForm.objective} onChange={(event) => setPlanForm((current) => ({ ...current, objective: event.target.value }))} /></Field>
                <Field label={text.notes}><Textarea value={planForm.notes} onChange={(event) => setPlanForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
                <Button className="w-full" type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.createPlan}</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{text.plans}</CardTitle>
                <CardDescription>{plans.length} {text.plans.toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : plans.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{text.noPlans}</p> : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {plans.map((plan) => {
                      const selected = plan.id === selectedPlanId
                      const cycleCount = cycles.filter((cycle) => cycle.game_plan_id === plan.id).length
                      return (
                        <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-lg border p-4 text-left transition-colors ${selected ? "border-foreground bg-muted/40" : "hover:bg-muted/20"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{plan.name}</p>
                              <p className="text-sm text-muted-foreground">{plan.season || text.activeWindow}</p>
                            </div>
                            <Badge variant="outline">{titleize(plan.status)}</Badge>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                            <span>{new Date(`${plan.start_date}T12:00:00`).toLocaleDateString(locale)} – {new Date(`${plan.end_date}T12:00:00`).toLocaleDateString(locale)}</span>
                            <span>{cycleCount} cycles</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedPlan && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" />{selectedPlan.name}</CardTitle>
                      <CardDescription>{selectedPlan.objective || text.cyclesDescription}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Select value={selectedPlan.status} onValueChange={(value) => void updatePlanStatus(selectedPlan.id, value as GamePlan["status"])} disabled={saving}>
                        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{planStatuses.map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => void deletePlan(selectedPlan.id)} disabled={saving} aria-label="Delete game plan"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold">{text.cycles}</h3>
                    <p className="text-sm text-muted-foreground">{text.cyclesDescription}</p>
                  </div>

                  {selectedCycles.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center"><Sprout className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{text.noCycles}</p></div> : (
                    <div className="space-y-3">
                      {selectedCycles.map((cycle) => (
                        <div key={cycle.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{cycle.crop_name}</p>{cycle.variety && <Badge variant="secondary">{cycle.variety}</Badge>}<Badge variant="outline">{titleize(cycle.cycle_type)}</Badge></div>
                              <p className="mt-2 text-sm text-muted-foreground">{new Date(`${cycle.planned_start_date}T12:00:00`).toLocaleDateString(locale)}{cycle.target_harvest_date ? ` → ${new Date(`${cycle.target_harvest_date}T12:00:00`).toLocaleDateString(locale)}` : ""}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{cycle.planned_area_sqm != null ? `${cycle.planned_area_sqm} m²` : ""}{cycle.planned_area_sqm != null && cycle.target_quantity != null ? " · " : ""}{cycle.target_quantity != null ? `${cycle.target_quantity} ${cycle.target_unit || ""}` : ""}</p>
                            </div>
                            <div className="flex gap-2">
                              <Select value={cycle.status} onValueChange={(value) => void updateCycleStatus(cycle.id, value as CropCycle["status"])} disabled={saving}>
                                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                                <SelectContent>{cycleStatuses.map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button variant="outline" size="icon" onClick={() => void deleteCycle(cycle.id)} disabled={saving} aria-label="Delete crop cycle"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t pt-6">
                    <h3 className="mb-4 font-semibold">{text.addCycle}</h3>
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={createCycle}>
                      <Field label={text.crop}><Input value={cycleForm.crop_name} onChange={(event) => setCycleForm((current) => ({ ...current, crop_name: event.target.value }))} required /></Field>
                      <Field label={text.variety}><Input value={cycleForm.variety} onChange={(event) => setCycleForm((current) => ({ ...current, variety: event.target.value }))} /></Field>
                      <Field label={text.cycleType}>
                        <Select value={cycleForm.cycle_type} onValueChange={(value) => setCycleForm((current) => ({ ...current, cycle_type: value as CropCycle["cycle_type"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cycleTypes.map((type) => <SelectItem key={type} value={type}>{titleize(type)}</SelectItem>)}</SelectContent></Select>
                      </Field>
                      <Field label={text.start}><Input type="date" value={cycleForm.planned_start_date} onChange={(event) => setCycleForm((current) => ({ ...current, planned_start_date: event.target.value }))} required /></Field>
                      <Field label={text.targetHarvest}><Input type="date" value={cycleForm.target_harvest_date} onChange={(event) => setCycleForm((current) => ({ ...current, target_harvest_date: event.target.value }))} /></Field>
                      <Field label={text.area}><Input type="number" min="0" step="0.01" value={cycleForm.planned_area_sqm} onChange={(event) => setCycleForm((current) => ({ ...current, planned_area_sqm: event.target.value }))} /></Field>
                      <Field label={text.quantity}><Input type="number" min="0" step="0.01" value={cycleForm.target_quantity} onChange={(event) => setCycleForm((current) => ({ ...current, target_quantity: event.target.value }))} /></Field>
                      <Field label={text.unit}><Input value={cycleForm.target_unit} onChange={(event) => setCycleForm((current) => ({ ...current, target_unit: event.target.value }))} /></Field>
                      <div className="md:col-span-2"><Field label={text.notes}><Textarea value={cycleForm.notes} onChange={(event) => setCycleForm((current) => ({ ...current, notes: event.target.value }))} /></Field></div>
                      <div className="md:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.createCycle}</Button></div>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedPlan && !loading && plans.length > 0 && <p className="text-sm text-muted-foreground">{text.selectPlan}</p>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

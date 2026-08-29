"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Crop = { id: string; plot_id: string; crop_succession_id: string | null; crop_name: string; crop_type: string; variety: string | null; planting_date: string; expected_harvest_date: string | null; actual_harvest_date: string | null; quantity_planted: number | null; planting_unit: string | null; status: string; estimated_yield: number | null; actual_yield: number | null; yield_unit: string | null; spacing_cm: number | null; depth_cm: number | null; water_frequency: string | null; fertilizer_schedule: string | null; notes: string | null }
type Plot = { id: string; name: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_first_harvest_date: string | null; planned_plants: number | null; plant_spacing_cm: number | null }
type Cycle = { id: string; crop_name: string; variety: string | null; cycle_type: string }
type Allocation = { crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }

const statuses = ["seedling", "growing", "mature", "harvested", "failed"]
const copy = {
  en: { title: "Crops", description: "Create live field crops from planned successions so care, health and harvest preserve the planning lineage.", newCrop: "Create live crop", succession: "Planned succession", manual: "Manual / unplanned crop", plot: "Plot", crop: "Crop", type: "Crop type", variety: "Variety", planted: "Planting date", harvest: "Expected harvest", quantity: "Quantity planted", unit: "Unit", spacing: "Spacing (cm)", depth: "Depth (cm)", water: "Water frequency", yield: "Estimated yield", yieldUnit: "Yield unit", fertilizer: "Fertilizer schedule", notes: "Notes", create: "Create crop", refresh: "Refresh", loading: "Loading…", empty: "No operational crops yet.", saveError: "Could not save crop", delete: "Delete this crop and its related logs?", actualYield: "Actual yield", actualHarvest: "Actual harvest", lineage: "Planning lineage" },
  es: { title: "Cultivos", description: "Crea cultivos vivos desde sucesiones planificadas para que cuidados, sanidad y cosecha conserven la trazabilidad del plan.", newCrop: "Crear cultivo vivo", succession: "Sucesión planificada", manual: "Cultivo manual / no planificado", plot: "Sector", crop: "Cultivo", type: "Tipo", variety: "Variedad", planted: "Fecha de plantación", harvest: "Cosecha esperada", quantity: "Cantidad plantada", unit: "Unidad", spacing: "Distancia (cm)", depth: "Profundidad (cm)", water: "Frecuencia de riego", yield: "Rendimiento estimado", yieldUnit: "Unidad rendimiento", fertilizer: "Plan de fertilización", notes: "Notas", create: "Crear cultivo", refresh: "Actualizar", loading: "Cargando…", empty: "Aún no hay cultivos operativos.", saveError: "No fue posible guardar el cultivo", delete: "¿Eliminar este cultivo y sus registros relacionados?", actualYield: "Rendimiento real", actualHarvest: "Cosecha real", lineage: "Trazabilidad del plan" },
} as const

export default function OrchardCropsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const [crops, setCrops] = useState<Crop[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ crop_succession_id: "none", plot_id: "", crop_name: "", crop_type: "vegetable", variety: "", planting_date: "", expected_harvest_date: "", quantity_planted: "", planting_unit: "plants", spacing_cm: "", depth_cm: "", water_frequency: "", estimated_yield: "", yield_unit: "kg", fertilizer_schedule: "", notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    const [c, p, s, cy, a, b] = await Promise.all([
      supabase.from("orchard_crops").select("id,plot_id,crop_succession_id,crop_name,crop_type,variety,planting_date,expected_harvest_date,actual_harvest_date,quantity_planted,planting_unit,status,estimated_yield,actual_yield,yield_unit,spacing_cm,depth_cm,water_frequency,fertilizer_schedule,notes").order("planting_date", { ascending: false }),
      supabase.from("orchard_plots").select("id,name").order("name"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no,planned_sow_date,planned_transplant_date,planned_first_harvest_date,planned_plants,plant_spacing_cm").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id,crop_name,variety,cycle_type"),
      supabase.from("orchard_bed_allocations").select("crop_succession_id,bed_id"),
      supabase.from("orchard_beds").select("id,plot_id,name"),
    ])
    const queryError = c.error ?? p.error ?? s.error ?? cy.error ?? a.error ?? b.error
    if (queryError) setError(queryError.message)
    else { setCrops((c.data ?? []) as Crop[]); setPlots((p.data ?? []) as Plot[]); setSuccessions((s.data ?? []) as Succession[]); setCycles((cy.data ?? []) as Cycle[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]) }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])
  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds])
  const successionLabel = (id: string) => { const succession = successionById.get(id); const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null; return succession && cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${succession.sequence_no}` : id }

  function chooseSuccession(id: string) {
    if (id === "none") { setForm((current) => ({ ...current, crop_succession_id: "none" })); return }
    const succession = successionById.get(id)
    const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null
    const allocation = allocations.find((item) => item.crop_succession_id === id)
    const bed = allocation ? bedById.get(allocation.bed_id) : null
    setForm((current) => ({
      ...current,
      crop_succession_id: id,
      plot_id: bed?.plot_id ?? current.plot_id,
      crop_name: cycle?.crop_name ?? current.crop_name,
      variety: cycle?.variety ?? current.variety,
      crop_type: cycle?.cycle_type ?? current.crop_type,
      planting_date: succession?.planned_transplant_date || succession?.planned_sow_date || current.planting_date,
      expected_harvest_date: succession?.planned_first_harvest_date ?? current.expected_harvest_date,
      quantity_planted: succession?.planned_plants?.toString() ?? current.quantity_planted,
      spacing_cm: succession?.plant_spacing_cm?.toString() ?? current.spacing_cm,
    }))
  }

  async function createCrop(event: FormEvent) {
    event.preventDefault()
    if (!form.plot_id || !form.crop_name || !form.crop_type || !form.planting_date) return
    const numberOrNull = (value: string) => value ? Number(value) : null
    setSaving(true)
    const result = await supabase.from("orchard_crops").insert({ crop_succession_id: form.crop_succession_id === "none" ? null : form.crop_succession_id, plot_id: form.plot_id, crop_name: form.crop_name.trim(), crop_type: form.crop_type.trim(), variety: form.variety.trim() || null, planting_date: form.planting_date, expected_harvest_date: form.expected_harvest_date || null, quantity_planted: numberOrNull(form.quantity_planted), planting_unit: form.planting_unit || null, spacing_cm: numberOrNull(form.spacing_cm), depth_cm: numberOrNull(form.depth_cm), water_frequency: form.water_frequency.trim() || null, estimated_yield: numberOrNull(form.estimated_yield), yield_unit: form.yield_unit || null, fertilizer_schedule: form.fertilizer_schedule.trim() || null, notes: form.notes.trim() || null })
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else { setForm({ crop_succession_id: "none", plot_id: "", crop_name: "", crop_type: "vegetable", variety: "", planting_date: "", expected_harvest_date: "", quantity_planted: "", planting_unit: "plants", spacing_cm: "", depth_cm: "", water_frequency: "", estimated_yield: "", yield_unit: "kg", fertilizer_schedule: "", notes: "" }); await load() }
    setSaving(false)
  }

  async function updateCrop(crop: Crop, changes: Partial<Crop>) { setSaving(true); const result = await supabase.from("orchard_crops").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", crop.id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false) }
  async function remove(id: string) { if (!window.confirm(text.delete)) return; setSaving(true); const result = await supabase.from("orchard_crops").delete().eq("id", id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false) }

  return <AppLayout><PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} /><OrchardNavigation /><div className="space-y-6 p-4 sm:p-8">
    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    <Card><CardHeader><CardTitle>{text.newCrop}</CardTitle></CardHeader><CardContent><form onSubmit={createCrop} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="md:col-span-2"><Field label={text.succession}><Select value={form.crop_succession_id} onValueChange={chooseSuccession}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.manual}</SelectItem>{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item.id)}</SelectItem>)}</SelectContent></Select></Field></div>
      <Field label={text.plot}><Select value={form.plot_id} onValueChange={(value) => setForm((current) => ({ ...current, plot_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{plots.map((plot) => <SelectItem key={plot.id} value={plot.id}>{plot.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.crop}><Input value={form.crop_name} onChange={(event) => setForm((current) => ({ ...current, crop_name: event.target.value }))} required /></Field>
      <Field label={text.type}><Input value={form.crop_type} onChange={(event) => setForm((current) => ({ ...current, crop_type: event.target.value }))} required /></Field><Field label={text.variety}><Input value={form.variety} onChange={(event) => setForm((current) => ({ ...current, variety: event.target.value }))} /></Field><Field label={text.planted}><Input type="date" value={form.planting_date} onChange={(event) => setForm((current) => ({ ...current, planting_date: event.target.value }))} required /></Field><Field label={text.harvest}><Input type="date" value={form.expected_harvest_date} onChange={(event) => setForm((current) => ({ ...current, expected_harvest_date: event.target.value }))} /></Field><Field label={text.quantity}><Input type="number" min="0" value={form.quantity_planted} onChange={(event) => setForm((current) => ({ ...current, quantity_planted: event.target.value }))} /></Field><Field label={text.unit}><Input value={form.planting_unit} onChange={(event) => setForm((current) => ({ ...current, planting_unit: event.target.value }))} /></Field><Field label={text.spacing}><Input type="number" min="0" step="0.1" value={form.spacing_cm} onChange={(event) => setForm((current) => ({ ...current, spacing_cm: event.target.value }))} /></Field><Field label={text.depth}><Input type="number" min="0" step="0.1" value={form.depth_cm} onChange={(event) => setForm((current) => ({ ...current, depth_cm: event.target.value }))} /></Field><Field label={text.water}><Input value={form.water_frequency} onChange={(event) => setForm((current) => ({ ...current, water_frequency: event.target.value }))} /></Field><Field label={text.yield}><Input type="number" min="0" step="0.1" value={form.estimated_yield} onChange={(event) => setForm((current) => ({ ...current, estimated_yield: event.target.value }))} /></Field><Field label={text.yieldUnit}><Input value={form.yield_unit} onChange={(event) => setForm((current) => ({ ...current, yield_unit: event.target.value }))} /></Field><div className="md:col-span-2"><Field label={text.fertilizer}><Textarea value={form.fertilizer_schedule} onChange={(event) => setForm((current) => ({ ...current, fertilizer_schedule: event.target.value }))} /></Field></div><div className="md:col-span-2"><Field label={text.notes}><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field></div><div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving || plots.length === 0}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>{text.title}</CardTitle></CardHeader><CardContent>{loading ? <p>{text.loading}</p> : crops.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> : <div className="space-y-3">{crops.map((crop) => <div key={crop.id} className="rounded-lg border p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap gap-2"><p className="font-semibold">{crop.crop_name}{crop.variety ? ` · ${crop.variety}` : ""}</p><Badge variant="outline">{plots.find((plot) => plot.id === crop.plot_id)?.name ?? "—"}</Badge>{crop.crop_succession_id && <Badge variant="secondary"><Link2 className="mr-1 h-3 w-3" />{successionLabel(crop.crop_succession_id)}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{crop.planting_date}{crop.expected_harvest_date ? ` → ${crop.expected_harvest_date}` : ""} · {crop.quantity_planted ?? "—"} {crop.planting_unit ?? ""}</p></div><div className="flex gap-2"><Select value={crop.status} onValueChange={(value) => void updateCrop(crop, { status: value })}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" onClick={() => void remove(crop.id)}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"><Field label={text.actualHarvest}><Input type="date" defaultValue={crop.actual_harvest_date ?? ""} onBlur={(event) => void updateCrop(crop, { actual_harvest_date: event.target.value || null })} /></Field><Field label={text.actualYield}><Input type="number" min="0" step="0.1" defaultValue={crop.actual_yield ?? ""} onBlur={(event) => void updateCrop(crop, { actual_yield: event.target.value ? Number(event.target.value) : null })} /></Field><div className="lg:col-span-2"><Field label={text.notes}><Textarea defaultValue={crop.notes ?? ""} onBlur={(event) => void updateCrop(crop, { notes: event.target.value || null })} /></Field></div></div></div>)}</div>}</CardContent></Card>
  </div></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }

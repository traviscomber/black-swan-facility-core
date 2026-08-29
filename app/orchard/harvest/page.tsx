"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Link2, Plus, RefreshCw, Trash2 } from "lucide-react"
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

type Harvest = { id: string; crop_id: string; crop_succession_id: string | null; bed_allocation_id: string | null; harvest_lot_code: string | null; harvest_date: string; quantity_harvested: number | null; harvest_unit: string | null; quality_rating: number | null; storage_method: string | null; storage_location: string | null; shelf_life_days: number | null; market_value_per_unit: number | null; total_market_value: number | null; notes: string | null }
type Crop = { id: string; plot_id: string; crop_name: string; variety: string | null; crop_succession_id: string | null; yield_unit: string | null; estimated_yield: number | null; actual_yield: number | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_first_harvest_date: string | null; planned_last_harvest_date: string | null; planned_area_sqm: number | null }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Allocation = { id: string; crop_succession_id: string; bed_id: string; allocated_area_sqm: number | null }
type Bed = { id: string; plot_id: string; name: string; area_sqm: number | null; length_m: number | null; width_m: number | null }
type Plot = { id: string; name: string }

const copy = {
  en: {
    title: "Harvest Performance", description: "Record traceable harvest passes and compare yield, timing and bed productivity from canonical Orchard data.", new: "Record harvest pass", crop: "Crop", succession: "Planned succession", allocation: "Bed allocation", lot: "Harvest lot / reference", date: "Harvest date", quantity: "Quantity", unit: "Unit", quality: "Quality 1–5", storageMethod: "Storage method", storageLocation: "Storage location", shelf: "Shelf life (days)", valueUnit: "Value per unit", notes: "Notes", create: "Record harvest", refresh: "Refresh", records: "Harvest passes", empty: "No harvests recorded yet.", loadError: "Could not load harvest data", saveError: "Could not record harvest", delete: "Delete this harvest record?", trace: "Trace", passes: "Harvest passes", qualityAvg: "Average quality", value: "Recorded value", noSuccession: "No linked succession", noBed: "No linked bed", output: "Recorded output", performance: "Succession performance", performanceHelp: "Expected-vs-actual timing and yield are shown only when the underlying units are comparable.", firstHarvest: "First harvest", plannedFirst: "Planned first", yieldVsPlan: "Yield vs estimate", productivity: "Bed productivity", area: "Area", perSqm: "per m²", unitsMixed: "Mixed units", variety: "Variety performance", bed: "Bed performance", noPerformance: "No linked harvest performance yet.", early: "early", late: "late", onTime: "on time", actual: "actual", expected: "expected" },
  es: {
    title: "Rendimiento de Cosecha", description: "Registra pasadas de cosecha trazables y compara rendimiento, fechas y productividad por cama usando datos canónicos de Orchard.", new: "Registrar pasada de cosecha", crop: "Cultivo", succession: "Sucesión planificada", allocation: "Asignación de cama", lot: "Lote / referencia", date: "Fecha de cosecha", quantity: "Cantidad", unit: "Unidad", quality: "Calidad 1–5", storageMethod: "Método de almacenamiento", storageLocation: "Ubicación de almacenamiento", shelf: "Vida útil (días)", valueUnit: "Valor por unidad", notes: "Notas", create: "Registrar cosecha", refresh: "Actualizar", records: "Pasadas de cosecha", empty: "Aún no hay cosechas registradas.", loadError: "No fue posible cargar las cosechas", saveError: "No fue posible registrar la cosecha", delete: "¿Eliminar este registro de cosecha?", trace: "Traza", passes: "Pasadas de cosecha", qualityAvg: "Calidad promedio", value: "Valor registrado", noSuccession: "Sin sucesión vinculada", noBed: "Sin cama vinculada", output: "Producción registrada", performance: "Rendimiento por sucesión", performanceHelp: "La comparación esperado-vs-real se muestra solo cuando las unidades subyacentes son comparables.", firstHarvest: "Primera cosecha", plannedFirst: "Primera planificada", yieldVsPlan: "Rendimiento vs estimado", productivity: "Productividad de cama", area: "Área", perSqm: "por m²", unitsMixed: "Unidades mixtas", variety: "Rendimiento por variedad", bed: "Rendimiento por cama", noPerformance: "Aún no hay rendimiento de cosecha vinculado.", early: "adelantado", late: "atrasado", onTime: "a tiempo", actual: "real", expected: "esperado" },
} as const

const dateLabel = (value: string | null, locale: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale) : "—"
const dayDiff = (planned: string | null, actual: string | null) => planned && actual ? Math.round((new Date(`${actual}T12:00:00`).getTime() - new Date(`${planned}T12:00:00`).getTime()) / 86400000) : null
const displayNumber = (value: number, locale: string, maximumFractionDigits = 2) => value.toLocaleString(locale, { maximumFractionDigits })

export default function OrchardHarvestPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const lang = language === "es" ? "es" : "en"; const text = copy[lang]; const locale = lang === "es" ? "es-CL" : "en-US"
  const [harvests, setHarvests] = useState<Harvest[]>([]); const [crops, setCrops] = useState<Crop[]>([]); const [successions, setSuccessions] = useState<Succession[]>([]); const [cycles, setCycles] = useState<Cycle[]>([]); const [allocations, setAllocations] = useState<Allocation[]>([]); const [beds, setBeds] = useState<Bed[]>([]); const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ crop_id: "", crop_succession_id: "none", bed_allocation_id: "none", harvest_lot_code: "", harvest_date: "", quantity_harvested: "", harvest_unit: "kg", quality_rating: "", storage_method: "", storage_location: "", shelf_life_days: "", market_value_per_unit: "", notes: "" })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [h, c, s, cy, a, b, p] = await Promise.all([
      supabase.from("orchard_harvest_records").select("id, crop_id, crop_succession_id, bed_allocation_id, harvest_lot_code, harvest_date, quantity_harvested, harvest_unit, quality_rating, storage_method, storage_location, shelf_life_days, market_value_per_unit, total_market_value, notes").order("harvest_date", { ascending: false }),
      supabase.from("orchard_crops").select("id, plot_id, crop_name, variety, crop_succession_id, yield_unit, estimated_yield, actual_yield").order("crop_name"),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_first_harvest_date, planned_last_harvest_date, planned_area_sqm"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety"),
      supabase.from("orchard_bed_allocations").select("id, crop_succession_id, bed_id, allocated_area_sqm"),
      supabase.from("orchard_beds").select("id, plot_id, name, area_sqm, length_m, width_m"),
      supabase.from("orchard_plots").select("id, name"),
    ])
    const e = h.error ?? c.error ?? s.error ?? cy.error ?? a.error ?? b.error ?? p.error
    if (e) setError(`${text.loadError}: ${e.message}`)
    else { setHarvests((h.data ?? []) as Harvest[]); setCrops((c.data ?? []) as Crop[]); setSuccessions((s.data ?? []) as Succession[]); setCycles((cy.data ?? []) as Cycle[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setPlots((p.data ?? []) as Plot[]) }
    setLoading(false)
  }, [supabase, text.loadError])
  useEffect(() => { void load() }, [load])

  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles]); const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions]); const allocationById = useMemo(() => new Map(allocations.map((item) => [item.id, item])), [allocations]); const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds]); const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots]); const cropById = useMemo(() => new Map(crops.map((item) => [item.id, item])), [crops])
  const successionLabel = (id: string | null) => { if (!id) return text.noSuccession; const item = successionById.get(id); const cycle = item ? cycleById.get(item.crop_cycle_id) : null; return item && cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` : text.noSuccession }
  const cropLabel = (crop: Crop) => `${crop.crop_name}${crop.variety ? ` · ${crop.variety}` : ""}`
  const bedLabel = (allocationId: string | null) => { if (!allocationId) return text.noBed; const allocation = allocationById.get(allocationId); const bed = allocation ? bedById.get(allocation.bed_id) : null; const plot = bed ? plotById.get(bed.plot_id) : null; return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : text.noBed }
  const bedArea = (allocationId: string | null) => { if (!allocationId) return null; const allocation = allocationById.get(allocationId); const bed = allocation ? bedById.get(allocation.bed_id) : null; const fallback = bed ? (bed.area_sqm ?? ((bed.length_m ?? 0) * (bed.width_m ?? 0))) : 0; return allocation?.allocated_area_sqm ?? (fallback > 0 ? fallback : null) }
  const selectedSuccessionAllocations = allocations.filter((item) => form.crop_succession_id !== "none" && item.crop_succession_id === form.crop_succession_id)

  const outputByUnit = useMemo(() => harvests.reduce<Record<string, number>>((acc, item) => { const unit = item.harvest_unit?.trim() || "unit"; acc[unit] = (acc[unit] ?? 0) + (item.quantity_harvested ?? 0); return acc }, {}), [harvests])
  const outputLabel = Object.entries(outputByUnit).length ? Object.entries(outputByUnit).map(([unit, qty]) => `${displayNumber(qty, locale)} ${unit}`).join(" · ") : "—"
  const qualityRows = harvests.filter((item) => item.quality_rating != null); const quality = qualityRows.length ? qualityRows.reduce((sum, item) => sum + (item.quality_rating ?? 0), 0) / qualityRows.length : 0; const value = harvests.reduce((sum, item) => sum + (item.total_market_value ?? 0), 0)

  const successionPerformance = useMemo(() => successions.map((succession) => {
    const linkedCrops = crops.filter((crop) => crop.crop_succession_id === succession.id)
    const rows = harvests.filter((item) => item.crop_succession_id === succession.id || linkedCrops.some((crop) => crop.id === item.crop_id))
    if (!rows.length) return null
    const sorted = [...rows].sort((a, b) => a.harvest_date.localeCompare(b.harvest_date))
    const first = sorted[0]?.harvest_date ?? null
    const timing = dayDiff(succession.planned_first_harvest_date, first)
    const units = [...new Set(rows.map((item) => item.harvest_unit?.trim() || "unit"))]
    const unit = units.length === 1 ? units[0] : null
    const actualYield = unit ? rows.reduce((sum, item) => sum + (item.quantity_harvested ?? 0), 0) : null
    const compatibleEstimate = unit ? linkedCrops.filter((crop) => (crop.yield_unit?.trim() || "unit") === unit && crop.estimated_yield != null).reduce((sum, crop) => sum + (crop.estimated_yield ?? 0), 0) : null
    const hasEstimate = compatibleEstimate != null && linkedCrops.some((crop) => (crop.yield_unit?.trim() || "unit") === unit && crop.estimated_yield != null)
    const areaCandidates = allocations.filter((item) => item.crop_succession_id === succession.id).map((item) => item.allocated_area_sqm ?? bedArea(item.id) ?? 0).filter((value) => value > 0)
    const area = areaCandidates.length ? areaCandidates.reduce((sum, value) => sum + value, 0) : succession.planned_area_sqm
    const productivity = unit && actualYield != null && area && area > 0 ? actualYield / area : null
    return { succession, rows, first, timing, units, unit, actualYield, expectedYield: hasEstimate ? compatibleEstimate : null, area, productivity }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)), [successions, crops, harvests, allocations, bedById, allocationById])

  const varietyRows = useMemo(() => {
    const groups = new Map<string, { label: string; unit: string; quantity: number; passes: number }>()
    harvests.forEach((item) => { const crop = cropById.get(item.crop_id); if (!crop) return; const unit = item.harvest_unit?.trim() || "unit"; const label = cropLabel(crop); const key = `${label}|${unit}`; const current = groups.get(key) ?? { label, unit, quantity: 0, passes: 0 }; current.quantity += item.quantity_harvested ?? 0; current.passes += 1; groups.set(key, current) })
    return [...groups.values()].sort((a, b) => b.quantity - a.quantity)
  }, [harvests, cropById])

  const bedRows = useMemo(() => {
    const groups = new Map<string, { label: string; unit: string; quantity: number; passes: number; area: number | null }>()
    harvests.filter((item) => item.bed_allocation_id).forEach((item) => { const allocationId = item.bed_allocation_id as string; const unit = item.harvest_unit?.trim() || "unit"; const label = bedLabel(allocationId); const key = `${allocationId}|${unit}`; const current = groups.get(key) ?? { label, unit, quantity: 0, passes: 0, area: bedArea(allocationId) }; current.quantity += item.quantity_harvested ?? 0; current.passes += 1; groups.set(key, current) })
    return [...groups.values()].sort((a, b) => (b.area && b.quantity / b.area) ? (b.quantity / b.area) - (a.area ? a.quantity / a.area : 0) : b.quantity - a.quantity)
  }, [harvests, allocationById, bedById, plotById])

  async function createHarvest(event: FormEvent) {
    event.preventDefault(); if (!form.crop_id || !form.harvest_date || !form.quantity_harvested) return
    const quantity = Number(form.quantity_harvested); const unitValue = form.market_value_per_unit ? Number(form.market_value_per_unit) : null
    setSaving(true); setError(null)
    const result = await supabase.from("orchard_harvest_records").insert({ crop_id: form.crop_id, crop_succession_id: form.crop_succession_id === "none" ? null : form.crop_succession_id, bed_allocation_id: form.bed_allocation_id === "none" ? null : form.bed_allocation_id, harvest_lot_code: form.harvest_lot_code.trim() || null, harvest_date: form.harvest_date, quantity_harvested: quantity, harvest_unit: form.harvest_unit.trim() || null, quality_rating: form.quality_rating ? Number(form.quality_rating) : null, storage_method: form.storage_method.trim() || null, storage_location: form.storage_location.trim() || null, shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : null, market_value_per_unit: unitValue, total_market_value: unitValue == null ? null : quantity * unitValue, notes: form.notes.trim() || null })
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else { setForm({ crop_id: "", crop_succession_id: "none", bed_allocation_id: "none", harvest_lot_code: "", harvest_date: "", quantity_harvested: "", harvest_unit: "kg", quality_rating: "", storage_method: "", storage_location: "", shelf_life_days: "", market_value_per_unit: "", notes: "" }); await load() }
    setSaving(false)
  }
  async function remove(id: string) { if (!window.confirm(text.delete)) return; setSaving(true); const result = await supabase.from("orchard_harvest_records").delete().eq("id", id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load(); setSaving(false) }

  return <AppLayout><PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} /><OrchardNavigation /><div className="space-y-6 p-4 sm:p-8">
    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.passes} value={harvests.length.toLocaleString(locale)} /><Metric label={text.output} value={outputLabel} /><Metric label={text.qualityAvg} value={quality ? quality.toFixed(1) : "—"} /><Metric label={text.value} value={value ? displayNumber(value, locale) : "—"} /></div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />{text.performance}</CardTitle><CardDescription>{text.performanceHelp}</CardDescription></CardHeader><CardContent>{successionPerformance.length === 0 ? <p className="text-sm text-muted-foreground">{text.noPerformance}</p> : <div className="space-y-3">{successionPerformance.map((item) => <div key={item.succession.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{successionLabel(item.succession.id)}</p><p className="text-xs text-muted-foreground">{item.rows.length} {text.passes.toLowerCase()} · {item.area ? `${displayNumber(item.area, locale)} m²` : "—"}</p></div><Badge variant={item.timing != null && Math.abs(item.timing) > 3 ? "destructive" : "secondary"}>{item.timing == null ? "—" : item.timing === 0 ? text.onTime : item.timing > 0 ? `${item.timing}d ${text.late}` : `${Math.abs(item.timing)}d ${text.early}`}</Badge></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Mini label={text.plannedFirst} value={dateLabel(item.succession.planned_first_harvest_date, locale)} /><Mini label={text.firstHarvest} value={dateLabel(item.first, locale)} /><Mini label={text.yieldVsPlan} value={item.unit && item.actualYield != null ? `${displayNumber(item.actualYield, locale)} ${item.unit}${item.expectedYield != null ? ` / ${displayNumber(item.expectedYield, locale)} ${text.expected}` : ""}` : text.unitsMixed} /><Mini label={text.productivity} value={item.productivity != null && item.unit ? `${displayNumber(item.productivity, locale)} ${item.unit} ${text.perSqm}` : "—"} /></div></div>)}</div>}</CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-2"><RankCard title={text.variety} rows={varietyRows.map((row) => ({ label: row.label, detail: `${displayNumber(row.quantity, locale)} ${row.unit} · ${row.passes} ${text.passes.toLowerCase()}` }))} /><RankCard title={text.bed} rows={bedRows.map((row) => ({ label: row.label, detail: `${displayNumber(row.quantity, locale)} ${row.unit} · ${row.area ? `${displayNumber(row.quantity / row.area, locale)} ${row.unit} ${text.perSqm}` : `${row.passes} ${text.passes.toLowerCase()}`}` }))} /></div>

    <Card><CardHeader><CardTitle>{text.new}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader><CardContent><form onSubmit={createHarvest} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label={text.crop}><Select value={form.crop_id} onValueChange={(id) => { const crop = cropById.get(id); const successionId = crop?.crop_succession_id ?? null; const allocation = successionId ? allocations.find((item) => item.crop_succession_id === successionId) : null; setForm((f) => ({ ...f, crop_id: id, crop_succession_id: successionId ?? "none", bed_allocation_id: allocation?.id ?? "none", harvest_unit: crop?.yield_unit || f.harvest_unit })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{crops.map((crop) => <SelectItem key={crop.id} value={crop.id}>{cropLabel(crop)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.succession}><Select value={form.crop_succession_id} onValueChange={(id) => { const allocation = id === "none" ? null : allocations.find((item) => item.crop_succession_id === id); setForm((f) => ({ ...f, crop_succession_id: id, bed_allocation_id: allocation?.id ?? "none" })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.noSuccession}</SelectItem>{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item.id)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.allocation}><Select value={form.bed_allocation_id} onValueChange={(id) => setForm((f) => ({ ...f, bed_allocation_id: id }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.noBed}</SelectItem>{selectedSuccessionAllocations.map((item) => <SelectItem key={item.id} value={item.id}>{bedLabel(item.id)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.lot}><Input value={form.harvest_lot_code} onChange={(e) => setForm((f) => ({ ...f, harvest_lot_code: e.target.value }))} /></Field>
      <Field label={text.date}><Input type="date" value={form.harvest_date} onChange={(e) => setForm((f) => ({ ...f, harvest_date: e.target.value }))} required /></Field><Field label={text.quantity}><Input type="number" min="0.001" step="0.001" value={form.quantity_harvested} onChange={(e) => setForm((f) => ({ ...f, quantity_harvested: e.target.value }))} required /></Field><Field label={text.unit}><Input value={form.harvest_unit} onChange={(e) => setForm((f) => ({ ...f, harvest_unit: e.target.value }))} /></Field><Field label={text.quality}><Input type="number" min="1" max="5" value={form.quality_rating} onChange={(e) => setForm((f) => ({ ...f, quality_rating: e.target.value }))} /></Field>
      <Field label={text.storageMethod}><Input value={form.storage_method} onChange={(e) => setForm((f) => ({ ...f, storage_method: e.target.value }))} /></Field><Field label={text.storageLocation}><Input value={form.storage_location} onChange={(e) => setForm((f) => ({ ...f, storage_location: e.target.value }))} /></Field><Field label={text.shelf}><Input type="number" min="0" value={form.shelf_life_days} onChange={(e) => setForm((f) => ({ ...f, shelf_life_days: e.target.value }))} /></Field><Field label={text.valueUnit}><Input type="number" min="0" step="0.01" value={form.market_value_per_unit} onChange={(e) => setForm((f) => ({ ...f, market_value_per_unit: e.target.value }))} /></Field>
      <div className="md:col-span-2 xl:col-span-4"><Field label={text.notes}><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field></div><div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></div>
    </form></CardContent></Card>

    <Card><CardHeader><CardTitle>{text.records}</CardTitle></CardHeader><CardContent>{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : harvests.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> : <div className="space-y-3">{harvests.map((item) => { const crop = cropById.get(item.crop_id); return <div key={item.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{crop ? cropLabel(crop) : item.crop_id}</p>{item.harvest_lot_code && <Badge variant="outline">{item.harvest_lot_code}</Badge>}<Badge variant="secondary">{displayNumber(item.quantity_harvested ?? 0, locale)} {item.harvest_unit || "unit"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{dateLabel(item.harvest_date, locale)} · {successionLabel(item.crop_succession_id)} · {bedLabel(item.bed_allocation_id)}</p><p className="mt-2 text-xs text-muted-foreground"><Link2 className="mr-1 inline h-3 w-3" />{text.trace}: {crop ? cropLabel(crop) : item.crop_id} → {successionLabel(item.crop_succession_id)} → {bedLabel(item.bed_allocation_id)}</p>{item.notes && <p className="mt-2 text-sm">{item.notes}</p>}</div><Button variant="ghost" size="icon" onClick={() => void remove(item.id)} disabled={saving}><Trash2 className="h-4 w-4" /></Button></div></div> })}</div>}</CardContent></Card>
  </div></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-semibold">{value}</p></CardContent></Card> }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
function RankCard({ title, rows }: { title: string; rows: Array<{ label: string; detail: string }> }) { return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{rows.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : <div className="space-y-2">{rows.slice(0, 10).map((row) => <div key={`${row.label}-${row.detail}`} className="flex items-center justify-between gap-4 rounded-md border p-3"><p className="font-medium">{row.label}</p><p className="text-right text-sm text-muted-foreground">{row.detail}</p></div>)}</div>}</CardContent></Card> }

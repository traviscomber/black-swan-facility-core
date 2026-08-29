"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link2, Plus, RefreshCw, Trash2 } from "lucide-react"
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
type Crop = { id: string; plot_id: string; crop_name: string; variety: string | null; crop_succession_id: string | null; yield_unit: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Allocation = { id: string; crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }

const copy = {
  en: { title: "Harvest & Traceability", description: "Record each harvest as a traceable lot tied back to the live crop, planned succession and growing space.", new: "Record harvest", crop: "Crop", succession: "Planned succession", allocation: "Bed allocation", lot: "Harvest lot / reference", date: "Harvest date", quantity: "Quantity", unit: "Unit", quality: "Quality 1–5", storageMethod: "Storage method", storageLocation: "Storage location", shelf: "Shelf life (days)", valueUnit: "Value per unit", totalValue: "Total value", notes: "Notes", create: "Record harvest", refresh: "Refresh", records: "Harvest records", empty: "No harvests recorded yet.", loadError: "Could not load harvest data", saveError: "Could not record harvest", delete: "Delete this harvest record?", trace: "Trace", cropTotal: "Crop total", lots: "Lots", total: "Total harvested", qualityAvg: "Average quality", value: "Recorded value", noSuccession: "No linked succession", noBed: "No linked bed" },
  es: { title: "Cosecha y Trazabilidad", description: "Registra cada cosecha como un lote trazable conectado al cultivo vivo, la sucesión planificada y el espacio de cultivo.", new: "Registrar cosecha", crop: "Cultivo", succession: "Sucesión planificada", allocation: "Asignación de cama", lot: "Lote / referencia", date: "Fecha de cosecha", quantity: "Cantidad", unit: "Unidad", quality: "Calidad 1–5", storageMethod: "Método de almacenamiento", storageLocation: "Ubicación de almacenamiento", shelf: "Vida útil (días)", valueUnit: "Valor por unidad", totalValue: "Valor total", notes: "Notas", create: "Registrar cosecha", refresh: "Actualizar", records: "Registros de cosecha", empty: "Aún no hay cosechas registradas.", loadError: "No fue posible cargar las cosechas", saveError: "No fue posible registrar la cosecha", delete: "¿Eliminar este registro de cosecha?", trace: "Traza", cropTotal: "Total del cultivo", lots: "Lotes", total: "Total cosechado", qualityAvg: "Calidad promedio", value: "Valor registrado", noSuccession: "Sin sucesión vinculada", noBed: "Sin cama vinculada" },
} as const

const dateLabel = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale)

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
      supabase.from("orchard_crops").select("id, plot_id, crop_name, variety, crop_succession_id, yield_unit").order("crop_name"),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no"), supabase.from("orchard_crop_cycles").select("id, crop_name, variety"),
      supabase.from("orchard_bed_allocations").select("id, crop_succession_id, bed_id"), supabase.from("orchard_beds").select("id, plot_id, name"), supabase.from("orchard_plots").select("id, name"),
    ])
    const e = h.error ?? c.error ?? s.error ?? cy.error ?? a.error ?? b.error ?? p.error
    if (e) setError(`${text.loadError}: ${e.message}`)
    else { setHarvests((h.data ?? []) as Harvest[]); setCrops((c.data ?? []) as Crop[]); setSuccessions((s.data ?? []) as Succession[]); setCycles((cy.data ?? []) as Cycle[]); setAllocations((a.data ?? []) as Allocation[]); setBeds((b.data ?? []) as Bed[]); setPlots((p.data ?? []) as Plot[]) }
    setLoading(false)
  }, [supabase, text.loadError])
  useEffect(() => { void load() }, [load])

  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles]); const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions]); const allocationById = useMemo(() => new Map(allocations.map((item) => [item.id, item])), [allocations]); const bedById = useMemo(() => new Map(beds.map((item) => [item.id, item])), [beds]); const plotById = useMemo(() => new Map(plots.map((item) => [item.id, item])), [plots]); const cropById = useMemo(() => new Map(crops.map((item) => [item.id, item])), [crops])
  const successionLabel = (id: string | null) => { if (!id) return text.noSuccession; const item = successionById.get(id); const cycle = item ? cycleById.get(item.crop_cycle_id) : null; return item && cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` : text.noSuccession }
  const bedLabel = (allocationId: string | null) => { if (!allocationId) return text.noBed; const allocation = allocationById.get(allocationId); const bed = allocation ? bedById.get(allocation.bed_id) : null; const plot = bed ? plotById.get(bed.plot_id) : null; return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : text.noBed }
  const cropLabel = (crop: Crop) => `${crop.crop_name}${crop.variety ? ` · ${crop.variety}` : ""}`
  const selectedSuccessionAllocations = allocations.filter((item) => form.crop_succession_id !== "none" && item.crop_succession_id === form.crop_succession_id)

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

  const total = harvests.reduce((sum, item) => sum + (item.quantity_harvested ?? 0), 0); const qualityRows = harvests.filter((item) => item.quality_rating != null); const quality = qualityRows.length ? qualityRows.reduce((sum, item) => sum + (item.quality_rating ?? 0), 0) / qualityRows.length : 0; const value = harvests.reduce((sum, item) => sum + (item.total_market_value ?? 0), 0)

  return <AppLayout><PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} /><OrchardNavigation /><div className="space-y-6 p-4 sm:p-8">{error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.lots} value={harvests.length.toLocaleString(locale)} /><Metric label={text.total} value={total.toLocaleString(locale)} /><Metric label={text.qualityAvg} value={quality ? quality.toFixed(1) : "—"} /><Metric label={text.value} value={value.toLocaleString(locale)} /></div>
    <Card><CardHeader><CardTitle>{text.new}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader><CardContent><form onSubmit={createHarvest} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label={text.crop}><Select value={form.crop_id} onValueChange={(id) => { const crop = cropById.get(id); const successionId = crop?.crop_succession_id ?? null; const allocation = successionId ? allocations.find((item) => item.crop_succession_id === successionId) : null; setForm((f) => ({ ...f, crop_id: id, crop_succession_id: successionId ?? "none", bed_allocation_id: allocation?.id ?? "none", harvest_unit: crop?.yield_unit || f.harvest_unit })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{crops.map((crop) => <SelectItem key={crop.id} value={crop.id}>{cropLabel(crop)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.succession}><Select value={form.crop_succession_id} onValueChange={(id) => { const allocation = id === "none" ? null : allocations.find((item) => item.crop_succession_id === id); setForm((f) => ({ ...f, crop_succession_id: id, bed_allocation_id: allocation?.id ?? "none" })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.noSuccession}</SelectItem>{successions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item.id)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.allocation}><Select value={form.bed_allocation_id} onValueChange={(id) => setForm((f) => ({ ...f, bed_allocation_id: id }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.noBed}</SelectItem>{selectedSuccessionAllocations.map((item) => <SelectItem key={item.id} value={item.id}>{bedLabel(item.id)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={text.lot}><Input value={form.harvest_lot_code} onChange={(e) => setForm((f) => ({ ...f, harvest_lot_code: e.target.value }))} /></Field>
      <Field label={text.date}><Input type="date" value={form.harvest_date} onChange={(e) => setForm((f) => ({ ...f, harvest_date: e.target.value }))} required /></Field><Field label={text.quantity}><Input type="number" min="0.001" step="0.001" value={form.quantity_harvested} onChange={(e) => setForm((f) => ({ ...f, quantity_harvested: e.target.value }))} required /></Field><Field label={text.unit}><Input value={form.harvest_unit} onChange={(e) => setForm((f) => ({ ...f, harvest_unit: e.target.value }))} /></Field><Field label={text.quality}><Input type="number" min="1" max="5" value={form.quality_rating} onChange={(e) => setForm((f) => ({ ...f, quality_rating: e.target.value }))} /></Field><Field label={text.storageMethod}><Input value={form.storage_method} onChange={(e) => setForm((f) => ({ ...f, storage_method: e.target.value }))} /></Field><Field label={text.storageLocation}><Input value={form.storage_location} onChange={(e) => setForm((f) => ({ ...f, storage_location: e.target.value }))} /></Field><Field label={text.shelf}><Input type="number" min="0" value={form.shelf_life_days} onChange={(e) => setForm((f) => ({ ...f, shelf_life_days: e.target.value }))} /></Field><Field label={text.valueUnit}><Input type="number" min="0" step="0.01" value={form.market_value_per_unit} onChange={(e) => setForm((f) => ({ ...f, market_value_per_unit: e.target.value }))} /></Field><div className="md:col-span-2 xl:col-span-4"><Field label={text.notes}><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field></div><div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving || crops.length === 0}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>{text.records}</CardTitle></CardHeader><CardContent>{loading ? <p>Loading…</p> : harvests.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> : <div className="space-y-3">{harvests.map((item) => { const crop = cropById.get(item.crop_id); const cropHarvests = harvests.filter((entry) => entry.crop_id === item.crop_id && entry.harvest_unit === item.harvest_unit); const cropTotal = cropHarvests.reduce((sum, entry) => sum + (entry.quantity_harvested ?? 0), 0); return <div key={item.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{crop ? cropLabel(crop) : "—"}</p>{item.harvest_lot_code && <Badge variant="outline">{item.harvest_lot_code}</Badge>}{item.quality_rating != null && <Badge variant="secondary">{item.quality_rating}/5</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{dateLabel(item.harvest_date, locale)} · {item.quantity_harvested ?? "—"} {item.harvest_unit ?? ""} · {text.cropTotal}: {cropTotal} {item.harvest_unit ?? ""}</p></div><Button variant="ghost" size="icon" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-4 grid gap-2 border-t pt-4 md:grid-cols-[110px_1fr_1fr]"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Link2 className="h-4 w-4" />{text.trace}</div><div><p className="text-xs text-muted-foreground">{text.succession}</p><p className="text-sm">{successionLabel(item.crop_succession_id)}</p></div><div><p className="text-xs text-muted-foreground">{text.allocation}</p><p className="text-sm">{bedLabel(item.bed_allocation_id)}</p></div></div>{(item.storage_method || item.storage_location || item.notes) && <p className="mt-3 text-sm text-muted-foreground">{item.storage_method || ""}{item.storage_location ? ` · ${item.storage_location}` : ""}{item.notes ? ` · ${item.notes}` : ""}</p>}</div> })}</div>}</CardContent></Card>
  </div></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card> }

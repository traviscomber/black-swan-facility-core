"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Leaf, Plus, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Crop = { id: string; crop_name: string; variety: string | null; crop_succession_id: string | null; yield_unit: string | null }
type Allocation = { id: string; crop_succession_id: string; bed_id: string }
type Bed = { id: string; plot_id: string; name: string }
type Plot = { id: string; name: string }

const copy = {
  en: {
    title: "Quick Harvest",
    description: "Record a traceable harvest pass in seconds from the field.",
    back: "Field Mode",
    refresh: "Refresh",
    crop: "Crop",
    bed: "Bed allocation",
    noBed: "No linked bed",
    date: "Harvest date",
    quantity: "Quantity",
    unit: "Unit",
    lot: "Lot / reference",
    quality: "Quality 1–5",
    notes: "Notes",
    optional: "Optional trace details",
    save: "Record harvest",
    success: "Harvest recorded",
    loadError: "Could not load harvest context",
    saveError: "Could not record harvest",
  },
  es: {
    title: "Cosecha Rápida",
    description: "Registra una pasada de cosecha trazable en segundos desde terreno.",
    back: "Modo Terreno",
    refresh: "Actualizar",
    crop: "Cultivo",
    bed: "Asignación de cama",
    noBed: "Sin cama vinculada",
    date: "Fecha de cosecha",
    quantity: "Cantidad",
    unit: "Unidad",
    lot: "Lote / referencia",
    quality: "Calidad 1–5",
    notes: "Notas",
    optional: "Detalles opcionales de trazabilidad",
    save: "Registrar cosecha",
    success: "Cosecha registrada",
    loadError: "No fue posible cargar el contexto de cosecha",
    saveError: "No fue posible registrar la cosecha",
  },
} as const

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function OrchardQuickHarvestPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const [crops, setCrops] = useState<Crop[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({ crop_id: "", bed_allocation_id: "none", harvest_date: todayKey(), quantity_harvested: "", harvest_unit: "kg", harvest_lot_code: "", quality_rating: "", notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [cropResult, allocationResult, bedResult, plotResult] = await Promise.all([
      supabase.from("orchard_crops").select("id,crop_name,variety,crop_succession_id,yield_unit").neq("status", "completed").order("crop_name"),
      supabase.from("orchard_bed_allocations").select("id,crop_succession_id,bed_id"),
      supabase.from("orchard_beds").select("id,plot_id,name"),
      supabase.from("orchard_plots").select("id,name"),
    ])
    const firstError = cropResult.error ?? allocationResult.error ?? bedResult.error ?? plotResult.error
    if (firstError) setError(`${text.loadError}: ${firstError.message}`)
    else {
      setCrops((cropResult.data ?? []) as Crop[])
      setAllocations((allocationResult.data ?? []) as Allocation[])
      setBeds((bedResult.data ?? []) as Bed[])
      setPlots((plotResult.data ?? []) as Plot[])
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const selectedCrop = crops.find((crop) => crop.id === form.crop_id) ?? null
  const availableAllocations = allocations.filter((item) => selectedCrop?.crop_succession_id && item.crop_succession_id === selectedCrop.crop_succession_id)
  const bedById = useMemo(() => new Map(beds.map((bed) => [bed.id, bed])), [beds])
  const plotById = useMemo(() => new Map(plots.map((plot) => [plot.id, plot])), [plots])
  const allocationLabel = (allocation: Allocation) => {
    const bed = bedById.get(allocation.bed_id)
    const plot = bed ? plotById.get(bed.plot_id) : null
    return bed ? `${plot?.name ? `${plot.name} · ` : ""}${bed.name}` : text.noBed
  }

  function selectCrop(cropId: string) {
    const crop = crops.find((item) => item.id === cropId)
    const matching = allocations.filter((item) => crop?.crop_succession_id && item.crop_succession_id === crop.crop_succession_id)
    setForm((current) => ({ ...current, crop_id: cropId, bed_allocation_id: matching.length === 1 ? matching[0].id : "none", harvest_unit: crop?.yield_unit || current.harvest_unit || "kg" }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selectedCrop || !form.harvest_date || !form.quantity_harvested || Number(form.quantity_harvested) <= 0) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    const { error: saveError } = await supabase.from("orchard_harvest_records").insert({
      crop_id: selectedCrop.id,
      crop_succession_id: selectedCrop.crop_succession_id,
      bed_allocation_id: form.bed_allocation_id === "none" ? null : form.bed_allocation_id,
      harvest_date: form.harvest_date,
      quantity_harvested: Number(form.quantity_harvested),
      harvest_unit: form.harvest_unit.trim() || "kg",
      harvest_lot_code: form.harvest_lot_code.trim() || null,
      quality_rating: form.quality_rating ? Number(form.quality_rating) : null,
      notes: form.notes.trim() || null,
    })
    if (saveError) setError(`${text.saveError}: ${saveError.message}`)
    else {
      setSuccess(text.success)
      setForm((current) => ({ ...current, quantity_harvested: "", harvest_lot_code: "", quality_rating: "", notes: "", harvest_date: todayKey() }))
    }
    setSaving(false)
  }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} />
      <OrchardNavigation />
      <div className="mx-auto max-w-2xl space-y-4 p-3 pb-24 sm:p-6">
        <Button asChild variant="ghost" className="min-h-11"><Link href={`/${language}/orchard/field`}><ArrowLeft className="mr-2 h-4 w-4" />{text.back}</Link></Button>
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        {success && <Card><CardContent className="flex items-center gap-2 p-4 text-sm font-medium"><Leaf className="h-4 w-4" />{success}</CardContent></Card>}
        <Card>
          <CardHeader><CardTitle>{text.title}</CardTitle><CardDescription>{text.description}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Field label={text.crop}><Select value={form.crop_id} onValueChange={selectCrop}><SelectTrigger className="min-h-12"><SelectValue placeholder={text.crop} /></SelectTrigger><SelectContent>{crops.map((crop) => <SelectItem key={crop.id} value={crop.id}>{crop.crop_name}{crop.variety ? ` · ${crop.variety}` : ""}</SelectItem>)}</SelectContent></Select></Field>
              {availableAllocations.length > 0 && <Field label={text.bed}><Select value={form.bed_allocation_id} onValueChange={(value) => setForm((current) => ({ ...current, bed_allocation_id: value }))}><SelectTrigger className="min-h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.noBed}</SelectItem>{availableAllocations.map((allocation) => <SelectItem key={allocation.id} value={allocation.id}>{allocationLabel(allocation)}</SelectItem>)}</SelectContent></Select></Field>}
              <div className="grid grid-cols-2 gap-3">
                <Field label={text.date}><Input className="min-h-12" type="date" value={form.harvest_date} onChange={(event) => setForm((current) => ({ ...current, harvest_date: event.target.value }))} required /></Field>
                <Field label={text.unit}><Input className="min-h-12" value={form.harvest_unit} onChange={(event) => setForm((current) => ({ ...current, harvest_unit: event.target.value }))} required /></Field>
              </div>
              <Field label={text.quantity}><Input className="min-h-14 text-lg" inputMode="decimal" type="number" min="0.001" step="0.001" value={form.quantity_harvested} onChange={(event) => setForm((current) => ({ ...current, quantity_harvested: event.target.value }))} required /></Field>
              <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{text.optional}</summary><div className="mt-4 space-y-4"><Field label={text.lot}><Input className="min-h-11" value={form.harvest_lot_code} onChange={(event) => setForm((current) => ({ ...current, harvest_lot_code: event.target.value }))} /></Field><Field label={text.quality}><Input className="min-h-11" type="number" min="1" max="5" step="1" value={form.quality_rating} onChange={(event) => setForm((current) => ({ ...current, quality_rating: event.target.value }))} /></Field><Field label={text.notes}><Textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field></div></details>
              <Button type="submit" className="min-h-14 w-full text-base" disabled={saving || !selectedCrop || !form.quantity_harvested}><Plus className="mr-2 h-5 w-5" />{text.save}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

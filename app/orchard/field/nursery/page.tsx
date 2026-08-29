"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, RefreshCw, Sprout } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { OrchardNavigation } from "@/components/orchard/orchard-navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type BatchStatus = "planned" | "sown" | "germinating" | "growing" | "hardening" | "ready" | "transplanted" | "completed" | "failed" | "cancelled"
type Batch = { id: string; batch_code: string | null; crop_succession_id: string; status: BatchStatus; sow_date: string; expected_ready_date: string | null; emerged_count: number | null; loss_count: number; ready_count: number | null; hardened_count: number | null; transplanted_count: number | null; hardening_started_date: string | null; hardening_completed_date: string | null; actual_ready_date: string | null; transplant_date: string | null; location: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number }
type Cycle = { id: string; crop_name: string; variety: string | null }

type Inputs = { ready: string; transplant: string }

const copy = {
  en: {
    title: "Nursery Quick Actions",
    description: "Advance active nursery batches from the field without opening the full inventory cockpit.",
    back: "Field Mode",
    refresh: "Refresh",
    empty: "No active nursery batches.",
    emerged: "emerged",
    lost: "lost",
    ready: "ready",
    transplanted: "transplanted",
    startHardening: "Start hardening",
    markReady: "Mark ready",
    readyTotal: "Ready total",
    transplantNow: "Transplant now",
    transplantAmount: "Transplant amount",
    complete: "Complete batch",
    saveError: "Could not update nursery batch",
    loadError: "Could not load nursery batches",
  },
  es: {
    title: "Acciones Rápidas de Almácigo",
    description: "Avanza lotes activos de almácigo desde terreno sin abrir el cockpit completo de inventario.",
    back: "Modo Terreno",
    refresh: "Actualizar",
    empty: "No hay lotes activos de almácigo.",
    emerged: "emergidas",
    lost: "pérdidas",
    ready: "listas",
    transplanted: "trasplantadas",
    startHardening: "Iniciar endurecimiento",
    markReady: "Marcar listo",
    readyTotal: "Total listo",
    transplantNow: "Trasplantar ahora",
    transplantAmount: "Cantidad a trasplantar",
    complete: "Completar lote",
    saveError: "No fue posible actualizar el almácigo",
    loadError: "No fue posible cargar los almácigos",
  },
} as const

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function OrchardQuickNurseryPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const [batches, setBatches] = useState<Batch[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [inputs, setInputs] = useState<Record<string, Inputs>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [batchResult, successionResult, cycleResult] = await Promise.all([
      supabase.from("orchard_nursery_batches").select("id,batch_code,crop_succession_id,status,sow_date,expected_ready_date,emerged_count,loss_count,ready_count,hardened_count,transplanted_count,hardening_started_date,hardening_completed_date,actual_ready_date,transplant_date,location").in("status", ["sown", "germinating", "growing", "hardening", "ready", "transplanted"]).order("expected_ready_date", { ascending: true, nullsFirst: false }),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id,sequence_no"),
      supabase.from("orchard_crop_cycles").select("id,crop_name,variety"),
    ])
    const firstError = batchResult.error ?? successionResult.error ?? cycleResult.error
    if (firstError) setError(`${text.loadError}: ${firstError.message}`)
    else {
      const next = (batchResult.data ?? []) as Batch[]
      setBatches(next)
      setSuccessions((successionResult.data ?? []) as Succession[])
      setCycles((cycleResult.data ?? []) as Cycle[])
      setInputs(Object.fromEntries(next.map((batch) => [batch.id, { ready: String(batch.ready_count ?? batch.emerged_count ?? ""), transplant: "" }])))
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const labelFor = (batch: Batch) => {
    const succession = successionById.get(batch.crop_succession_id)
    const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null
    return cycle && succession ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${succession.sequence_no}` : (batch.batch_code || "Nursery batch")
  }

  function setInput(id: string, key: keyof Inputs, value: string) {
    setInputs((current) => ({ ...current, [id]: { ...(current[id] ?? { ready: "", transplant: "" }), [key]: value } }))
  }

  async function updateBatch(batch: Batch, changes: Record<string, string | number | null>) {
    setSaving(batch.id)
    setError(null)
    const { error: updateError } = await supabase.from("orchard_nursery_batches").update(changes).eq("id", batch.id)
    if (updateError) setError(`${text.saveError}: ${updateError.message}`)
    else await load()
    setSaving(null)
  }

  async function startHardening(batch: Batch) {
    await updateBatch(batch, { status: "hardening", hardening_started_date: batch.hardening_started_date || todayKey() })
  }

  async function markReady(batch: Batch) {
    const value = Number(inputs[batch.id]?.ready || 0)
    if (value < 0) return
    await updateBatch(batch, {
      status: "ready",
      ready_count: value,
      hardened_count: Math.max(batch.hardened_count ?? 0, value),
      actual_ready_date: batch.actual_ready_date || todayKey(),
      hardening_completed_date: batch.hardening_completed_date || todayKey(),
    })
  }

  async function transplant(batch: Batch) {
    const delta = Number(inputs[batch.id]?.transplant || 0)
    if (delta <= 0) return
    const ready = batch.ready_count ?? 0
    const current = batch.transplanted_count ?? 0
    const next = Math.min(current + delta, ready || current + delta)
    await updateBatch(batch, {
      status: next >= ready && ready > 0 ? "transplanted" : "ready",
      transplanted_count: next,
      transplant_date: todayKey(),
    })
  }

  async function complete(batch: Batch) {
    await updateBatch(batch, { status: "completed" })
  }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} />
      <OrchardNavigation />
      <div className="mx-auto max-w-2xl space-y-4 p-3 pb-24 sm:p-6">
        <Button asChild variant="ghost" className="min-h-11"><Link href={`/${language}/orchard/field`}><ArrowLeft className="mr-2 h-4 w-4" />{text.back}</Link></Button>
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        {batches.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{text.empty}</CardContent></Card> : batches.map((batch) => {
          const values = inputs[batch.id] ?? { ready: "", transplant: "" }
          return <Card key={batch.id}>
            <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{labelFor(batch)}</CardTitle><CardDescription>{batch.batch_code || batch.location || batch.sow_date}</CardDescription></div><Badge variant="secondary">{batch.status.replaceAll("_", " ")}</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center text-xs"><Metric value={batch.emerged_count ?? 0} label={text.emerged} /><Metric value={batch.loss_count ?? 0} label={text.lost} /><Metric value={batch.ready_count ?? 0} label={text.ready} /><Metric value={batch.transplanted_count ?? 0} label={text.transplanted} /></div>
              {(batch.status === "sown" || batch.status === "germinating" || batch.status === "growing") && <Button className="min-h-12 w-full" variant="outline" disabled={saving === batch.id} onClick={() => void startHardening(batch)}><Sprout className="mr-2 h-4 w-4" />{text.startHardening}</Button>}
              {(batch.status === "hardening" || batch.status === "growing") && <div className="space-y-2 rounded-xl border p-3"><Label>{text.readyTotal}</Label><Input className="min-h-12" type="number" min="0" inputMode="numeric" value={values.ready} onChange={(event) => setInput(batch.id, "ready", event.target.value)} /><Button className="min-h-12 w-full" disabled={saving === batch.id} onClick={() => void markReady(batch)}><CheckCircle2 className="mr-2 h-4 w-4" />{text.markReady}</Button></div>}
              {(batch.status === "ready" || batch.status === "transplanted") && <div className="space-y-2 rounded-xl border p-3"><Label>{text.transplantAmount}</Label><Input className="min-h-12" type="number" min="1" inputMode="numeric" value={values.transplant} onChange={(event) => setInput(batch.id, "transplant", event.target.value)} /><Button className="min-h-12 w-full" disabled={saving === batch.id || !values.transplant} onClick={() => void transplant(batch)}>{text.transplantNow}</Button></div>}
              {batch.status === "transplanted" && <Button className="min-h-12 w-full" variant="outline" disabled={saving === batch.id} onClick={() => void complete(batch)}>{text.complete}</Button>}
            </CardContent>
          </Card>
        })}
      </div>
    </AppLayout>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-lg border p-2"><p className="text-base font-semibold tabular-nums">{value}</p><p className="mt-0.5 text-muted-foreground">{label}</p></div>
}

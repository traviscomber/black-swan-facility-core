"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, History, Plus, RefreshCw, Sprout, Trash2 } from "lucide-react"
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

type SeedLot = { id: string; crop_name: string; variety: string | null; lot_code: string | null; supplier: string | null; quantity_seeds: number; germination_rate_pct: number | null; received_date: string | null; expiry_date: string | null; storage_location: string | null; notes: string | null }
type SeedMovement = { id: string; seed_lot_id: string; nursery_batch_id: string | null; movement_type: string; quantity_delta: number; occurred_on: string; reason: string | null; created_at: string }
type Batch = { id: string; crop_succession_id: string; seed_lot_id: string | null; sow_date: string; cells_sown: number | null; seeds_sown: number; emerged_count: number | null; ready_count: number | null; transplanted_count: number | null; expected_ready_date: string | null; actual_ready_date: string | null; transplant_date: string | null; status: "planned" | "sown" | "germinating" | "growing" | "ready" | "transplanted" | "completed" | "failed" | "cancelled"; location: string | null; notes: string | null }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number; planned_sow_date: string; planned_transplant_date: string | null; planned_plants: number | null; germination_rate_pct: number | null; seeds_per_plant: number | null }
type Cycle = { id: string; crop_name: string; variety: string | null }

type AdjustmentType = "receipt" | "adjustment" | "write_off" | "return"
const statuses: Batch["status"][] = ["planned", "sown", "germinating", "growing", "ready", "transplanted", "completed", "failed", "cancelled"]
const adjustmentTypes: AdjustmentType[] = ["receipt", "adjustment", "write_off", "return"]
const copy = {
  en: {
    title: "Seeds & Nursery", description: "Run seed inventory and nursery as one traceable workflow from planned demand to sowing, emergence, readiness and transplanting.", refresh: "Refresh", loading: "Loading…", seedLots: "Seed lots", newSeedLot: "New seed lot", crop: "Crop", variety: "Variety", lot: "Lot code", supplier: "Supplier", quantity: "Seeds on hand", germination: "Germination (%)", received: "Received", expiry: "Expiry", storage: "Storage", notes: "Notes", saveLot: "Save seed lot", nursery: "Nursery batches", newBatch: "Start nursery batch", succession: "Succession", seedLot: "Seed lot", sowDate: "Sow date", cells: "Cells sown", seedsSown: "Seeds sown", expectedReady: "Expected ready", location: "Nursery location", startBatch: "Start batch", emerged: "Emerged", ready: "Ready", transplanted: "Transplanted", actualReady: "Actual ready", transplantDate: "Transplant date", saveCounts: "Save progress", emptyLots: "No seed lots recorded yet.", emptyBatches: "No nursery batches yet.", loadError: "Could not load nursery data", saveError: "Could not save changes", deleteLot: "Delete this seed lot?", deleteBatch: "Delete this nursery batch?", available: "available", planned: "planned", stock: "Seeds on hand", demand: "Unstarted seed demand", shortfall: "Planned shortfall", movements: "Inventory movements", coverage: "Seed coverage", coverageHelp: "Compares available seed lots with successions that have not entered nursery yet.", need: "need", gap: "gap", covered: "covered", adjustment: "Adjust seed inventory", adjustmentHelp: "Record receipts, returns, write-offs or corrections through the auditable inventory ledger.", movementType: "Movement type", signedQuantity: "Quantity", reason: "Reason", date: "Date", applyAdjustment: "Apply adjustment", movementHistory: "Recent movements", noMovements: "No inventory movements yet.", shortage: "Selected lot does not have enough seed for this batch.", onHand: "on hand", linkedLot: "Seed lot", inventoryAuto: "Starting or changing a nursery batch updates seed stock automatically.", none: "None" },
  es: {
    title: "Semillas y Almácigos", description: "Opera inventario de semillas y almácigos como un flujo trazable desde demanda planificada hasta siembra, emergencia, preparación y trasplante.", refresh: "Actualizar", loading: "Cargando…", seedLots: "Lotes de semillas", newSeedLot: "Nuevo lote", crop: "Cultivo", variety: "Variedad", lot: "Código de lote", supplier: "Proveedor", quantity: "Semillas disponibles", germination: "Germinación (%)", received: "Recepción", expiry: "Vencimiento", storage: "Almacenamiento", notes: "Notas", saveLot: "Guardar lote", nursery: "Lotes de almácigo", newBatch: "Iniciar almácigo", succession: "Sucesión", seedLot: "Lote de semillas", sowDate: "Fecha de siembra", cells: "Celdas sembradas", seedsSown: "Semillas sembradas", expectedReady: "Fecha estimada lista", location: "Ubicación", startBatch: "Iniciar lote", emerged: "Emergidas", ready: "Listas", transplanted: "Trasplantadas", actualReady: "Fecha real lista", transplantDate: "Fecha de trasplante", saveCounts: "Guardar avance", emptyLots: "Aún no hay lotes de semillas.", emptyBatches: "Aún no hay lotes de almácigo.", loadError: "No fue posible cargar almácigos", saveError: "No fue posible guardar cambios", deleteLot: "¿Eliminar este lote de semillas?", deleteBatch: "¿Eliminar este lote de almácigo?", available: "disponibles", planned: "planificadas", stock: "Semillas disponibles", demand: "Demanda aún no sembrada", shortfall: "Déficit planificado", movements: "Movimientos de inventario", coverage: "Cobertura de semillas", coverageHelp: "Compara los lotes disponibles con las sucesiones que aún no entran al almácigo.", need: "necesita", gap: "déficit", covered: "cubierto", adjustment: "Ajustar inventario", adjustmentHelp: "Registra recepciones, devoluciones, bajas o correcciones mediante el ledger auditable.", movementType: "Tipo de movimiento", signedQuantity: "Cantidad", reason: "Motivo", date: "Fecha", applyAdjustment: "Aplicar ajuste", movementHistory: "Movimientos recientes", noMovements: "Aún no hay movimientos de inventario.", shortage: "El lote seleccionado no tiene suficientes semillas para este almácigo.", onHand: "disponibles", linkedLot: "Lote de semillas", inventoryAuto: "Al iniciar o cambiar un almácigo el stock de semillas se actualiza automáticamente.", none: "Ninguno" },
} as const

const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const dateLabel = (value: string | null, locale: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale) : "—"
const cropKey = (crop: string, variety: string | null) => `${crop.trim().toLowerCase()}|${(variety ?? "").trim().toLowerCase()}`
const estimatedSeeds = (item: Succession) => {
  const plants = item.planned_plants ?? 0
  const germination = item.germination_rate_pct && item.germination_rate_pct > 0 ? item.germination_rate_pct : 100
  const perPlant = item.seeds_per_plant && item.seeds_per_plant > 0 ? item.seeds_per_plant : 1
  return Math.ceil((plants * perPlant) / (germination / 100))
}

export default function OrchardNurseryPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [seedLots, setSeedLots] = useState<SeedLot[]>([])
  const [movements, setMovements] = useState<SeedMovement[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lotForm, setLotForm] = useState({ crop_name: "", variety: "", lot_code: "", supplier: "", quantity_seeds: "", germination_rate_pct: "", received_date: "", expiry_date: "", storage_location: "", notes: "" })
  const [batchForm, setBatchForm] = useState({ crop_succession_id: "", seed_lot_id: "none", sow_date: "", cells_sown: "", seeds_sown: "", expected_ready_date: "", location: "", notes: "" })
  const [adjustmentForm, setAdjustmentForm] = useState({ seed_lot_id: "", movement_type: "receipt" as AdjustmentType, quantity_delta: "", reason: "", occurred_on: "" })
  const [progress, setProgress] = useState<Record<string, { emerged_count: string; ready_count: string; transplanted_count: string; actual_ready_date: string; transplant_date: string }>>({})

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    const [l, m, b, s, c] = await Promise.all([
      supabase.from("orchard_seed_lots").select("id, crop_name, variety, lot_code, supplier, quantity_seeds, germination_rate_pct, received_date, expiry_date, storage_location, notes").order("crop_name"),
      supabase.from("orchard_seed_inventory_movements").select("id, seed_lot_id, nursery_batch_id, movement_type, quantity_delta, occurred_on, reason, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("orchard_nursery_batches").select("id, crop_succession_id, seed_lot_id, sow_date, cells_sown, seeds_sown, emerged_count, ready_count, transplanted_count, expected_ready_date, actual_ready_date, transplant_date, status, location, notes").order("sow_date", { ascending: false }),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no, planned_sow_date, planned_transplant_date, planned_plants, germination_rate_pct, seeds_per_plant").order("planned_sow_date"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety").order("crop_name"),
    ])
    const e = l.error ?? m.error ?? b.error ?? s.error ?? c.error
    if (e) setError(`${text.loadError}: ${e.message}`)
    else {
      setSeedLots((l.data ?? []) as SeedLot[])
      setMovements((m.data ?? []) as SeedMovement[])
      const nextBatches = (b.data ?? []) as Batch[]
      setBatches(nextBatches)
      setSuccessions((s.data ?? []) as Succession[])
      setCycles((c.data ?? []) as Cycle[])
      setProgress(Object.fromEntries(nextBatches.map((item) => [item.id, { emerged_count: item.emerged_count?.toString() ?? "", ready_count: item.ready_count?.toString() ?? "", transplanted_count: item.transplanted_count?.toString() ?? "", actual_ready_date: item.actual_ready_date ?? "", transplant_date: item.transplant_date ?? "" }])))
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void loadData() }, [loadData])
  const cycleById = useMemo(() => new Map(cycles.map((cycle) => [cycle.id, cycle])), [cycles])
  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const seedLotById = useMemo(() => new Map(seedLots.map((item) => [item.id, item])), [seedLots])
  const usedSuccessionIds = useMemo(() => new Set(batches.map((batch) => batch.crop_succession_id)), [batches])
  const availableSuccessions = useMemo(() => successions.filter((item) => !usedSuccessionIds.has(item.id)), [successions, usedSuccessionIds])
  const successionLabel = useCallback((item: Succession) => { const cycle = cycleById.get(item.crop_cycle_id); return `${cycle?.crop_name ?? "Crop"}${cycle?.variety ? ` · ${cycle.variety}` : ""} #${item.sequence_no}` }, [cycleById])

  const coverageRows = useMemo(() => {
    const stock = new Map<string, number>()
    seedLots.forEach((lot) => stock.set(cropKey(lot.crop_name, lot.variety), (stock.get(cropKey(lot.crop_name, lot.variety)) ?? 0) + lot.quantity_seeds))
    const demand = new Map<string, { label: string; required: number }>()
    availableSuccessions.forEach((item) => {
      const cycle = cycleById.get(item.crop_cycle_id); if (!cycle) return
      const key = cropKey(cycle.crop_name, cycle.variety)
      const current = demand.get(key) ?? { label: `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""}`, required: 0 }
      current.required += estimatedSeeds(item); demand.set(key, current)
    })
    return [...demand.entries()].map(([key, item]) => ({ ...item, stock: stock.get(key) ?? 0, shortage: Math.max(0, item.required - (stock.get(key) ?? 0)) })).sort((a, b) => b.shortage - a.shortage || a.label.localeCompare(b.label))
  }, [seedLots, availableSuccessions, cycleById])
  const totalStock = seedLots.reduce((sum, lot) => sum + lot.quantity_seeds, 0)
  const totalDemand = coverageRows.reduce((sum, item) => sum + item.required, 0)
  const totalShortage = coverageRows.reduce((sum, item) => sum + item.shortage, 0)
  const selectedLot = batchForm.seed_lot_id === "none" ? null : seedLotById.get(batchForm.seed_lot_id) ?? null
  const requestedSeeds = Number(batchForm.seeds_sown || 0)
  const hasShortage = Boolean(selectedLot && requestedSeeds > selectedLot.quantity_seeds)

  async function createLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!lotForm.crop_name) return; setSaving(true); setError(null)
    const { error: e } = await supabase.from("orchard_seed_lots").insert({ crop_name: lotForm.crop_name.trim(), variety: lotForm.variety.trim() || null, lot_code: lotForm.lot_code.trim() || null, supplier: lotForm.supplier.trim() || null, quantity_seeds: Number(lotForm.quantity_seeds || 0), germination_rate_pct: lotForm.germination_rate_pct ? Number(lotForm.germination_rate_pct) : null, received_date: lotForm.received_date || null, expiry_date: lotForm.expiry_date || null, storage_location: lotForm.storage_location.trim() || null, notes: lotForm.notes.trim() || null })
    if (e) setError(`${text.saveError}: ${e.message}`)
    else { setLotForm({ crop_name: "", variety: "", lot_code: "", supplier: "", quantity_seeds: "", germination_rate_pct: "", received_date: "", expiry_date: "", storage_location: "", notes: "" }); await loadData() }
    setSaving(false)
  }

  async function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!batchForm.crop_succession_id || !batchForm.sow_date || hasShortage) return; setSaving(true); setError(null)
    const { error: e } = await supabase.from("orchard_nursery_batches").insert({ crop_succession_id: batchForm.crop_succession_id, seed_lot_id: batchForm.seed_lot_id === "none" ? null : batchForm.seed_lot_id, sow_date: batchForm.sow_date, cells_sown: batchForm.cells_sown ? Number(batchForm.cells_sown) : null, seeds_sown: Number(batchForm.seeds_sown || 0), expected_ready_date: batchForm.expected_ready_date || null, location: batchForm.location.trim() || null, notes: batchForm.notes.trim() || null })
    if (e) setError(`${text.saveError}: ${e.message}`)
    else { setBatchForm({ crop_succession_id: "", seed_lot_id: "none", sow_date: "", cells_sown: "", seeds_sown: "", expected_ready_date: "", location: "", notes: "" }); await loadData() }
    setSaving(false)
  }

  async function adjustInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!adjustmentForm.seed_lot_id || !adjustmentForm.quantity_delta) return; setSaving(true); setError(null)
    const raw = Number(adjustmentForm.quantity_delta)
    const delta = adjustmentForm.movement_type === "write_off" ? -Math.abs(raw) : adjustmentForm.movement_type === "receipt" || adjustmentForm.movement_type === "return" ? Math.abs(raw) : raw
    const { error: e } = await supabase.rpc("orchard_adjust_seed_inventory", { p_seed_lot_id: adjustmentForm.seed_lot_id, p_quantity_delta: delta, p_reason: adjustmentForm.reason.trim(), p_movement_type: adjustmentForm.movement_type, p_occurred_on: adjustmentForm.occurred_on || null })
    if (e) setError(`${text.saveError}: ${e.message}`)
    else { setAdjustmentForm({ seed_lot_id: adjustmentForm.seed_lot_id, movement_type: "receipt", quantity_delta: "", reason: "", occurred_on: "" }); await loadData() }
    setSaving(false)
  }

  async function saveProgress(batch: Batch) { const item = progress[batch.id]; if (!item) return; setSaving(true); const numeric = (value: string) => value ? Number(value) : null; const { error: e } = await supabase.from("orchard_nursery_batches").update({ emerged_count: numeric(item.emerged_count), ready_count: numeric(item.ready_count), transplanted_count: numeric(item.transplanted_count), actual_ready_date: item.actual_ready_date || null, transplant_date: item.transplant_date || null, updated_at: new Date().toISOString() }).eq("id", batch.id); if (e) setError(`${text.saveError}: ${e.message}`); else await loadData(); setSaving(false) }
  async function updateStatus(id: string, status: Batch["status"]) { setSaving(true); const { error: e } = await supabase.from("orchard_nursery_batches").update({ status, updated_at: new Date().toISOString() }).eq("id", id); if (e) setError(`${text.saveError}: ${e.message}`); else await loadData(); setSaving(false) }
  async function remove(table: string, id: string, message: string) { if (!window.confirm(message)) return; setSaving(true); const { error: e } = await supabase.from(table).delete().eq("id", id); if (e) setError(`${text.saveError}: ${e.message}`); else await loadData(); setSaving(false) }

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>} />
    <OrchardNavigation />
    <div className="space-y-6 p-4 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.stock} value={totalStock.toLocaleString(locale)} /><Metric label={text.demand} value={totalDemand.toLocaleString(locale)} /><Metric label={text.shortfall} value={totalShortage.toLocaleString(locale)} danger={totalShortage > 0} /><Metric label={text.movements} value={movements.length.toLocaleString(locale)} /></div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>{text.coverage}</CardTitle><CardDescription>{text.coverageHelp}</CardDescription></CardHeader><CardContent>{coverageRows.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{text.planned}: 0</p> : <div className="space-y-3">{coverageRows.map((row) => <div key={row.label} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{row.label}</p><p className="text-xs text-muted-foreground">{row.stock.toLocaleString(locale)} {text.onHand} · {row.required.toLocaleString(locale)} {text.need}</p></div><Badge variant={row.shortage > 0 ? "destructive" : "secondary"}>{row.shortage > 0 ? `${row.shortage.toLocaleString(locale)} ${text.gap}` : text.covered}</Badge></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>{text.adjustment}</CardTitle><CardDescription>{text.adjustmentHelp}</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={adjustInventory}><Field label={text.seedLot}><Select value={adjustmentForm.seed_lot_id} onValueChange={(value) => setAdjustmentForm((v) => ({ ...v, seed_lot_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{seedLots.map((lot) => <SelectItem key={lot.id} value={lot.id}>{lot.crop_name}{lot.variety ? ` · ${lot.variety}` : ""} · {lot.quantity_seeds.toLocaleString(locale)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.movementType}><Select value={adjustmentForm.movement_type} onValueChange={(value) => setAdjustmentForm((v) => ({ ...v, movement_type: value as AdjustmentType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{adjustmentTypes.map((type) => <SelectItem key={type} value={type}>{titleize(type)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.signedQuantity}><Input type="number" step="1" value={adjustmentForm.quantity_delta} onChange={(e) => setAdjustmentForm((v) => ({ ...v, quantity_delta: e.target.value }))} required /></Field><Field label={text.date}><Input type="date" value={adjustmentForm.occurred_on} onChange={(e) => setAdjustmentForm((v) => ({ ...v, occurred_on: e.target.value }))} /></Field><div className="md:col-span-2"><Field label={text.reason}><Input value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm((v) => ({ ...v, reason: e.target.value }))} /></Field></div><div className="md:col-span-2"><Button type="submit" disabled={saving || seedLots.length === 0}><History className="mr-2 h-4 w-4" />{text.applyAdjustment}</Button></div></form></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>{text.newSeedLot}</CardTitle><CardDescription>{seedLots.length} {text.available}</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={createLot}><Field label={text.crop}><Input value={lotForm.crop_name} onChange={(e) => setLotForm((v) => ({ ...v, crop_name: e.target.value }))} required /></Field><Field label={text.variety}><Input value={lotForm.variety} onChange={(e) => setLotForm((v) => ({ ...v, variety: e.target.value }))} /></Field><Field label={text.lot}><Input value={lotForm.lot_code} onChange={(e) => setLotForm((v) => ({ ...v, lot_code: e.target.value }))} /></Field><Field label={text.supplier}><Input value={lotForm.supplier} onChange={(e) => setLotForm((v) => ({ ...v, supplier: e.target.value }))} /></Field><Field label={text.quantity}><Input type="number" min="0" value={lotForm.quantity_seeds} onChange={(e) => setLotForm((v) => ({ ...v, quantity_seeds: e.target.value }))} /></Field><Field label={text.germination}><Input type="number" min="1" max="100" step="0.1" value={lotForm.germination_rate_pct} onChange={(e) => setLotForm((v) => ({ ...v, germination_rate_pct: e.target.value }))} /></Field><Field label={text.received}><Input type="date" value={lotForm.received_date} onChange={(e) => setLotForm((v) => ({ ...v, received_date: e.target.value }))} /></Field><Field label={text.expiry}><Input type="date" value={lotForm.expiry_date} onChange={(e) => setLotForm((v) => ({ ...v, expiry_date: e.target.value }))} /></Field><Field label={text.storage}><Input value={lotForm.storage_location} onChange={(e) => setLotForm((v) => ({ ...v, storage_location: e.target.value }))} /></Field><div className="md:col-span-2"><Field label={text.notes}><Textarea value={lotForm.notes} onChange={(e) => setLotForm((v) => ({ ...v, notes: e.target.value }))} /></Field></div><div className="md:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{text.saveLot}</Button></div></form></CardContent></Card>
        <Card><CardHeader><CardTitle>{text.newBatch}</CardTitle><CardDescription>{availableSuccessions.length} {text.planned} · {text.inventoryAuto}</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={createBatch}><Field label={text.succession}><Select value={batchForm.crop_succession_id} onValueChange={(value) => { const item = successionById.get(value); setBatchForm((v) => ({ ...v, crop_succession_id: value, sow_date: item?.planned_sow_date ?? "", expected_ready_date: item?.planned_transplant_date ?? "", cells_sown: item?.planned_plants?.toString() ?? "", seeds_sown: item ? estimatedSeeds(item).toString() : "" })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availableSuccessions.map((item) => <SelectItem key={item.id} value={item.id}>{successionLabel(item)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.seedLot}><Select value={batchForm.seed_lot_id} onValueChange={(value) => setBatchForm((v) => ({ ...v, seed_lot_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{text.none}</SelectItem>{seedLots.map((lot) => <SelectItem key={lot.id} value={lot.id}>{lot.crop_name}{lot.variety ? ` · ${lot.variety}` : ""}{lot.lot_code ? ` · ${lot.lot_code}` : ""} · {lot.quantity_seeds.toLocaleString(locale)} {text.onHand}</SelectItem>)}</SelectContent></Select></Field><Field label={text.sowDate}><Input type="date" value={batchForm.sow_date} onChange={(e) => setBatchForm((v) => ({ ...v, sow_date: e.target.value }))} required /></Field><Field label={text.expectedReady}><Input type="date" value={batchForm.expected_ready_date} onChange={(e) => setBatchForm((v) => ({ ...v, expected_ready_date: e.target.value }))} /></Field><Field label={text.cells}><Input type="number" min="0" value={batchForm.cells_sown} onChange={(e) => setBatchForm((v) => ({ ...v, cells_sown: e.target.value }))} /></Field><Field label={text.seedsSown}><Input type="number" min="0" value={batchForm.seeds_sown} onChange={(e) => setBatchForm((v) => ({ ...v, seeds_sown: e.target.value }))} /></Field>{selectedLot && <div className="md:col-span-2 rounded-lg border p-3 text-sm"><span className="font-medium">{selectedLot.quantity_seeds.toLocaleString(locale)} {text.onHand}</span>{hasShortage && <span className="ml-3 text-destructive"><AlertTriangle className="mr-1 inline h-4 w-4" />{text.shortage}</span>}</div>}<Field label={text.location}><Input value={batchForm.location} onChange={(e) => setBatchForm((v) => ({ ...v, location: e.target.value }))} /></Field><div className="md:col-span-2"><Field label={text.notes}><Textarea value={batchForm.notes} onChange={(e) => setBatchForm((v) => ({ ...v, notes: e.target.value }))} /></Field></div><div className="md:col-span-2"><Button type="submit" disabled={saving || availableSuccessions.length === 0 || hasShortage}><Sprout className="mr-2 h-4 w-4" />{text.startBatch}</Button></div></form></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>{text.seedLots}</CardTitle></CardHeader><CardContent>{seedLots.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{text.emptyLots}</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{seedLots.map((lot) => { const lotMoves = movements.filter((movement) => movement.seed_lot_id === lot.id).slice(0, 3); return <div key={lot.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{lot.crop_name}{lot.variety ? ` · ${lot.variety}` : ""}</p><p className="text-sm text-muted-foreground">{lot.lot_code || lot.supplier || "—"}</p></div><Button variant="ghost" size="icon" onClick={() => void remove("orchard_seed_lots", lot.id, text.deleteLot)}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary">{lot.quantity_seeds.toLocaleString(locale)} {text.available}</Badge>{lot.germination_rate_pct && <Badge variant="outline">{lot.germination_rate_pct}%</Badge>}</div><p className="mt-3 text-xs text-muted-foreground">{lot.storage_location || ""}{lot.expiry_date ? ` · ${text.expiry}: ${dateLabel(lot.expiry_date, locale)}` : ""}</p>{lotMoves.length > 0 && <div className="mt-3 space-y-1 border-t pt-3">{lotMoves.map((movement) => <div key={movement.id} className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{titleize(movement.movement_type)} · {dateLabel(movement.occurred_on, locale)}</span><span className={movement.quantity_delta < 0 ? "text-destructive" : "font-medium"}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta.toLocaleString(locale)}</span></div>)}</div>}</div> })}</div>}</CardContent></Card>

      <Card><CardHeader><CardTitle>{text.nursery}</CardTitle></CardHeader><CardContent>{loading ? <p className="py-6 text-sm text-muted-foreground">{text.loading}</p> : batches.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{text.emptyBatches}</p> : <div className="space-y-3">{batches.map((batch) => { const succession = successionById.get(batch.crop_succession_id); const lot = batch.seed_lot_id ? seedLotById.get(batch.seed_lot_id) : null; const item = progress[batch.id] ?? { emerged_count: "", ready_count: "", transplanted_count: "", actual_ready_date: "", transplant_date: "" }; return <div key={batch.id} className="rounded-lg border p-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><p className="font-semibold">{succession ? successionLabel(succession) : text.succession}</p><p className="mt-1 text-sm text-muted-foreground">{dateLabel(batch.sow_date, locale)} → {dateLabel(batch.expected_ready_date, locale)}{batch.location ? ` · ${batch.location}` : ""}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{batch.seeds_sown} {text.seedsSown.toLowerCase()}</Badge>{batch.cells_sown != null && <Badge variant="secondary">{batch.cells_sown} {text.cells.toLowerCase()}</Badge>}{lot && <Badge variant="secondary">{text.linkedLot}: {lot.lot_code || lot.crop_name}</Badge>}</div></div><div className="flex gap-2"><Select value={batch.status} onValueChange={(value) => void updateStatus(batch.id, value as Batch["status"])}><SelectTrigger className="w-[155px]"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{titleize(status)}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" onClick={() => void remove("orchard_nursery_batches", batch.id, text.deleteBatch)}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-3 xl:grid-cols-5"><Field label={text.emerged}><Input type="number" min="0" value={item.emerged_count} onChange={(e) => setProgress((p) => ({ ...p, [batch.id]: { ...item, emerged_count: e.target.value } }))} /></Field><Field label={text.ready}><Input type="number" min="0" value={item.ready_count} onChange={(e) => setProgress((p) => ({ ...p, [batch.id]: { ...item, ready_count: e.target.value } }))} /></Field><Field label={text.transplanted}><Input type="number" min="0" value={item.transplanted_count} onChange={(e) => setProgress((p) => ({ ...p, [batch.id]: { ...item, transplanted_count: e.target.value } }))} /></Field><Field label={text.actualReady}><Input type="date" value={item.actual_ready_date} onChange={(e) => setProgress((p) => ({ ...p, [batch.id]: { ...item, actual_ready_date: e.target.value } }))} /></Field><Field label={text.transplantDate}><Input type="date" value={item.transplant_date} onChange={(e) => setProgress((p) => ({ ...p, [batch.id]: { ...item, transplant_date: e.target.value } }))} /></Field></div><Button className="mt-4" variant="outline" onClick={() => void saveProgress(batch)} disabled={saving}>{text.saveCounts}</Button></div> })}</div>}</CardContent></Card>

      <Card><CardHeader><CardTitle>{text.movementHistory}</CardTitle></CardHeader><CardContent>{movements.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{text.noMovements}</p> : <div className="space-y-2">{movements.slice(0, 30).map((movement) => { const lot = seedLotById.get(movement.seed_lot_id); return <div key={movement.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-sm font-medium">{lot ? `${lot.crop_name}${lot.variety ? ` · ${lot.variety}` : ""}` : movement.seed_lot_id}</p><p className="text-xs text-muted-foreground">{titleize(movement.movement_type)} · {dateLabel(movement.occurred_on, locale)}{movement.reason ? ` · ${movement.reason}` : ""}</p></div><div className={`text-sm font-semibold ${movement.quantity_delta < 0 ? "text-destructive" : ""}`}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta.toLocaleString(locale)}</div></div> })}</div>}</CardContent></Card>
    </div>
  </AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p></CardContent></Card> }

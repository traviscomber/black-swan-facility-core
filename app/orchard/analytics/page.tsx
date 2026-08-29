"use client"

import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BarChart3, BookOpen, Plus, RefreshCw, Trash2 } from "lucide-react"
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

type Crop = { id: string; crop_name: string; variety: string | null; status: string; expected_harvest_date: string | null }
type Harvest = { crop_id: string; quantity_harvested: number | null; harvest_unit: string | null }
type Health = { crop_id: string; observation_date: string; severity_level: string | null; pest_type: string | null; disease_name: string | null; treatment_effectiveness: string | null }
type Nursery = { crop_succession_id: string; status: string; ready_count: number | null }
type Note = { id: string; crop_id: string | null; crop_succession_id: string | null; note_type: string; title: string | null; body: string; observed_at: string }
type Succession = { id: string; crop_cycle_id: string; sequence_no: number }
type Cycle = { id: string; crop_name: string; variety: string | null }
type Cue = { level: "attention" | "ready"; title: string; detail: string }

const noteTypes = ["observation", "decision", "lesson", "risk", "follow_up"]
const copy = {
  en: { title: "Notes & Insights", description: "Evidence-based notes, operational charts and deterministic decision support from canonical Orchard records.", refresh: "Refresh", crops: "Live crops", harvests: "Harvest records", health: "Health observations", notesCount: "Notes", harvestChart: "Harvest by crop", statusChart: "Crop status", decisions: "Decision support", decisionHelp: "Rule-based exceptions from recorded dates and states. These are not AI conclusions.", noCues: "No current rule-based exceptions.", notes: "Operational notes", newNote: "Add note", context: "Context", noteType: "Note type", noteTitle: "Title", body: "Note", save: "Save note", emptyNotes: "No operational notes yet.", delete: "Delete this note?", saveError: "Could not save note", loadError: "Could not load Orchard insights", overdue: "Expected harvest date has passed", untreated: "High-severity health observation needs follow-up", nurseryReady: "Nursery batch is ready for field action", noContext: "Select a crop or succession", cropContext: "Crop", successionContext: "Succession", mixedUnits: "Harvest quantities remain separated by recorded unit." },
  es: { title: "Notas e Insights", description: "Notas con evidencia, gráficos operativos y apoyo determinístico a decisiones usando registros canónicos de Orchard.", refresh: "Actualizar", crops: "Cultivos vivos", harvests: "Registros de cosecha", health: "Observaciones sanitarias", notesCount: "Notas", harvestChart: "Cosecha por cultivo", statusChart: "Estado de cultivos", decisions: "Apoyo a decisiones", decisionHelp: "Excepciones basadas en reglas, fechas y estados registrados. No son conclusiones de IA.", noCues: "No hay excepciones actuales basadas en reglas.", notes: "Notas operativas", newNote: "Agregar nota", context: "Contexto", noteType: "Tipo de nota", noteTitle: "Título", body: "Nota", save: "Guardar nota", emptyNotes: "Aún no hay notas operativas.", delete: "¿Eliminar esta nota?", saveError: "No fue posible guardar la nota", loadError: "No fue posible cargar los insights", overdue: "La fecha esperada de cosecha ya pasó", untreated: "Una observación sanitaria de alta severidad requiere seguimiento", nurseryReady: "Un lote de almácigo está listo para acción en terreno", noContext: "Selecciona un cultivo o sucesión", cropContext: "Cultivo", successionContext: "Sucesión", mixedUnits: "Las cantidades de cosecha se mantienen separadas por unidad registrada." },
} as const

export default function OrchardAnalyticsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [crops, setCrops] = useState<Crop[]>([])
  const [harvests, setHarvests] = useState<Harvest[]>([])
  const [health, setHealth] = useState<Health[]>([])
  const [nursery, setNursery] = useState<Nursery[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [successions, setSuccessions] = useState<Succession[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ context: "", note_type: "observation", title: "", body: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [c, h, he, n, no, s, cy] = await Promise.all([
      supabase.from("orchard_crops").select("id, crop_name, variety, status, expected_harvest_date"),
      supabase.from("orchard_harvest_records").select("crop_id, quantity_harvested, harvest_unit"),
      supabase.from("orchard_pest_logs").select("crop_id, observation_date, severity_level, pest_type, disease_name, treatment_effectiveness"),
      supabase.from("orchard_nursery_batches").select("crop_succession_id, status, ready_count"),
      supabase.from("orchard_notes").select("id, crop_id, crop_succession_id, note_type, title, body, observed_at").order("observed_at", { ascending: false }),
      supabase.from("orchard_crop_successions").select("id, crop_cycle_id, sequence_no"),
      supabase.from("orchard_crop_cycles").select("id, crop_name, variety"),
    ])
    const queryError = c.error ?? h.error ?? he.error ?? n.error ?? no.error ?? s.error ?? cy.error
    if (queryError) setError(`${text.loadError}: ${queryError.message}`)
    else {
      setCrops((c.data ?? []) as Crop[])
      setHarvests((h.data ?? []) as Harvest[])
      setHealth((he.data ?? []) as Health[])
      setNursery((n.data ?? []) as Nursery[])
      setNotes((no.data ?? []) as Note[])
      setSuccessions((s.data ?? []) as Succession[])
      setCycles((cy.data ?? []) as Cycle[])
    }
    setLoading(false)
  }, [supabase, text.loadError])

  useEffect(() => { void load() }, [load])

  const cropById = useMemo(() => new Map(crops.map((item) => [item.id, item])), [crops])
  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const cropLabel = (crop: Crop) => `${crop.crop_name}${crop.variety ? ` · ${crop.variety}` : ""}`
  const successionLabel = (id: string) => {
    const succession = successionById.get(id)
    const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null
    return succession && cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${succession.sequence_no}` : id
  }

  const statusCounts = crops.reduce<Record<string, number>>((acc, crop) => ({ ...acc, [crop.status]: (acc[crop.status] ?? 0) + 1 }), {})
  const harvestGroups = harvests.reduce<Record<string, number>>((acc, harvest) => {
    const crop = cropById.get(harvest.crop_id)
    const key = `${crop ? cropLabel(crop) : harvest.crop_id} · ${harvest.harvest_unit || "unit"}`
    acc[key] = (acc[key] ?? 0) + (harvest.quantity_harvested ?? 0)
    return acc
  }, {})

  const cues = useMemo<Cue[]>(() => {
    const today = new Date().toISOString().slice(0, 10)
    const result: Cue[] = []
    crops.filter((crop) => crop.expected_harvest_date && crop.expected_harvest_date < today && !["harvested", "failed"].includes(crop.status)).forEach((crop) => result.push({ level: "attention", title: cropLabel(crop), detail: `${text.overdue}: ${crop.expected_harvest_date}` }))
    health.filter((item) => ["high", "critical"].includes(item.severity_level ?? "") && !["effective", "very_effective"].includes(item.treatment_effectiveness ?? "")).forEach((item) => {
      const crop = cropById.get(item.crop_id)
      result.push({ level: "attention", title: crop ? cropLabel(crop) : text.health, detail: `${text.untreated}: ${item.pest_type || item.disease_name || item.observation_date}` })
    })
    nursery.filter((item) => item.status === "ready").forEach((item) => result.push({ level: "ready", title: successionLabel(item.crop_succession_id), detail: `${text.nurseryReady}${item.ready_count != null ? ` · ${item.ready_count}` : ""}` }))
    return result
  }, [crops, health, nursery, cropById, successionById, cycleById, text.health, text.nurseryReady, text.overdue, text.untreated])

  async function createNote(event: FormEvent) {
    event.preventDefault()
    if (!form.context || !form.body.trim()) return
    const [kind, id] = form.context.split(":")
    setSaving(true)
    const result = await supabase.from("orchard_notes").insert({ crop_id: kind === "crop" ? id : null, crop_succession_id: kind === "succession" ? id : null, note_type: form.note_type, title: form.title.trim() || null, body: form.body.trim() })
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else { setForm({ context: "", note_type: "observation", title: "", body: "" }); await load() }
    setSaving(false)
  }

  async function removeNote(id: string) {
    if (!window.confirm(text.delete)) return
    const result = await supabase.from("orchard_notes").delete().eq("id", id)
    if (result.error) setError(`${text.saveError}: ${result.error.message}`)
    else await load()
  }

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} />
      <OrchardNavigation />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={text.crops} value={crops.length} /><Metric label={text.harvests} value={harvests.length} /><Metric label={text.health} value={health.length} /><Metric label={text.notesCount} value={notes.length} /></div>
        <div className="grid gap-6 xl:grid-cols-2"><ChartCard title={text.harvestChart} help={text.mixedUnits} values={harvestGroups} /><ChartCard title={text.statusChart} values={statusCounts} /></div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{text.decisions}</CardTitle><CardDescription>{text.decisionHelp}</CardDescription></CardHeader>
          <CardContent>{cues.length === 0 ? <p className="text-sm text-muted-foreground">{text.noCues}</p> : <div className="space-y-2">{cues.map((cue, index) => <div key={`${cue.title}-${index}`} className="rounded-md border p-3"><div className="flex items-center gap-2"><Badge variant={cue.level === "attention" ? "destructive" : "secondary"}>{cue.level}</Badge><p className="font-medium">{cue.title}</p></div><p className="mt-1 text-sm text-muted-foreground">{cue.detail}</p></div>)}</div>}</CardContent>
        </Card>
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />{text.newNote}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={createNote}><Field label={text.context}><Select value={form.context} onValueChange={(value) => setForm((current) => ({ ...current, context: value }))}><SelectTrigger><SelectValue placeholder={text.noContext} /></SelectTrigger><SelectContent>{crops.map((crop) => <SelectItem key={`crop:${crop.id}`} value={`crop:${crop.id}`}>{text.cropContext}: {cropLabel(crop)}</SelectItem>)}{successions.map((succession) => <SelectItem key={`succession:${succession.id}`} value={`succession:${succession.id}`}>{text.successionContext}: {successionLabel(succession.id)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.noteType}><Select value={form.note_type} onValueChange={(value) => setForm((current) => ({ ...current, note_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{noteTypes.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field><Field label={text.noteTitle}><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field><Field label={text.body}><Textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} required /></Field><Button type="submit" disabled={saving || !form.context}><Plus className="mr-2 h-4 w-4" />{text.save}</Button></form></CardContent></Card>
          <Card><CardHeader><CardTitle>{text.notes}</CardTitle></CardHeader><CardContent>{loading ? <p>Loading…</p> : notes.length === 0 ? <p className="text-sm text-muted-foreground">{text.emptyNotes}</p> : <div className="space-y-3">{notes.map((note) => { const crop = note.crop_id ? cropById.get(note.crop_id) : null; return <div key={note.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{note.note_type.replaceAll("_", " ")}</Badge><p className="font-semibold">{note.title || (crop ? cropLabel(crop) : note.crop_succession_id ? successionLabel(note.crop_succession_id) : text.notes)}</p></div><p className="mt-2 text-sm">{note.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(note.observed_at).toLocaleString(locale)}</p></div><Button variant="ghost" size="icon" onClick={() => void removeNote(note.id)}><Trash2 className="h-4 w-4" /></Button></div></div> })}</div>}</CardContent></Card>
        </div>
      </div>
    </AppLayout>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card> }
function ChartCard({ title, help, values }: { title: string; help?: string; values: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(values))
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />{title}</CardTitle>{help && <CardDescription>{help}</CardDescription>}</CardHeader><CardContent>{Object.keys(values).length === 0 ? <p className="text-sm text-muted-foreground">—</p> : <div className="space-y-3">{Object.entries(values).sort((a, b) => b[1] - a[1]).map(([label, value]) => <div key={label}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{label}</span><span className="font-medium">{Number(value.toFixed(2))}</span></div><div className="h-2 w-full bg-muted"><div className="h-2 bg-foreground" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} /></div></div>)}</div>}</CardContent></Card>
}

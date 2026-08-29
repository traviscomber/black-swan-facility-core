"use client"

import type { FormEvent, ReactNode } from "react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BarChart3, BookOpen, BrainCircuit, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react"
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
type Cue = { level: "attention" | "ready"; title: string; detail: string; href: string }

const noteTypes = ["observation", "decision", "lesson", "risk", "follow_up"]
const photos = [
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1800&q=92",
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1800&q=92",
  "https://images.unsplash.com/photo-1523742810063-3a319db9b7a2?auto=format&fit=crop&w=1800&q=92",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1800&q=92",
]
const localDateKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const copy = {
  en: { title: "Notes & Insights", description: "Turn field evidence, observations and operational signals into a living farm intelligence workspace.", refresh: "Refresh", crops: "Live crops", harvests: "Harvest records", health: "Health observations", notesCount: "Notes", harvestChart: "Harvest by crop", statusChart: "Crop status", decisions: "Operational cues", decisionHelp: "Record-based cues from explicit dates, states and severities. They are not AI or agronomic conclusions.", noCues: "No current record-based cues.", notes: "Field intelligence journal", newNote: "Capture field intelligence", context: "Context", noteType: "Note type", noteTitle: "Title", body: "Note", save: "Save note", emptyNotes: "No operational notes yet.", delete: "Delete this note?", saveError: "Could not save note", loadError: "Could not load Orchard insights", overdue: "Expected harvest date has passed", highSeverity: "High/critical health observation recorded", nurseryReady: "Nursery batch status is ready", noContext: "Select a crop or succession", cropContext: "Crop", successionContext: "Succession", mixedUnits: "Harvest quantities remain separated by recorded unit.", workspace: "Farm intelligence workspace", workspaceHelp: "Connect what happened in the field with what Orchard knows about harvest, crop status and recorded operational signals.", openCharts: "Open chart studio", openDecisions: "Open decision cockpit" },
  es: { title: "Notas e Insights", description: "Convierte evidencia de terreno, observaciones y señales operativas en un workspace vivo de inteligencia agrícola.", refresh: "Actualizar", crops: "Cultivos vivos", harvests: "Registros de cosecha", health: "Observaciones sanitarias", notesCount: "Notas", harvestChart: "Cosecha por cultivo", statusChart: "Estado de cultivos", decisions: "Señales operativas", decisionHelp: "Señales basadas en fechas, estados y severidades explícitamente registradas. No son conclusiones de IA ni agronómicas.", noCues: "No hay señales actuales basadas en registros.", notes: "Diario de inteligencia de terreno", newNote: "Capturar inteligencia de terreno", context: "Contexto", noteType: "Tipo de nota", noteTitle: "Título", body: "Nota", save: "Guardar nota", emptyNotes: "Aún no hay notas operativas.", delete: "¿Eliminar esta nota?", saveError: "No fue posible guardar la nota", loadError: "No fue posible cargar los insights", overdue: "La fecha esperada de cosecha ya pasó", highSeverity: "Se registró una observación sanitaria alta/crítica", nurseryReady: "El estado del lote de almácigo es ready", noContext: "Selecciona un cultivo o sucesión", cropContext: "Cultivo", successionContext: "Sucesión", mixedUnits: "Las cantidades de cosecha se mantienen separadas por unidad registrada.", workspace: "Workspace de inteligencia agrícola", workspaceHelp: "Conecta lo que pasó en terreno con lo que Orchard sabe de cosecha, estado y señales operativas registradas.", openCharts: "Abrir estudio de gráficos", openDecisions: "Abrir cockpit de decisiones" },
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
    setLoading(true); setError(null)
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
    else { setCrops((c.data ?? []) as Crop[]); setHarvests((h.data ?? []) as Harvest[]); setHealth((he.data ?? []) as Health[]); setNursery((n.data ?? []) as Nursery[]); setNotes((no.data ?? []) as Note[]); setSuccessions((s.data ?? []) as Succession[]); setCycles((cy.data ?? []) as Cycle[]) }
    setLoading(false)
  }, [supabase, text.loadError])
  useEffect(() => { void load() }, [load])

  const cropById = useMemo(() => new Map(crops.map((item) => [item.id, item])), [crops])
  const cycleById = useMemo(() => new Map(cycles.map((item) => [item.id, item])), [cycles])
  const successionById = useMemo(() => new Map(successions.map((item) => [item.id, item])), [successions])
  const cropLabel = (crop: Crop) => `${crop.crop_name}${crop.variety ? ` · ${crop.variety}` : ""}`
  const successionLabel = (id: string) => { const succession = successionById.get(id); const cycle = succession ? cycleById.get(succession.crop_cycle_id) : null; return succession && cycle ? `${cycle.crop_name}${cycle.variety ? ` · ${cycle.variety}` : ""} #${succession.sequence_no}` : id }
  const statusCounts = crops.reduce<Record<string, number>>((acc, crop) => ({ ...acc, [crop.status]: (acc[crop.status] ?? 0) + 1 }), {})
  const harvestGroups = harvests.reduce<Record<string, number>>((acc, harvest) => { const crop = cropById.get(harvest.crop_id); const key = `${crop ? cropLabel(crop) : harvest.crop_id} · ${harvest.harvest_unit || "unit"}`; acc[key] = (acc[key] ?? 0) + (harvest.quantity_harvested ?? 0); return acc }, {})

  const cues = useMemo<Cue[]>(() => {
    const today = localDateKey(); const result: Cue[] = []
    crops.filter((crop) => crop.expected_harvest_date && crop.expected_harvest_date < today && !["harvested", "failed"].includes(crop.status)).forEach((crop) => result.push({ level: "attention", title: cropLabel(crop), detail: `${text.overdue}: ${crop.expected_harvest_date}`, href: "/orchard/harvest" }))
    health.filter((item) => ["high", "critical"].includes(item.severity_level ?? "")).forEach((item) => { const crop = cropById.get(item.crop_id); result.push({ level: "attention", title: crop ? cropLabel(crop) : text.health, detail: `${text.highSeverity}: ${item.pest_type || item.disease_name || item.observation_date}`, href: "/orchard/pests" }) })
    nursery.filter((item) => item.status === "ready").forEach((item) => result.push({ level: "ready", title: successionLabel(item.crop_succession_id), detail: `${text.nurseryReady}${item.ready_count != null ? ` · ${item.ready_count}` : ""}`, href: "/orchard/nursery" }))
    return result
  }, [crops, health, nursery, cropById, successionById, cycleById, text.health, text.highSeverity, text.nurseryReady, text.overdue])

  async function createNote(event: FormEvent) { event.preventDefault(); if (!form.context || !form.body.trim()) return; const [kind, id] = form.context.split(":"); setSaving(true); const result = await supabase.from("orchard_notes").insert({ crop_id: kind === "crop" ? id : null, crop_succession_id: kind === "succession" ? id : null, note_type: form.note_type, title: form.title.trim() || null, body: form.body.trim() }); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else { setForm({ context: "", note_type: "observation", title: "", body: "" }); await load() } setSaving(false) }
  async function removeNote(id: string) { if (!window.confirm(text.delete)) return; const result = await supabase.from("orchard_notes").delete().eq("id", id); if (result.error) setError(`${text.saveError}: ${result.error.message}`); else await load() }

  return <AppLayout>
    <PageHeader title={text.title} description={text.description} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />{text.refresh}</Button>} />
    <OrchardNavigation />
    <div className="space-y-6 p-3 pb-24 sm:p-8">
      {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      <section className="relative overflow-hidden rounded-3xl border bg-black text-white shadow-2xl">
        <img src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=2200&q=95" alt="Field intelligence" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,.94)_0%,rgba(3,7,18,.8)_45%,rgba(3,7,18,.35)_100%)]" />
        <div className="relative grid min-h-[300px] gap-8 p-6 md:p-8 xl:grid-cols-[1.25fr_.75fr] xl:p-10">
          <div className="flex flex-col justify-end"><Badge className="mb-4 w-fit border-white/20 bg-white/10 text-white">{text.workspace}</Badge><h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{text.workspaceHelp}</h2><div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="secondary"><Link href={`/${language}/orchard/charts`}><BarChart3 className="mr-2 h-4 w-4" />{text.openCharts}</Link></Button><Button asChild variant="outline" className="border-white/30 bg-black/20 text-white hover:bg-white/10"><Link href={`/${language}/orchard/decisions`}><BrainCircuit className="mr-2 h-4 w-4" />{text.openDecisions}</Link></Button></div></div>
          <div className="grid grid-cols-2 gap-3 self-end"><Metric label={text.crops} value={crops.length} dark /><Metric label={text.harvests} value={harvests.length} dark /><Metric label={text.health} value={health.length} dark /><Metric label={text.notesCount} value={notes.length} dark /></div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />{text.decisions}</CardTitle><CardDescription>{text.decisionHelp}</CardDescription></CardHeader><CardContent>{cues.length === 0 ? <p className="text-sm text-muted-foreground">{text.noCues}</p> : <div className="grid gap-3 md:grid-cols-2">{cues.map((cue, index) => <Link key={`${cue.title}-${index}`} href={`/${language}${cue.href}`} className="group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:bg-muted/40"><div className="flex items-center gap-2"><Badge variant={cue.level === "attention" ? "destructive" : "secondary"}>{cue.level}</Badge><Sparkles className="h-4 w-4 text-muted-foreground" /></div><p className="mt-3 font-semibold">{cue.title}</p><p className="mt-1 text-sm text-muted-foreground">{cue.detail}</p></Link>)}</div>}</CardContent></Card>
        <div className="grid gap-6"><ChartCard title={text.harvestChart} help={text.mixedUnits} values={harvestGroups} /><ChartCard title={text.statusChart} values={statusCounts} /></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="xl:sticky xl:top-24 xl:h-fit"><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />{text.newNote}</CardTitle><CardDescription>{text.workspaceHelp}</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={createNote}><Field label={text.context}><Select value={form.context} onValueChange={(value) => setForm((current) => ({ ...current, context: value }))}><SelectTrigger><SelectValue placeholder={text.noContext} /></SelectTrigger><SelectContent>{crops.map((crop) => <SelectItem key={`crop:${crop.id}`} value={`crop:${crop.id}`}>{text.cropContext}: {cropLabel(crop)}</SelectItem>)}{successions.map((succession) => <SelectItem key={`succession:${succession.id}`} value={`succession:${succession.id}`}>{text.successionContext}: {successionLabel(succession.id)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.noteType}><Select value={form.note_type} onValueChange={(value) => setForm((current) => ({ ...current, note_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{noteTypes.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field><Field label={text.noteTitle}><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field><Field label={text.body}><Textarea rows={6} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} required /></Field><Button className="w-full" type="submit" disabled={saving || !form.context}><Plus className="mr-2 h-4 w-4" />{text.save}</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle>{text.notes}</CardTitle><CardDescription>{notes.length} {text.notesCount.toLowerCase()}</CardDescription></CardHeader><CardContent>{loading ? <p>Loading…</p> : notes.length === 0 ? <p className="text-sm text-muted-foreground">{text.emptyNotes}</p> : <div className="grid gap-4 md:grid-cols-2">{notes.map((note, index) => { const crop = note.crop_id ? cropById.get(note.crop_id) : null; const context = crop ? cropLabel(crop) : note.crop_succession_id ? successionLabel(note.crop_succession_id) : text.notes; return <article key={note.id} className="group overflow-hidden rounded-2xl border bg-card"><div className="relative h-36 overflow-hidden"><img src={photos[index % photos.length]} alt="Field note" className="h-full w-full object-cover opacity-100 transition duration-500 [filter:none] group-hover:scale-[1.02]" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.75))]" /><div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3"><Badge className="border-white/20 bg-black/45 text-white">{note.note_type.replaceAll("_", " ")}</Badge><span className="text-xs text-white/80">{new Date(note.observed_at).toLocaleDateString(locale)}</span></div></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-muted-foreground">{context}</p><h3 className="mt-1 font-semibold">{note.title || context}</h3></div><Button variant="ghost" size="icon" onClick={() => void removeNote(note.id)}><Trash2 className="h-4 w-4" /></Button></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note.body}</p></div></article> })}</div>}</CardContent></Card>
      </div>
    </div>
  </AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value, dark = false }: { label: string; value: number; dark?: boolean }) { return <div className={dark ? "rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur" : "rounded-2xl border p-4"}><p className={dark ? "text-xs text-white/65" : "text-xs text-muted-foreground"}>{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p></div> }
function ChartCard({ title, help, values }: { title: string; help?: string; values: Record<string, number> }) { const max = Math.max(1, ...Object.values(values)); return <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />{title}</CardTitle>{help && <CardDescription>{help}</CardDescription>}</CardHeader><CardContent>{Object.keys(values).length === 0 ? <p className="text-sm text-muted-foreground">—</p> : <div className="space-y-4">{Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0,8).map(([label, value]) => <div key={label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate">{label}</span><span className="font-medium">{Number(value.toFixed(2))}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} /></div></div>)}</div>}</CardContent></Card> }

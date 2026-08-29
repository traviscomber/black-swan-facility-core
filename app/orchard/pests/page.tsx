"use client"

import Link from "next/link"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bug, Camera, CheckCircle2, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { OrchardEvidence } from "@/components/orchard/orchard-evidence"
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

type Health = { id: string; crop_id: string; observation_date: string; pest_type: string | null; disease_name: string | null; severity_level: string | null; affected_percentage: number | null; treatment_applied: string | null; treatment_date: string | null; treatment_effectiveness: string | null; prevention_methods: string | null; notes: string | null }
type Crop = { id: string; crop_name: string; variety: string | null; status: string; planting_date: string; expected_harvest_date: string | null }
const severity = ["low", "medium", "high", "critical"]
const effectiveness = ["unknown", "ineffective", "partially_effective", "effective", "very_effective"]
const copy = {
  en: { title: "Crop Health", description: "Triage crop-health incidents visually, track treatment progress and keep evidence attached to the crop dossier.", new: "New health observation", crop: "Crop", date: "Observation date", pest: "Pest", disease: "Disease", severity: "Severity", affected: "Affected %", treatment: "Treatment applied", treatmentDate: "Treatment date", effectiveness: "Effectiveness", prevention: "Prevention / follow-up", notes: "Notes", create: "Record observation", refresh: "Refresh", empty: "No crop-health observations yet.", delete: "Delete this health observation?", saveError: "Could not save health observation", followup: "Treatment and follow-up", board: "Incident triage", boardHelp: "Critical and high-severity incidents surface first so treatment and follow-up stay accountable.", incidents: "Incidents", critical: "Critical / high", untreated: "No treatment", resolved: "Effective response", activeCrops: "Active crops", dossier: "Crop dossier", care: "Care journal", evidence: "Field evidence", treatmentStatus: "Treatment status", planted: "Planted", harvest: "Expected harvest" },
  es: { title: "Sanidad", description: "Prioriza incidentes sanitarios visualmente, sigue tratamientos y conserva evidencia dentro del dossier del cultivo.", new: "Nueva observación sanitaria", crop: "Cultivo", date: "Fecha de observación", pest: "Plaga", disease: "Enfermedad", severity: "Severidad", affected: "% afectado", treatment: "Tratamiento aplicado", treatmentDate: "Fecha tratamiento", effectiveness: "Efectividad", prevention: "Prevención / seguimiento", notes: "Notas", create: "Registrar observación", refresh: "Actualizar", empty: "Aún no hay observaciones sanitarias.", delete: "¿Eliminar esta observación sanitaria?", saveError: "No fue posible guardar la observación", followup: "Tratamiento y seguimiento", board: "Triage sanitario", boardHelp: "Los incidentes críticos y altos aparecen primero para mantener tratamiento y seguimiento bajo control.", incidents: "Incidentes", critical: "Críticos / altos", untreated: "Sin tratamiento", resolved: "Respuesta efectiva", activeCrops: "Cultivos activos", dossier: "Dossier del cultivo", care: "Diario de cuidados", evidence: "Evidencia de terreno", treatmentStatus: "Estado tratamiento", planted: "Plantado", harvest: "Cosecha esperada" },
} as const

const image = (id: string, width = 1800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=92`
const HEALTH_HERO = image("photo-1591857177580-dc82b9ac4e1e", 2200)
const HEALTH_PHOTOS = [image("photo-1501004318641-b39e6451bec6"), image("photo-1416879595882-3373a0480b5b"), image("photo-1523348837708-15d4a09cfac2"), image("photo-1464226184884-fa280b87c399")]
const cropPhoto = (name: string) => {
  const key = name.toLowerCase()
  if (key.includes("tomato")) return image("photo-1592924357228-91a4daadcfea")
  if (key.includes("lettuce")) return image("photo-1622206151226-18ca2c9ab4a1")
  if (key.includes("carrot")) return image("photo-1447175008436-054170c2e979")
  if (key.includes("basil")) return image("photo-1618375569909-3c8616cf7733")
  return HEALTH_PHOTOS[Math.abs(name.length) % HEALTH_PHOTOS.length]
}
function localDateKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const severityRank = (value: string | null) => value === "critical" ? 4 : value === "high" ? 3 : value === "medium" ? 2 : value === "low" ? 1 : 0

export default function OrchardPestsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language === "es" ? "es" : "en"
  const text = copy[lang]
  const locale = lang === "es" ? "es-CL" : "en-US"
  const [logs, setLogs] = useState<Health[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const emptyForm = () => ({ crop_id: "", observation_date: localDateKey(), pest_type: "", disease_name: "", severity_level: "medium", affected_percentage: "", treatment_applied: "", treatment_date: "", treatment_effectiveness: "unknown", prevention_methods: "", notes: "" })
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    const [l, c] = await Promise.all([
      supabase.from("orchard_pest_logs").select("*").order("observation_date", { ascending: false }),
      supabase.from("orchard_crops").select("id,crop_name,variety,status,planting_date,expected_harvest_date").order("crop_name"),
    ])
    const e = l.error ?? c.error
    if (e) setError(e.message)
    else { setLogs((l.data ?? []) as Health[]); setCrops((c.data ?? []) as Crop[]) }
    setLoading(false)
  }, [supabase])
  useEffect(() => { void load() }, [load])

  const cropById = useMemo(() => new Map(crops.map((crop) => [crop.id, crop])), [crops])
  const sortedLogs = useMemo(() => [...logs].sort((a, b) => severityRank(b.severity_level) - severityRank(a.severity_level) || b.observation_date.localeCompare(a.observation_date)), [logs])
  const critical = logs.filter((log) => log.severity_level === "critical" || log.severity_level === "high").length
  const untreated = logs.filter((log) => !log.treatment_applied).length
  const resolved = logs.filter((log) => log.treatment_effectiveness === "effective" || log.treatment_effectiveness === "very_effective").length
  const activeCrops = crops.filter((crop) => !["harvested", "failed"].includes(crop.status)).length

  async function create(event: FormEvent) {
    event.preventDefault(); if (!form.crop_id || !form.observation_date) return
    setSaving(true); setError(null)
    const { error: e } = await supabase.from("orchard_pest_logs").insert({ crop_id: form.crop_id, observation_date: form.observation_date, pest_type: form.pest_type.trim() || null, disease_name: form.disease_name.trim() || null, severity_level: form.severity_level, affected_percentage: form.affected_percentage ? Number(form.affected_percentage) : null, treatment_applied: form.treatment_applied.trim() || null, treatment_date: form.treatment_date || null, treatment_effectiveness: form.treatment_effectiveness === "unknown" ? null : form.treatment_effectiveness, prevention_methods: form.prevention_methods.trim() || null, notes: form.notes.trim() || null })
    if (e) setError(`${text.saveError}: ${e.message}`)
    else { setForm(emptyForm()); await load() }
    setSaving(false)
  }
  async function update(id: string, changes: Partial<Health>) { setSaving(true); const { error: e } = await supabase.from("orchard_pest_logs").update(changes).eq("id", id); if (e) setError(`${text.saveError}: ${e.message}`); else await load(); setSaving(false) }
  async function remove(id: string) {
    if (!window.confirm(text.delete)) return
    const evidence = await supabase.from("orchard_field_evidence").select("storage_path").eq("pest_log_id", id)
    if (evidence.error) { setError(`${text.saveError}: ${evidence.error.message}`); return }
    const paths = (evidence.data ?? []).map((item) => item.storage_path as string)
    if (paths.length > 0) { const stored = await supabase.storage.from("orchard-evidence").remove(paths); if (stored.error) { setError(`${text.saveError}: ${stored.error.message}`); return } }
    const { error: e } = await supabase.from("orchard_pest_logs").delete().eq("id", id)
    if (e) setError(`${text.saveError}: ${e.message}`); else await load()
  }

  return <AppLayout><OrchardNavigation /><main className="mx-auto w-full max-w-[1560px] space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
    <section className="relative min-h-[360px] overflow-hidden bg-neutral-950 text-white sm:min-h-[420px]">
      <img src={HEALTH_HERO} alt="Healthy crop leaves under field inspection" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(10,6,5,.94) 0%,rgba(10,6,5,.66) 54%,rgba(10,6,5,.18) 100%),linear-gradient(0deg,rgba(10,6,5,.76),rgba(10,6,5,.06) 62%)" }} />
      <div className="relative flex min-h-[360px] max-w-3xl flex-col justify-end p-6 sm:min-h-[420px] sm:p-10"><p className="text-xs uppercase tracking-[.2em] text-orange-200">Orchard · Crop protection</p><h1 className="mt-3 text-4xl font-medium tracking-[-.03em] sm:text-5xl">{text.title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/75">{text.description}</p><div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => void load()} disabled={loading} className="bg-white text-black hover:bg-white/90"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{critical} {text.critical.toLowerCase()}</Badge></div></div>
      <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric label={text.incidents} value={logs.length}/><HeroMetric label={text.critical} value={critical}/><HeroMetric label={text.untreated} value={untreated}/><HeroMetric label={text.resolved} value={resolved}/></div>
    </section>

    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

    <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <Card className="self-start"><CardHeader><CardTitle>{text.new}</CardTitle><CardDescription>{text.boardHelp}</CardDescription></CardHeader><CardContent><form onSubmit={create} className="space-y-4"><Field label={text.crop}><Select value={form.crop_id} onValueChange={(v) => setForm((f) => ({ ...f, crop_id: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{crops.map((c) => <SelectItem key={c.id} value={c.id}>{c.crop_name}{c.variety ? ` · ${c.variety}` : ""}</SelectItem>)}</SelectContent></Select></Field><div className="grid grid-cols-2 gap-3"><Field label={text.date}><Input type="date" value={form.observation_date} onChange={(e) => setForm((f) => ({ ...f, observation_date: e.target.value }))} required /></Field><Field label={text.severity}><Select value={form.severity_level} onValueChange={(v) => setForm((f) => ({ ...f, severity_level: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{severity.map((s) => <SelectItem key={s} value={s}>{titleize(s)}</SelectItem>)}</SelectContent></Select></Field></div><Field label={text.affected}><Input type="number" min="0" max="100" step="0.1" value={form.affected_percentage} onChange={(e) => setForm((f) => ({ ...f, affected_percentage: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-3"><Field label={text.pest}><Input value={form.pest_type} onChange={(e) => setForm((f) => ({ ...f, pest_type: e.target.value }))} /></Field><Field label={text.disease}><Input value={form.disease_name} onChange={(e) => setForm((f) => ({ ...f, disease_name: e.target.value }))} /></Field></div><Field label={text.notes}><Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field><details className="border p-3"><summary className="cursor-pointer text-sm font-medium">{text.followup}</summary><div className="mt-4 space-y-3"><Field label={text.treatmentDate}><Input type="date" value={form.treatment_date} onChange={(e) => setForm((f) => ({ ...f, treatment_date: e.target.value }))} /></Field><Field label={text.effectiveness}><Select value={form.treatment_effectiveness} onValueChange={(v) => setForm((f) => ({ ...f, treatment_effectiveness: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{effectiveness.map((s) => <SelectItem key={s} value={s}>{titleize(s)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.treatment}><Textarea rows={3} value={form.treatment_applied} onChange={(e) => setForm((f) => ({ ...f, treatment_applied: e.target.value }))} /></Field><Field label={text.prevention}><Textarea rows={3} value={form.prevention_methods} onChange={(e) => setForm((f) => ({ ...f, prevention_methods: e.target.value }))} /></Field></div></details><Button className="w-full" type="submit" disabled={saving || crops.length === 0}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></form></CardContent></Card>

      <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01</p><h2 className="mt-2">{text.board}</h2><p className="mt-1 text-sm text-muted-foreground">{text.boardHelp}</p></div><Badge variant="outline">{activeCrops} {text.activeCrops.toLowerCase()}</Badge></div>
        {logs.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{text.empty}</div> : <div className="grid gap-4 lg:grid-cols-2">{sortedLogs.map((log) => { const crop = cropById.get(log.crop_id); const high = log.severity_level === "critical" || log.severity_level === "high"; const treated = Boolean(log.treatment_applied); const effective = log.treatment_effectiveness === "effective" || log.treatment_effectiveness === "very_effective"; return <article key={log.id} className="overflow-hidden border bg-background"><div className="relative h-48 overflow-hidden"><img src={cropPhoto(crop?.crop_name ?? "crop")} alt={crop?.crop_name ?? "Crop health"} className="h-full w-full object-cover opacity-100 [filter:none]"/><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.84)_0%,rgba(0,0,0,.08)_76%)]"/><div className="absolute left-4 top-4 flex gap-2"><Badge variant={high ? "destructive" : "secondary"}>{titleize(log.severity_level ?? "unknown")}</Badge>{log.affected_percentage != null && <Badge className="border-white/20 bg-black/40 text-white">{log.affected_percentage}%</Badge>}</div><div className="absolute inset-x-4 bottom-4 text-white"><p className="text-xs uppercase tracking-[.14em] text-white/60">{crop?.crop_name ?? "Crop"}{crop?.variety ? ` · ${crop.variety}` : ""}</p><h3 className="mt-1 text-xl text-white!">{log.pest_type || log.disease_name || text.title}</h3><p className="mt-1 text-xs text-white/70">{new Date(`${log.observation_date}T12:00:00`).toLocaleDateString(locale)}</p></div></div><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-2"><StatusDatum icon={high ? <AlertTriangle className="h-4 w-4"/> : <Bug className="h-4 w-4"/>} label={text.severity} value={titleize(log.severity_level ?? "unknown")}/><StatusDatum icon={effective ? <CheckCircle2 className="h-4 w-4"/> : <ShieldAlert className="h-4 w-4"/>} label={text.treatmentStatus} value={effective ? text.resolved : treated ? titleize(log.treatment_effectiveness ?? "unknown") : text.untreated}/><StatusDatum icon={<Bug className="h-4 w-4"/>} label={text.planted} value={crop?.planting_date ?? "—"}/><StatusDatum icon={<ShieldAlert className="h-4 w-4"/>} label={text.harvest} value={crop?.expected_harvest_date ?? "—"}/></div>{log.notes && <p className="text-sm leading-6 text-muted-foreground">{log.notes}</p>}<details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">{text.followup}</summary><div className="mt-3 grid gap-3"><Field label={text.treatment}><Textarea defaultValue={log.treatment_applied ?? ""} onBlur={(e) => void update(log.id, { treatment_applied: e.target.value || null })}/></Field><Field label={text.effectiveness}><Select value={log.treatment_effectiveness ?? "unknown"} onValueChange={(v) => void update(log.id, { treatment_effectiveness: v === "unknown" ? null : v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{effectiveness.map((s) => <SelectItem key={s} value={s}>{titleize(s)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.notes}><Textarea defaultValue={log.notes ?? ""} onBlur={(e) => void update(log.id, { notes: e.target.value || null })}/></Field></div></details><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/${language}/orchard/crops`}>{text.dossier}</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/${language}/orchard/care`}>{text.care}</Link></Button><Button size="icon" variant="ghost" className="ml-auto" onClick={() => void remove(log.id)}><Trash2 className="h-4 w-4"/></Button></div><div className="border-t pt-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Camera className="h-3.5 w-3.5"/>{text.evidence}</div><OrchardEvidence cropId={log.crop_id} pestLogId={log.id}/></div></div></article> })}</div>}
      </div>
    </section>
  </main></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="min-w-32 bg-black/45 px-5 py-4 text-white"><p className="text-[10px] uppercase tracking-[.14em] text-white/55">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{value}</p></div> }
function StatusDatum({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><p className="mt-1 text-sm font-medium">{value}</p></div> }

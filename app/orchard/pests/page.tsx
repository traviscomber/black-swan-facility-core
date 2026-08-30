"use client"

import Link from "next/link"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bug, Camera, CheckCircle2, Plus, RefreshCw, ShieldAlert, Sparkles, Trash2 } from "lucide-react"
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
import {
  ALL_GAME_PLANS,
  gamePlanScopeLabel,
  resolveRequestedGamePlanId,
  resolveSelectedGamePlan,
  scopeGamePlanGraph,
  withGamePlanQuery,
  type OrchardGamePlanRef,
} from "@/lib/orchard/game-plan-scope"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Health = { id: string; crop_id: string; observation_date: string; pest_type: string | null; disease_name: string | null; severity_level: string | null; affected_percentage: number | null; treatment_applied: string | null; treatment_date: string | null; treatment_effectiveness: string | null; prevention_methods: string | null; notes: string | null }
type Crop = { id: string; crop_name: string; variety: string | null; status: string; planting_date: string; expected_harvest_date: string | null; crop_succession_id: string | null }
type Cycle = { id: string; game_plan_id: string }
type Succession = { id: string; crop_cycle_id: string }
const severity = ["low", "medium", "high", "critical"] as const
const effectiveness = ["unknown", "ineffective", "partially_effective", "effective", "very_effective"] as const
const severityLabels = {
  en: { low: "Low", medium: "Medium", high: "High", critical: "Critical", unknown: "Unknown" },
  es: { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica", unknown: "Desconocida" },
  de: { low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch", unknown: "Unbekannt" },
} as const
const effectivenessLabels = {
  en: { unknown: "Unknown", ineffective: "Ineffective", partially_effective: "Partially effective", effective: "Effective", very_effective: "Very effective" },
  es: { unknown: "Desconocida", ineffective: "Inefectiva", partially_effective: "Parcialmente efectiva", effective: "Efectiva", very_effective: "Muy efectiva" },
  de: { unknown: "Unbekannt", ineffective: "Unwirksam", partially_effective: "Teilweise wirksam", effective: "Wirksam", very_effective: "Sehr wirksam" },
} as const
const locales = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const copy = {
  en: { title: "Crop Health", description: "Review recorded crop-health observations, treatment details and field evidence without inferring unresolved incident state.", new: "New health observation", crop: "Crop", date: "Observation date", pest: "Pest", disease: "Disease", severity: "Recorded severity", affected: "Affected %", treatment: "Treatment applied", treatmentDate: "Treatment date", effectiveness: "Recorded effectiveness", prevention: "Prevention / follow-up", notes: "Notes", create: "Record observation", refresh: "Refresh", empty: "No crop-health observations yet.", delete: "Delete this health observation?", saveError: "Could not save health observation", followup: "Treatment and follow-up", board: "Observation review", boardHelp: "Observations are ordered by recorded severity and date. Severity and treatment fields describe the record; they do not imply that an issue is still open.", observations: "Observations", highSeverity: "High / critical", noTreatment: "No treatment recorded", effectiveResponse: "Effective response recorded", activeCrops: "Active crops", dossier: "Crop dossier", care: "Care journal", evidence: "Field evidence", treatmentStatus: "Treatment record", planted: "Planted", harvest: "Expected harvest", scope: "Game Plan scope", all: "All Orchard", scopedHelp: "Health observations and crop choices are limited to crops linked to this Game Plan.", aiCreated: "Created by Orchard AI · focused record", heroEyebrow: "Orchard · Crop protection", heroAlt: "Healthy crop leaves under field inspection", cropFallback: "Crop", healthFallback: "Crop health" },
  es: { title: "Sanidad", description: "Revisa observaciones sanitarias registradas, tratamientos y evidencia de terreno sin inferir que un incidente siga abierto.", new: "Nueva observación sanitaria", crop: "Cultivo", date: "Fecha de observación", pest: "Plaga", disease: "Enfermedad", severity: "Severidad registrada", affected: "% afectado", treatment: "Tratamiento aplicado", treatmentDate: "Fecha tratamiento", effectiveness: "Efectividad registrada", prevention: "Prevención / seguimiento", notes: "Notas", create: "Registrar observación", refresh: "Actualizar", empty: "Aún no hay observaciones sanitarias.", delete: "¿Eliminar esta observación sanitaria?", saveError: "No fue posible guardar la observación", followup: "Tratamiento y seguimiento", board: "Revisión de observaciones", boardHelp: "Las observaciones se ordenan por severidad registrada y fecha. La severidad y el tratamiento describen el registro; no implican que el problema siga abierto.", observations: "Observaciones", highSeverity: "Altas / críticas", noTreatment: "Sin tratamiento registrado", effectiveResponse: "Respuesta efectiva registrada", activeCrops: "Cultivos activos", dossier: "Dossier del cultivo", care: "Diario de cuidados", evidence: "Evidencia de terreno", treatmentStatus: "Registro de tratamiento", planted: "Plantado", harvest: "Cosecha esperada", scope: "Alcance del Game Plan", all: "Todo Orchard", scopedHelp: "Las observaciones sanitarias y las opciones de cultivo se limitan a cultivos vinculados a este Game Plan.", aiCreated: "Creado por Orchard AI · registro enfocado", heroEyebrow: "Orchard · Protección de cultivos", heroAlt: "Hojas sanas bajo inspección en terreno", cropFallback: "Cultivo", healthFallback: "Sanidad del cultivo" },
  de: { title: "Pflanzengesundheit", description: "Prüfe erfasste Gesundheitsbeobachtungen, Behandlungsdetails und Feldnachweise, ohne daraus einen offenen Vorfall abzuleiten.", new: "Neue Gesundheitsbeobachtung", crop: "Kultur", date: "Beobachtungsdatum", pest: "Schädling", disease: "Krankheit", severity: "Erfasste Schwere", affected: "Betroffen %", treatment: "Angewandte Behandlung", treatmentDate: "Behandlungsdatum", effectiveness: "Erfasste Wirksamkeit", prevention: "Prävention / Nachverfolgung", notes: "Notizen", create: "Beobachtung erfassen", refresh: "Aktualisieren", empty: "Noch keine Beobachtungen zur Pflanzengesundheit.", delete: "Diese Gesundheitsbeobachtung löschen?", saveError: "Gesundheitsbeobachtung konnte nicht gespeichert werden", followup: "Behandlung und Nachverfolgung", board: "Beobachtungsübersicht", boardHelp: "Beobachtungen sind nach erfasster Schwere und Datum sortiert. Schwere und Behandlung beschreiben den Datensatz; sie bedeuten nicht automatisch, dass ein Problem noch offen ist.", observations: "Beobachtungen", highSeverity: "Hoch / kritisch", noTreatment: "Keine Behandlung erfasst", effectiveResponse: "Wirksame Reaktion erfasst", activeCrops: "Aktive Kulturen", dossier: "Kulturakte", care: "Pflegejournal", evidence: "Feldnachweise", treatmentStatus: "Behandlungsstatus", planted: "Gepflanzt", harvest: "Erwartete Ernte", scope: "Game-Plan-Umfang", all: "Gesamter Orchard", scopedHelp: "Gesundheitsbeobachtungen und auswählbare Kulturen sind auf Kulturen dieses Game Plans begrenzt.", aiCreated: "Von Orchard AI erstellt · fokussierter Eintrag", heroEyebrow: "Orchard · Pflanzenschutz", heroAlt: "Gesunde Blätter bei einer Feldkontrolle", cropFallback: "Kultur", healthFallback: "Pflanzengesundheit" },
} as const

const image = (id: string, width = 1800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=92`
const HEALTH_HERO = image("photo-1591857177580-dc82b9ac4e1e", 2200)
const GENERIC_CROP_PHOTO = image("photo-1416879595882-3373a0480b5b")
const CROP_PHOTOS: Array<{ match: string[]; src: string }> = [
  { match: ["tomato", "tomate"], src: image("photo-1592924357228-91a4daadcfea") },
  { match: ["lettuce", "lechuga"], src: image("photo-1622206151226-18ca2c9ab4a1") },
  { match: ["carrot", "zanahoria"], src: image("photo-1447175008436-054170c2e979") },
  { match: ["basil", "albahaca"], src: image("photo-1618375569909-3c8616cf7733") },
  { match: ["radish", "rabanito", "rábano"], src: image("photo-1582284540020-8acbe03f4924") },
  { match: ["onion", "cebolla"], src: image("photo-1508747703725-719777637510") },
  { match: ["spinach", "espinaca"], src: image("photo-1576045057995-568f588f82fb") },
  { match: ["arugula", "rocket", "rúcula", "rucula"], src: image("photo-1501004318641-b39e6451bec6") },
  { match: ["potato", "papa", "patata"], src: image("photo-1518977676601-b53f82aba655") },
  { match: ["beet", "beetroot", "betarraga", "remolacha"], src: image("photo-1593105544559-ecb03bf76f82") },
  { match: ["pepper", "pimentón", "pimenton", "capsicum"], src: image("photo-1563565375-f3fdfdbefa83") },
  { match: ["zucchini", "courgette", "zapallo italiano"], src: image("photo-1563252722-6434563a985d") },
]
const cropPhoto = (name: string) => {
  const key = name.trim().toLowerCase()
  return CROP_PHOTOS.find(({ match }) => match.some((term) => key.includes(term)))?.src ?? GENERIC_CROP_PHOTO
}
function localDateKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const severityRank = (value: string | null) => value === "critical" ? 4 : value === "high" ? 3 : value === "medium" ? 2 : value === "low" ? 1 : 0

export default function OrchardPestsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const lang = language; const text = copy[lang]; const locale = locales[lang]
  const severityLabel = (value: string | null) => severityLabels[lang][(value ?? "unknown") as keyof typeof severityLabels.en] ?? value ?? severityLabels[lang].unknown
  const effectivenessLabel = (value: string | null) => effectivenessLabels[lang][(value ?? "unknown") as keyof typeof effectivenessLabels.en] ?? value ?? effectivenessLabels[lang].unknown
  const [logs, setLogs] = useState<Health[]>([]); const [crops, setCrops] = useState<Crop[]>([]); const [plans, setPlans] = useState<OrchardGamePlanRef[]>([]); const [cycles, setCycles] = useState<Cycle[]>([]); const [successions, setSuccessions] = useState<Succession[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL_GAME_PLANS); const [focusedEntity, setFocusedEntity] = useState<string | null>(null)
  const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const emptyForm = () => ({ crop_id: "", observation_date: localDateKey(), pest_type: "", disease_name: "", severity_level: "medium", affected_percentage: "", treatment_applied: "", treatment_date: "", treatment_effectiveness: "unknown", prevention_methods: "", notes: "" })
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get("from") === "orchard-ai") setFocusedEntity(params.get("entity")) }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [l, c, gp, cy, s] = await Promise.all([
      supabase.from("orchard_pest_logs").select("*").order("observation_date", { ascending: false }),
      supabase.from("orchard_crops").select("id,crop_name,variety,status,planting_date,expected_harvest_date,crop_succession_id").order("crop_name"),
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
    ])
    const e = l.error ?? c.error ?? gp.error ?? cy.error ?? s.error
    if (e) setError(e.message)
    else {
      const nextPlans = (gp.data ?? []) as OrchardGamePlanRef[]
      setLogs((l.data ?? []) as Health[]); setCrops((c.data ?? []) as Crop[]); setPlans(nextPlans); setCycles((cy.data ?? []) as Cycle[]); setSuccessions((s.data ?? []) as Succession[])
      setSelectedPlanId(resolveRequestedGamePlanId(nextPlans, window.location.search))
    }
    setLoading(false)
  }, [supabase])
  useEffect(() => { void load() }, [load])

  const selectedPlan = useMemo(() => resolveSelectedGamePlan(plans, selectedPlanId), [plans, selectedPlanId])
  const { successionIds } = useMemo(() => scopeGamePlanGraph(cycles, successions, selectedPlanId), [cycles, successions, selectedPlanId])
  const scopedCrops = useMemo(() => selectedPlanId === ALL_GAME_PLANS ? crops : crops.filter((crop) => Boolean(crop.crop_succession_id && successionIds.has(crop.crop_succession_id))), [crops, selectedPlanId, successionIds])
  const scopedCropIds = useMemo(() => new Set(scopedCrops.map((crop) => crop.id)), [scopedCrops])
  const scopedLogs = useMemo(() => selectedPlanId === ALL_GAME_PLANS ? logs : logs.filter((log) => scopedCropIds.has(log.crop_id)), [logs, selectedPlanId, scopedCropIds])
  const cropById = useMemo(() => new Map(scopedCrops.map((crop) => [crop.id, crop])), [scopedCrops])
  const sortedLogs = useMemo(() => [...scopedLogs].sort((a, b) => severityRank(b.severity_level) - severityRank(a.severity_level) || b.observation_date.localeCompare(a.observation_date)), [scopedLogs])
  const highSeverityCount = scopedLogs.filter((log) => log.severity_level === "critical" || log.severity_level === "high").length
  const noTreatmentCount = scopedLogs.filter((log) => !log.treatment_applied).length
  const effectiveResponseCount = scopedLogs.filter((log) => log.treatment_effectiveness === "effective" || log.treatment_effectiveness === "very_effective").length
  const activeCrops = scopedCrops.filter((crop) => !["harvested", "failed"].includes(crop.status)).length
  const scopeLabel = gamePlanScopeLabel(selectedPlan, text.all)
  const scopedHref = useCallback((path: string) => withGamePlanQuery(`/${language}${path}`, selectedPlanId), [language, selectedPlanId])

  useEffect(() => { if (loading || !focusedEntity || !scopedLogs.some((log) => log.id === focusedEntity)) return; window.setTimeout(() => document.getElementById(`health-${focusedEntity}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120) }, [loading, focusedEntity, scopedLogs])

  async function create(event: FormEvent) {
    event.preventDefault(); if (!form.crop_id || !form.observation_date) return
    if (!scopedCropIds.has(form.crop_id)) { setError(text.saveError); return }
    setSaving(true); setError(null)
    const { error: e } = await supabase.from("orchard_pest_logs").insert({ crop_id: form.crop_id, observation_date: form.observation_date, pest_type: form.pest_type.trim() || null, disease_name: form.disease_name.trim() || null, severity_level: form.severity_level, affected_percentage: form.affected_percentage ? Number(form.affected_percentage) : null, treatment_applied: form.treatment_applied.trim() || null, treatment_date: form.treatment_date || null, treatment_effectiveness: form.treatment_effectiveness === "unknown" ? null : form.treatment_effectiveness, prevention_methods: form.prevention_methods.trim() || null, notes: form.notes.trim() || null })
    if (e) setError(`${text.saveError}: ${e.message}`); else { setForm(emptyForm()); await load() }
    setSaving(false)
  }
  async function update(id: string, changes: Partial<Health>) { if (!scopedLogs.some((log) => log.id === id)) return; setSaving(true); const { error: e } = await supabase.from("orchard_pest_logs").update(changes).eq("id", id); if (e) setError(`${text.saveError}: ${e.message}`); else await load(); setSaving(false) }
  async function remove(id: string) {
    if (!scopedLogs.some((log) => log.id === id) || !window.confirm(text.delete)) return
    const evidence = await supabase.from("orchard_field_evidence").select("storage_path").eq("pest_log_id", id)
    if (evidence.error) { setError(`${text.saveError}: ${evidence.error.message}`); return }
    const paths = (evidence.data ?? []).map((item) => item.storage_path as string)
    if (paths.length > 0) { const stored = await supabase.storage.from("orchard-evidence").remove(paths); if (stored.error) { setError(`${text.saveError}: ${stored.error.message}`); return } }
    const { error: e } = await supabase.from("orchard_pest_logs").delete().eq("id", id)
    if (e) setError(`${text.saveError}: ${e.message}`); else await load()
  }

  return <AppLayout><OrchardNavigation /><main className="mx-auto w-full max-w-[1560px] space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
    <section className="relative min-h-[360px] overflow-hidden bg-neutral-950 text-white sm:min-h-[420px]">
      <img src={HEALTH_HERO} alt={text.heroAlt} className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(10,6,5,.94) 0%,rgba(10,6,5,.66) 54%,rgba(10,6,5,.18) 100%),linear-gradient(0deg,rgba(10,6,5,.76),rgba(10,6,5,.06) 62%)" }} />
      <div className="relative flex min-h-[360px] max-w-3xl flex-col justify-end p-6 sm:min-h-[420px] sm:p-10"><p className="text-xs uppercase tracking-[.2em] text-orange-200">{text.heroEyebrow}</p><h1 className="mt-3 text-4xl font-medium tracking-[-.03em] sm:text-5xl">{text.title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/75">{text.description}</p><div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => void load()} disabled={loading} className="bg-white text-black hover:bg-white/90"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{highSeverityCount} {text.highSeverity.toLowerCase()}</Badge><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{text.scope}: {scopeLabel}</Badge></div></div>
      <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric label={text.observations} value={scopedLogs.length}/><HeroMetric label={text.highSeverity} value={highSeverityCount}/><HeroMetric label={text.noTreatment} value={noTreatmentCount}/><HeroMetric label={text.effectiveResponse} value={effectiveResponseCount}/></div>
    </section>

    {selectedPlan && <div className="border px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">{text.scope}: {scopeLabel}</strong> · {text.scopedHelp}</div>}
    {focusedEntity && scopedLogs.some((log) => log.id === focusedEntity) && <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-4 py-3 text-sm"><Sparkles className="h-4 w-4 text-primary" /><span>{text.aiCreated}</span></div>}
    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

    <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <Card className="self-start"><CardHeader><CardTitle>{text.new}</CardTitle><CardDescription>{text.boardHelp}</CardDescription></CardHeader><CardContent><form onSubmit={create} className="space-y-4"><Field label={text.crop}><Select value={form.crop_id} onValueChange={(v) => setForm((f) => ({ ...f, crop_id: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopedCrops.map((c) => <SelectItem key={c.id} value={c.id}>{c.crop_name}{c.variety ? ` · ${c.variety}` : ""}</SelectItem>)}</SelectContent></Select></Field><div className="grid grid-cols-2 gap-3"><Field label={text.date}><Input type="date" value={form.observation_date} onChange={(e) => setForm((f) => ({ ...f, observation_date: e.target.value }))} required /></Field><Field label={text.severity}><Select value={form.severity_level} onValueChange={(v) => setForm((f) => ({ ...f, severity_level: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{severity.map((s) => <SelectItem key={s} value={s}>{severityLabel(s)}</SelectItem>)}</SelectContent></Select></Field></div><Field label={text.affected}><Input type="number" min="0" max="100" step="0.1" value={form.affected_percentage} onChange={(e) => setForm((f) => ({ ...f, affected_percentage: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-3"><Field label={text.pest}><Input value={form.pest_type} onChange={(e) => setForm((f) => ({ ...f, pest_type: e.target.value }))} /></Field><Field label={text.disease}><Input value={form.disease_name} onChange={(e) => setForm((f) => ({ ...f, disease_name: e.target.value }))} /></Field></div><Field label={text.notes}><Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field><details className="border p-3"><summary className="cursor-pointer text-sm font-medium">{text.followup}</summary><div className="mt-4 space-y-3"><Field label={text.treatmentDate}><Input type="date" value={form.treatment_date} onChange={(e) => setForm((f) => ({ ...f, treatment_date: e.target.value }))} /></Field><Field label={text.effectiveness}><Select value={form.treatment_effectiveness} onValueChange={(v) => setForm((f) => ({ ...f, treatment_effectiveness: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{effectiveness.map((s) => <SelectItem key={s} value={s}>{effectivenessLabel(s)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.treatment}><Textarea rows={3} value={form.treatment_applied} onChange={(e) => setForm((f) => ({ ...f, treatment_applied: e.target.value }))} /></Field><Field label={text.prevention}><Textarea rows={3} value={form.prevention_methods} onChange={(e) => setForm((f) => ({ ...f, prevention_methods: e.target.value }))} /></Field></div></details><Button className="w-full" type="submit" disabled={saving || scopedCrops.length === 0}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></form></CardContent></Card>

      <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01</p><h2 className="mt-2">{text.board}</h2><p className="mt-1 text-sm text-muted-foreground">{text.boardHelp}</p></div><Badge variant="outline">{activeCrops} {text.activeCrops.toLowerCase()}</Badge></div>
        {scopedLogs.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{text.empty}</div> : <div className="grid gap-4 lg:grid-cols-2">{sortedLogs.map((log) => { const crop = cropById.get(log.crop_id); const high = log.severity_level === "critical" || log.severity_level === "high"; const treated = Boolean(log.treatment_applied); const effective = log.treatment_effectiveness === "effective" || log.treatment_effectiveness === "very_effective"; const focused = log.id === focusedEntity; return <article id={`health-${log.id}`} key={log.id} className={`overflow-hidden border bg-background ${focused ? "border-primary ring-2 ring-primary/40" : ""}`}><div className="relative h-48 overflow-hidden"><img src={cropPhoto(crop?.crop_name ?? text.cropFallback)} alt={crop?.crop_name ?? text.healthFallback} className="h-full w-full object-cover opacity-100 [filter:none]"/><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.84)_0%,rgba(0,0,0,.08)_76%)]"/><div className="absolute left-4 top-4 flex gap-2"><Badge variant={high ? "destructive" : "secondary"}>{severityLabel(log.severity_level)}</Badge>{log.affected_percentage != null && <Badge className="border-white/20 bg-black/40 text-white">{log.affected_percentage}%</Badge>}{focused && <Badge className="bg-primary text-primary-foreground">Orchard AI</Badge>}</div><div className="absolute inset-x-4 bottom-4 text-white"><p className="text-xs uppercase tracking-[.14em] text-white/60">{crop?.crop_name ?? text.cropFallback}{crop?.variety ? ` · ${crop.variety}` : ""}</p><h3 className="mt-1 text-xl text-white!">{log.pest_type || log.disease_name || text.title}</h3><p className="mt-1 text-xs text-white/70">{new Date(`${log.observation_date}T12:00:00`).toLocaleDateString(locale)}</p></div></div><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-2"><StatusDatum icon={high ? <AlertTriangle className="h-4 w-4"/> : <Bug className="h-4 w-4"/>} label={text.severity} value={severityLabel(log.severity_level)}/><StatusDatum icon={effective ? <CheckCircle2 className="h-4 w-4"/> : <ShieldAlert className="h-4 w-4"/>} label={text.treatmentStatus} value={effective ? text.effectiveResponse : treated ? effectivenessLabel(log.treatment_effectiveness) : text.noTreatment}/><StatusDatum icon={<Bug className="h-4 w-4"/>} label={text.planted} value={crop?.planting_date ?? "—"}/><StatusDatum icon={<ShieldAlert className="h-4 w-4"/>} label={text.harvest} value={crop?.expected_harvest_date ?? "—"}/></div>{log.notes && <p className="text-sm leading-6 text-muted-foreground">{log.notes}</p>}<details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">{text.followup}</summary><div className="mt-3 grid gap-3"><Field label={text.treatment}><Textarea defaultValue={log.treatment_applied ?? ""} onBlur={(e) => void update(log.id, { treatment_applied: e.target.value || null })}/></Field><Field label={text.effectiveness}><Select value={log.treatment_effectiveness ?? "unknown"} onValueChange={(v) => void update(log.id, { treatment_effectiveness: v === "unknown" ? null : v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{effectiveness.map((s) => <SelectItem key={s} value={s}>{effectivenessLabel(s)}</SelectItem>)}</SelectContent></Select></Field><Field label={text.notes}><Textarea defaultValue={log.notes ?? ""} onBlur={(e) => void update(log.id, { notes: e.target.value || null })}/></Field></div></details><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={scopedHref("/orchard/crops")}>{text.dossier}</Link></Button><Button asChild size="sm" variant="outline"><Link href={scopedHref("/orchard/care")}>{text.care}</Link></Button><Button size="icon" variant="ghost" className="ml-auto" aria-label={text.delete} onClick={() => void remove(log.id)}><Trash2 className="h-4 w-4"/></Button></div><div className="border-t pt-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Camera className="h-3.5 w-3.5"/>{text.evidence}</div><OrchardEvidence cropId={log.crop_id} pestLogId={log.id}/></div></div></article> })}</div>}
      </div>
    </section>
  </main></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="min-w-32 bg-black/45 px-5 py-4 text-white"><p className="text-[10px] uppercase tracking-[.14em] text-white/55">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{value}</p></div> }
function StatusDatum({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><p className="mt-1 text-sm font-medium">{value}</p></div> }
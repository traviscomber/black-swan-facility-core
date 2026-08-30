"use client"

import Link from "next/link"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Camera, Droplets, Leaf, Plus, RefreshCw, Sparkles, Sprout, Trash2 } from "lucide-react"
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

type Care = { id: string; crop_id: string; activity_date: string; activity_type: string; hours_spent: number | null; description: string | null; weather_conditions: string | null; temperature_c: number | null; humidity_percent: number | null; observations: string | null }
type Crop = { id: string; crop_name: string; variety: string | null; status: string; planting_date: string; expected_harvest_date: string | null; crop_succession_id: string | null }
type Cycle = { id: string; game_plan_id: string }
type Succession = { id: string; crop_cycle_id: string }
const activityTypes = ["watering", "feeding", "weeding", "pruning", "cultivation", "inspection", "other"] as const
const copy = {
  en: { title: "Crop Care", description: "Run the field-care journal from one visual record of interventions, crop context and evidence.", new: "Record care activity", crop: "Crop", date: "Date", type: "Activity", hours: "Hours", descriptionLabel: "Description", weather: "Weather", temp: "Temperature °C", humidity: "Humidity %", observations: "Observations", create: "Record activity", refresh: "Refresh", empty: "No care activities recorded yet.", delete: "Delete this care record?", saveError: "Could not save care record", advanced: "Optional field details", journal: "Intervention journal", journalHelp: "Every real action stays attached to the crop dossier with time, field context and evidence.", total: "Interventions", today: "Today", active: "Active crops", withCare: "Crops with care", evidence: "Evidence", latest: "Latest intervention", planted: "Planted", harvest: "Expected harvest", openHealth: "Health observations", viewCrop: "Crop dossier", scope: "Game Plan scope", all: "All Orchard", scopedHelp: "Care records and crop choices are limited to crops linked to this Game Plan.", aiCreated: "Created by Orchard AI · focused record" },
  es: { title: "Cuidados", description: "Opera el diario de terreno desde un registro visual de intervenciones, contexto del cultivo y evidencia.", new: "Registrar cuidado", crop: "Cultivo", date: "Fecha", type: "Actividad", hours: "Horas", descriptionLabel: "Descripción", weather: "Clima", temp: "Temperatura °C", humidity: "Humedad %", observations: "Observaciones", create: "Registrar cuidado", refresh: "Actualizar", empty: "Aún no hay actividades de cuidado.", delete: "¿Eliminar este registro de cuidado?", saveError: "No fue posible guardar el cuidado", advanced: "Detalles opcionales de terreno", journal: "Diario de intervenciones", journalHelp: "Cada acción real queda unida al dossier del cultivo con tiempo, contexto de terreno y evidencia.", total: "Intervenciones", today: "Hoy", active: "Cultivos activos", withCare: "Cultivos con cuidados", evidence: "Evidencia", latest: "Última intervención", planted: "Plantado", harvest: "Cosecha esperada", openHealth: "Observaciones sanitarias", viewCrop: "Dossier del cultivo", scope: "Alcance del Game Plan", all: "Todo Orchard", scopedHelp: "Los cuidados y las opciones de cultivo se limitan a cultivos vinculados a este Game Plan.", aiCreated: "Creado por Orchard AI · registro enfocado" },
} as const

const image = (id: string, width = 1800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=92`
const CARE_HERO = image("photo-1464226184884-fa280b87c399", 2200)
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
const titleize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function OrchardCarePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage(); const lang = language === "es" ? "es" : "en"; const text = copy[lang]; const locale = lang === "es" ? "es-CL" : "en-US"
  const [logs, setLogs] = useState<Care[]>([]); const [crops, setCrops] = useState<Crop[]>([]); const [plans, setPlans] = useState<OrchardGamePlanRef[]>([]); const [cycles, setCycles] = useState<Cycle[]>([]); const [successions, setSuccessions] = useState<Succession[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL_GAME_PLANS); const [focusedEntity, setFocusedEntity] = useState<string | null>(null)
  const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const emptyForm = () => ({ crop_id: "", activity_date: localDateKey(), activity_type: "watering", hours_spent: "", description: "", weather_conditions: "", temperature_c: "", humidity_percent: "", observations: "" })
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get("from") === "orchard-ai") setFocusedEntity(params.get("entity")) }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [l, c, gp, cy, s] = await Promise.all([
      supabase.from("orchard_care_logs").select("*").order("activity_date", { ascending: false }),
      supabase.from("orchard_crops").select("id,crop_name,variety,status,planting_date,expected_harvest_date,crop_succession_id").order("crop_name"),
      supabase.from("orchard_game_plans").select("id,name,season,start_date,end_date,status").order("start_date", { ascending: false }),
      supabase.from("orchard_crop_cycles").select("id,game_plan_id"),
      supabase.from("orchard_crop_successions").select("id,crop_cycle_id"),
    ])
    const e = l.error ?? c.error ?? gp.error ?? cy.error ?? s.error
    if (e) setError(e.message)
    else {
      const nextPlans = (gp.data ?? []) as OrchardGamePlanRef[]
      setLogs((l.data ?? []) as Care[]); setCrops((c.data ?? []) as Crop[]); setPlans(nextPlans); setCycles((cy.data ?? []) as Cycle[]); setSuccessions((s.data ?? []) as Succession[])
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
  const scopeLabel = gamePlanScopeLabel(selectedPlan, text.all)
  const scopedHref = useCallback((path: string) => withGamePlanQuery(`/${language}${path}`, selectedPlanId), [language, selectedPlanId])
  const today = localDateKey(); const todayCount = scopedLogs.filter((log) => log.activity_date === today).length; const activeCrops = scopedCrops.filter((crop) => !["harvested", "failed"].includes(crop.status)).length
  const lastByCrop = useMemo(() => { const map = new Map<string, Care>(); scopedLogs.forEach((log) => { if (!map.has(log.crop_id)) map.set(log.crop_id, log) }); return map }, [scopedLogs])

  useEffect(() => { if (loading || !focusedEntity || !scopedLogs.some((log) => log.id === focusedEntity)) return; window.setTimeout(() => document.getElementById(`care-${focusedEntity}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120) }, [loading, focusedEntity, scopedLogs])

  async function create(event: FormEvent) {
    event.preventDefault(); if (!form.crop_id || !form.activity_date || !form.activity_type) return
    if (!scopedCropIds.has(form.crop_id)) { setError(text.saveError); return }
    const n = (v: string) => v ? Number(v) : null
    setSaving(true); setError(null)
    const { error: e } = await supabase.from("orchard_care_logs").insert({ crop_id: form.crop_id, activity_date: form.activity_date, activity_type: form.activity_type, hours_spent: n(form.hours_spent), description: form.description.trim() || null, weather_conditions: form.weather_conditions.trim() || null, temperature_c: n(form.temperature_c), humidity_percent: n(form.humidity_percent), observations: form.observations.trim() || null })
    if (e) setError(`${text.saveError}: ${e.message}`); else { setForm(emptyForm()); await load() }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!scopedLogs.some((log) => log.id === id) || !window.confirm(text.delete)) return
    const evidence = await supabase.from("orchard_field_evidence").select("storage_path").eq("care_log_id", id)
    if (evidence.error) { setError(`${text.saveError}: ${evidence.error.message}`); return }
    const paths = (evidence.data ?? []).map((item) => item.storage_path as string)
    if (paths.length > 0) { const stored = await supabase.storage.from("orchard-evidence").remove(paths); if (stored.error) { setError(`${text.saveError}: ${stored.error.message}`); return } }
    const { error: e } = await supabase.from("orchard_care_logs").delete().eq("id", id)
    if (e) setError(`${text.saveError}: ${e.message}`); else await load()
  }

  return <AppLayout><OrchardNavigation /><main className="mx-auto w-full max-w-[1560px] space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
    <section className="relative min-h-[360px] overflow-hidden bg-neutral-950 text-white sm:min-h-[420px]">
      <img src={CARE_HERO} alt="Hands tending a productive crop row" className="absolute inset-0 h-full w-full object-cover opacity-100 [filter:none]" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(5,8,7,.9) 0%,rgba(5,8,7,.62) 54%,rgba(5,8,7,.18) 100%),linear-gradient(0deg,rgba(5,8,7,.72),rgba(5,8,7,.05) 62%)" }} />
      <div className="relative flex min-h-[360px] max-w-3xl flex-col justify-end p-6 sm:min-h-[420px] sm:p-10"><p className="text-xs uppercase tracking-[.2em] text-emerald-200">Orchard · Operations</p><h1 className="mt-3 text-4xl font-medium tracking-[-.03em] sm:text-5xl">{text.title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/75">{text.description}</p><div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => void load()} disabled={loading} className="bg-white text-black hover:bg-white/90"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{scopedLogs.length} {text.total.toLowerCase()}</Badge><Badge className="border-white/20 bg-black/30 px-3 py-2 text-white">{text.scope}: {scopeLabel}</Badge></div></div>
      <div className="absolute bottom-6 right-6 hidden grid-cols-2 gap-px bg-white/10 lg:grid"><HeroMetric label={text.total} value={scopedLogs.length} /><HeroMetric label={text.today} value={todayCount} /><HeroMetric label={text.active} value={activeCrops} /><HeroMetric label={text.withCare} value={lastByCrop.size} /></div>
    </section>

    {selectedPlan && <div className="border px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">{text.scope}: {scopeLabel}</strong> · {text.scopedHelp}</div>}
    {focusedEntity && scopedLogs.some((log) => log.id === focusedEntity) && <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-4 py-3 text-sm"><Sparkles className="h-4 w-4 text-primary" /><span>{text.aiCreated}</span></div>}
    {error && <Card className="border-destructive/60"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

    <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <Card className="self-start"><CardHeader><CardTitle>{text.new}</CardTitle><CardDescription>{text.journalHelp}</CardDescription></CardHeader><CardContent><form onSubmit={create} className="space-y-4"><Field label={text.crop}><Select value={form.crop_id} onValueChange={(v) => setForm((f) => ({ ...f, crop_id: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopedCrops.map((c) => <SelectItem key={c.id} value={c.id}>{c.crop_name}{c.variety ? ` · ${c.variety}` : ""}</SelectItem>)}</SelectContent></Select></Field><div className="grid grid-cols-2 gap-3"><Field label={text.date}><Input type="date" value={form.activity_date} onChange={(e) => setForm((f) => ({ ...f, activity_date: e.target.value }))} required /></Field><Field label={text.type}><Select value={form.activity_type} onValueChange={(v) => setForm((f) => ({ ...f, activity_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{activityTypes.map((item) => <SelectItem key={item} value={item}>{titleize(item)}</SelectItem>)}</SelectContent></Select></Field></div><Field label={text.hours}><Input type="number" min="0" step="0.1" inputMode="decimal" value={form.hours_spent} onChange={(e) => setForm((f) => ({ ...f, hours_spent: e.target.value }))} /></Field><Field label={text.descriptionLabel}><Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field><Field label={text.observations}><Textarea rows={3} value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} /></Field><details className="border p-3"><summary className="cursor-pointer text-sm font-medium">{text.advanced}</summary><div className="mt-4 grid gap-3"><Field label={text.weather}><Input value={form.weather_conditions} onChange={(e) => setForm((f) => ({ ...f, weather_conditions: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-3"><Field label={text.temp}><Input type="number" step="0.1" value={form.temperature_c} onChange={(e) => setForm((f) => ({ ...f, temperature_c: e.target.value }))} /></Field><Field label={text.humidity}><Input type="number" min="0" max="100" step="0.1" value={form.humidity_percent} onChange={(e) => setForm((f) => ({ ...f, humidity_percent: e.target.value }))} /></Field></div></div></details><Button className="w-full" type="submit" disabled={saving || scopedCrops.length === 0}><Plus className="mr-2 h-4 w-4" />{text.create}</Button></form></CardContent></Card>

      <div className="space-y-6"><div><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">01</p><h2 className="mt-2">{text.journal}</h2><p className="mt-1 text-sm text-muted-foreground">{text.journalHelp}</p></div>
        {scopedLogs.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">{text.empty}</div> : <div className="grid gap-4 lg:grid-cols-2">{scopedLogs.map((log) => { const crop = cropById.get(log.crop_id); const photo = cropPhoto(crop?.crop_name ?? "crop"); const focused = log.id === focusedEntity; return <article id={`care-${log.id}`} key={log.id} className={`overflow-hidden border bg-background ${focused ? "border-primary ring-2 ring-primary/40" : ""}`}><div className="relative h-44 overflow-hidden"><img src={photo} alt={crop?.crop_name ?? "Crop care"} className="h-full w-full object-cover opacity-100 [filter:none]" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.78)_0%,rgba(0,0,0,.08)_75%)]"/><div className="absolute inset-x-4 bottom-4 text-white"><div className="flex flex-wrap gap-2"><Badge className="border-white/20 bg-black/35 text-white">{titleize(log.activity_type)}</Badge><Badge className="border-white/20 bg-black/35 text-white">{crop?.status ?? "—"}</Badge>{focused && <Badge className="bg-primary text-primary-foreground">Orchard AI</Badge>}</div><h3 className="mt-2 text-xl text-white!">{crop?.crop_name ?? "Crop"}{crop?.variety ? ` · ${crop.variety}` : ""}</h3><p className="mt-1 text-xs text-white/70">{new Date(`${log.activity_date}T12:00:00`).toLocaleDateString(locale)}{log.hours_spent != null ? ` · ${log.hours_spent}h` : ""}{log.weather_conditions ? ` · ${log.weather_conditions}` : ""}</p></div></div><div className="space-y-4 p-4"><p className="text-sm leading-6">{log.description || log.observations || "—"}</p><div className="grid grid-cols-2 gap-2 text-xs"><Datum icon={<Sprout className="h-3.5 w-3.5"/>} label={text.planted} value={crop?.planting_date ?? "—"}/><Datum icon={<Leaf className="h-3.5 w-3.5"/>} label={text.harvest} value={crop?.expected_harvest_date ?? "—"}/>{log.temperature_c != null && <Datum icon={<Activity className="h-3.5 w-3.5"/>} label={text.temp} value={`${log.temperature_c}°C`}/>} {log.humidity_percent != null && <Datum icon={<Droplets className="h-3.5 w-3.5"/>} label={text.humidity} value={`${log.humidity_percent}%`}/>}</div><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={scopedHref("/orchard/crops")}>{text.viewCrop}</Link></Button><Button asChild size="sm" variant="outline"><Link href={scopedHref("/orchard/pests")}>{text.openHealth}</Link></Button><Button size="icon" variant="ghost" className="ml-auto" onClick={() => void remove(log.id)}><Trash2 className="h-4 w-4" /></Button></div><div className="border-t pt-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Camera className="h-3.5 w-3.5" />{text.evidence}</div><OrchardEvidence cropId={log.crop_id} careLogId={log.id} /></div></div></article> })}</div>}
        {scopedCrops.length > 0 && <Card><CardHeader><CardTitle>{text.latest}</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{scopedCrops.slice(0, 9).map((crop) => { const latest = lastByCrop.get(crop.id); return <div key={crop.id} className="border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{crop.crop_name}{crop.variety ? ` · ${crop.variety}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{latest ? `${titleize(latest.activity_type)} · ${latest.activity_date}` : text.empty}</p></div><Badge variant="outline">{crop.status}</Badge></div></div> })}</div></CardContent></Card>}
      </div>
    </section>
  </main></AppLayout>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="min-w-32 bg-black/45 px-5 py-4 text-white"><p className="text-[10px] uppercase tracking-[.14em] text-white/55">{label}</p><p className="mt-1 text-2xl font-medium tabular-nums">{value}</p></div> }
function Datum({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="border bg-muted/20 p-2"><div className="flex items-center gap-1 text-muted-foreground">{icon}{label}</div><p className="mt-1 font-medium">{value}</p></div> }
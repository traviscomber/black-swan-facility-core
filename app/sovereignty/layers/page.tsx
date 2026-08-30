"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Brain, CheckCircle2, ChevronDown, Clock, Music, Network, Sprout, Target, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
interface Layer { id: string; layer_number: number; layer_name: string; description: string; color_code: string; icon_name: string; dependencies: string[] | null; status: string; completion_percentage: number }
interface Objective { id: string; layer_id: string; objective_name: string; description: string; category: string; priority: string; status: string; target_completion_date: string | null; impact_score?: number | null }

const localeMap: Record<Locale, string> = { en: "en-US", es: "es-CL", de: "de-DE" }
const copy = {
  en: { title: "Sovereignty layers", description: "Track the operational layers, objectives and dependencies that build long-term self-sufficiency.", refresh: "Refresh", overall: "Overall progress", objectives: "Objectives", inProgressCompleted: "In progress / completed", loading: "Loading layers…", empty: "No sovereignty layers are registered.", layer: "Layer", objectivesTitle: "Objectives", objectivesDescription: "Registered objectives for this layer.", noObjectives: "No objectives registered.", dependencies: "Dependencies", dependenciesDescription: "Recorded layer dependencies.", noDependencies: "No dependencies recorded.", status: "Status", target: "Target", impact: "Impact score", completed: "Completed", inProgress: "In progress", planned: "Planned", high: "High", medium: "Medium", low: "Low", error: "Unable to load sovereignty layers." },
  es: { title: "Capas de soberanía", description: "Monitorea las capas operativas, objetivos y dependencias que construyen autosuficiencia de largo plazo.", refresh: "Actualizar", overall: "Avance general", objectives: "Objetivos", inProgressCompleted: "En curso / completados", loading: "Cargando capas…", empty: "No hay capas de soberanía registradas.", layer: "Capa", objectivesTitle: "Objetivos", objectivesDescription: "Objetivos registrados para esta capa.", noObjectives: "No hay objetivos registrados.", dependencies: "Dependencias", dependenciesDescription: "Dependencias registradas para la capa.", noDependencies: "No hay dependencias registradas.", status: "Estado", target: "Meta", impact: "Puntaje de impacto", completed: "Completado", inProgress: "En curso", planned: "Planificado", high: "Alta", medium: "Media", low: "Baja", error: "No fue posible cargar las capas de soberanía." },
  de: { title: "Souveränitätsebenen", description: "Operative Ebenen, Ziele und Abhängigkeiten für langfristige Eigenständigkeit verfolgen.", refresh: "Aktualisieren", overall: "Gesamtfortschritt", objectives: "Ziele", inProgressCompleted: "In Arbeit / abgeschlossen", loading: "Ebenen werden geladen…", empty: "Keine Souveränitätsebenen erfasst.", layer: "Ebene", objectivesTitle: "Ziele", objectivesDescription: "Erfasste Ziele für diese Ebene.", noObjectives: "Keine Ziele erfasst.", dependencies: "Abhängigkeiten", dependenciesDescription: "Erfasste Abhängigkeiten dieser Ebene.", noDependencies: "Keine Abhängigkeiten erfasst.", status: "Status", target: "Ziel", impact: "Wirkungswert", completed: "Abgeschlossen", inProgress: "In Arbeit", planned: "Geplant", high: "Hoch", medium: "Mittel", low: "Niedrig", error: "Souveränitätsebenen konnten nicht geladen werden." },
} as const

const LAYER_ICONS: Record<string, React.ReactNode> = { sprout: <Sprout className="h-6 w-6" />, network: <Network className="h-6 w-6" />, users: <Users className="h-6 w-6" />, music: <Music className="h-6 w-6" />, brain: <Brain className="h-6 w-6" /> }
function statusIcon(status: string) { if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />; if (status === "in_progress") return <Clock className="h-4 w-4 text-amber-500" />; return <AlertCircle className="h-4 w-4 text-muted-foreground" /> }
async function readJson<T>(response: Response, label: string): Promise<T> { if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`); return response.json() as Promise<T> }

export default function SovereigntyLayersPage() {
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  const [layers, setLayers] = useState<Layer[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null)
  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [layersResponse, objectivesResponse] = await Promise.all([fetch("/api/sovereignty/layers", { cache: "no-store" }), fetch("/api/sovereignty/objectives", { cache: "no-store" })])
      const [nextLayers, nextObjectives] = await Promise.all([readJson<Layer[]>(layersResponse, "layers"), readJson<Objective[]>(objectivesResponse, "objectives")])
      const orderedLayers = [...nextLayers].sort((a, b) => a.layer_number - b.layer_number)
      setLayers(orderedLayers); setObjectives(nextObjectives)
      if (orderedLayers.length) { setSelectedLayer((current) => current ?? orderedLayers[0].layer_number); setExpandedLayers((current) => current.size ? current : new Set([orderedLayers[0].layer_number])) }
    } catch (loadError) {
      console.error("[SovereigntyLayers] Failed to load:", loadError)
      setError(text.error); setLayers([]); setObjectives([])
    } finally { setLoading(false) }
  }, [text.error])

  useEffect(() => { void fetchData() }, [fetchData])
  const overallProgress = useMemo(() => layers.length ? Math.round(layers.reduce((sum, layer) => sum + Number(layer.completion_percentage || 0), 0) / layers.length) : 0, [layers])
  const objectiveCounts = useMemo(() => ({ total: objectives.length, completed: objectives.filter((objective) => objective.status === "completed").length, inProgress: objectives.filter((objective) => objective.status === "in_progress").length }), [objectives])
  const statusLabel = (status: string) => status === "completed" ? text.completed : status === "in_progress" ? text.inProgress : status === "planned" ? text.planned : status
  const priorityLabel = (priority: string) => priority === "high" ? text.high : priority === "medium" ? text.medium : priority === "low" ? text.low : priority

  function toggleLayer(layerNumber: number) { setSelectedLayer(layerNumber); setExpandedLayers((current) => { const next = new Set(current); if (next.has(layerNumber)) next.delete(layerNumber); else next.add(layerNumber); return next }) }

  return <AppLayout><div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold text-accent">{text.title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{text.description}</p></div><Button variant="outline" onClick={() => void fetchData()}>{text.refresh}</Button></div>
    {error ? <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}
    <div className="grid gap-4 sm:grid-cols-3"><Metric title={text.overall} value={`${number.format(overallProgress)}%`} /><Metric title={text.objectives} value={objectiveCounts.total.toLocaleString(locale)} /><Metric title={text.inProgressCompleted} value={`${objectiveCounts.inProgress.toLocaleString(locale)} / ${objectiveCounts.completed.toLocaleString(locale)}`} /></div>
    <Card className="border-accent/20"><CardContent className="pt-6"><div className="mb-2 flex items-center justify-between"><span className="font-semibold">{text.overall}</span><span className="text-xl font-bold text-accent">{number.format(overallProgress)}%</span></div><Progress value={overallProgress} className="h-3" /></CardContent></Card>
    {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{text.loading}</CardContent></Card> : layers.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{text.empty}</CardContent></Card> : <div className="space-y-3">{layers.map((layer) => { const expanded = expandedLayers.has(layer.layer_number); const selected = selectedLayer === layer.layer_number; const layerObjectives = objectives.filter((objective) => objective.layer_id === layer.id); const color = layer.color_code || "#94a3b8"; return <div key={layer.id} className="space-y-2"><button type="button" className="w-full text-left" onClick={() => toggleLayer(layer.layer_number)} aria-expanded={expanded}><Card className={`border-2 transition-shadow hover:shadow-md ${selected ? "shadow-sm" : ""}`} style={{ borderColor: selected ? color : `${color}40`, backgroundColor: selected ? `${color}08` : "transparent", boxShadow: selected ? `0 0 0 1px ${color}55` : undefined }}><CardContent className="p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-4"><div className="shrink-0 rounded-lg p-2" style={{ backgroundColor: `${color}20`, color }}>{LAYER_ICONS[layer.icon_name] ?? <Target className="h-6 w-6" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{text.layer} {layer.layer_number}: {layer.layer_name}</h2><Badge variant="outline">{statusLabel(layer.status)}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{layer.description}</p></div></div><div className="flex shrink-0 items-center gap-3"><span className="text-2xl font-bold" style={{ color }}>{number.format(Number(layer.completion_percentage || 0))}%</span><ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} /></div></div><Progress value={Number(layer.completion_percentage || 0)} className="mt-4" /></CardContent></Card></button>
      {expanded ? <div className="grid gap-3 pl-0 sm:pl-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">{text.objectivesTitle}</CardTitle><CardDescription>{text.objectivesDescription}</CardDescription></CardHeader><CardContent>{layerObjectives.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{text.noObjectives}</p> : <div className="space-y-3">{layerObjectives.map((objective) => <div key={objective.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div className="flex gap-2">{statusIcon(objective.status)}<div><p className="font-medium">{objective.objective_name}</p><p className="mt-1 text-sm text-muted-foreground">{objective.description}</p></div></div><Badge variant="outline">{priorityLabel(objective.priority)}</Badge></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{objective.category}</span><span>{text.status}: {statusLabel(objective.status)}</span>{objective.target_completion_date ? <span>{text.target}: {date.format(new Date(objective.target_completion_date))}</span> : null}{objective.impact_score != null ? <span>{text.impact}: {number.format(objective.impact_score)}</span> : null}</div></div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">{text.dependencies}</CardTitle><CardDescription>{text.dependenciesDescription}</CardDescription></CardHeader><CardContent>{layer.dependencies?.length ? <div className="space-y-2">{layer.dependencies.map((dependency) => <div key={dependency} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{dependency}</div>)}</div> : <p className="text-sm text-muted-foreground">{text.noDependencies}</p>}</CardContent></Card></div> : null}</div>})}</div>}
  </div></AppLayout>
}

function Metric({ title, value }: { title: string; value: string }) { return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value}</div></CardContent></Card> }

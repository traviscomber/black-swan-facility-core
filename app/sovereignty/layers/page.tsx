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

interface Layer {
  id: string
  layer_number: number
  layer_name: string
  description: string
  color_code: string
  icon_name: string
  dependencies: string[] | null
  status: string
  completion_percentage: number
}

interface Objective {
  id: string
  layer_id: string
  objective_name: string
  description: string
  category: string
  priority: string
  status: string
  target_completion_date: string | null
  impact_score?: number | null
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  sprout: <Sprout className="h-6 w-6" />,
  network: <Network className="h-6 w-6" />,
  users: <Users className="h-6 w-6" />,
  music: <Music className="h-6 w-6" />,
  brain: <Brain className="h-6 w-6" />,
}

function statusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === "in_progress") return <Clock className="h-4 w-4 text-amber-500" />
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />
}

async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export default function SovereigntyLayersPage() {
  const { t } = useLanguage()
  const [layers, setLayers] = useState<Layer[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null)
  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [layersResponse, objectivesResponse] = await Promise.all([
        fetch("/api/sovereignty/layers", { cache: "no-store" }),
        fetch("/api/sovereignty/objectives", { cache: "no-store" }),
      ])
      const [nextLayers, nextObjectives] = await Promise.all([
        readJson<Layer[]>(layersResponse, "layers"),
        readJson<Objective[]>(objectivesResponse, "objectives"),
      ])
      const orderedLayers = [...nextLayers].sort((a, b) => a.layer_number - b.layer_number)
      setLayers(orderedLayers)
      setObjectives(nextObjectives)
      if (orderedLayers.length > 0) {
        setSelectedLayer((current) => current ?? orderedLayers[0].layer_number)
        setExpandedLayers((current) => current.size ? current : new Set([orderedLayers[0].layer_number]))
      }
    } catch (loadError) {
      console.error("[SovereigntyLayers] Failed to load:", loadError)
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las capas de Sovereignty.")
      setLayers([])
      setObjectives([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const overallProgress = useMemo(
    () => layers.length ? Math.round(layers.reduce((sum, layer) => sum + Number(layer.completion_percentage || 0), 0) / layers.length) : 0,
    [layers],
  )

  const objectiveCounts = useMemo(() => ({
    total: objectives.length,
    completed: objectives.filter((objective) => objective.status === "completed").length,
    inProgress: objectives.filter((objective) => objective.status === "in_progress").length,
  }), [objectives])

  function toggleLayer(layerNumber: number) {
    setSelectedLayer(layerNumber)
    setExpandedLayers((current) => {
      const next = new Set(current)
      if (next.has(layerNumber)) next.delete(layerNumber)
      else next.add(layerNumber)
      return next
    })
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-bold text-accent">{t("sovereignty.layers_title")}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("sovereignty.layers_description")}</p></div>
          <Button variant="outline" onClick={() => void fetchData()}>Actualizar</Button>
        </div>

        {error && <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric title={t("sovereignty.overall_progress")} value={`${overallProgress}%`} />
          <Metric title="Objectives" value={String(objectiveCounts.total)} />
          <Metric title="In progress / completed" value={`${objectiveCounts.inProgress} / ${objectiveCounts.completed}`} />
        </div>

        <Card className="border-accent/20"><CardContent className="pt-6"><div className="mb-2 flex items-center justify-between"><span className="font-semibold">{t("sovereignty.overall_progress")}</span><span className="text-xl font-bold text-accent">{overallProgress}%</span></div><Progress value={overallProgress} className="h-3" /></CardContent></Card>

        {loading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading layers…</CardContent></Card> : layers.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No sovereignty layers are registered.</CardContent></Card> : (
          <div className="space-y-3">
            {layers.map((layer) => {
              const expanded = expandedLayers.has(layer.layer_number)
              const selected = selectedLayer === layer.layer_number
              const layerObjectives = objectives.filter((objective) => objective.layer_id === layer.id)
              const color = layer.color_code || "#94a3b8"
              return (
                <div key={layer.id} className="space-y-2">
                  <button type="button" className="w-full text-left" onClick={() => toggleLayer(layer.layer_number)} aria-expanded={expanded}>
                    <Card className={`border-2 transition-shadow hover:shadow-md ${selected ? "shadow-sm" : ""}`} style={{ borderColor: selected ? color : `${color}40`, backgroundColor: selected ? `${color}08` : "transparent", boxShadow: selected ? `0 0 0 1px ${color}55` : undefined }}>
                      <CardContent className="p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-4"><div className="shrink-0 rounded-lg p-2" style={{ backgroundColor: `${color}20`, color }}>{LAYER_ICONS[layer.icon_name] ?? <Target className="h-6 w-6" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{t("sovereignty.layer")} {layer.layer_number}: {layer.layer_name}</h2><Badge variant="outline">{layer.status}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{layer.description}</p></div></div>
                          <div className="flex shrink-0 items-center gap-3"><span className="text-2xl font-bold" style={{ color }}>{Math.round(Number(layer.completion_percentage || 0))}%</span><ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} /></div>
                        </div>
                        <Progress value={Number(layer.completion_percentage || 0)} className="mt-4" />
                      </CardContent>
                    </Card>
                  </button>

                  {expanded && <div className="grid gap-3 pl-0 sm:pl-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Objectives</CardTitle><CardDescription>Registered objectives for this layer.</CardDescription></CardHeader><CardContent>{layerObjectives.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No objectives registered.</p> : <div className="space-y-3">{layerObjectives.map((objective) => <div key={objective.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div className="flex gap-2">{statusIcon(objective.status)}<div><p className="font-medium">{objective.objective_name}</p><p className="mt-1 text-sm text-muted-foreground">{objective.description}</p></div></div><Badge variant="outline">{objective.priority}</Badge></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{objective.category}</span><span>Status: {objective.status}</span>{objective.target_completion_date && <span>Target: {objective.target_completion_date}</span>}{objective.impact_score != null && <span>Impact score: {objective.impact_score}</span>}</div></div>)}</div>}</CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-base">Dependencies</CardTitle><CardDescription>Recorded layer dependencies.</CardDescription></CardHeader><CardContent>{layer.dependencies?.length ? <div className="space-y-2">{layer.dependencies.map((dependency) => <div key={dependency} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{dependency}</div>)}</div> : <p className="text-sm text-muted-foreground">No dependencies recorded.</p>}</CardContent></Card>
                  </div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value}</div></CardContent></Card>
}

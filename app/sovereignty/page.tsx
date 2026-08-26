"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Code, Crown, Droplets, Leaf, Target, TrendingUp, Users, Wrench, Zap } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/hooks/use-language"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SovereigntyMetric {
  id: string
  category: string
  metric_name: string
  description: string
  unit: string
  current_value: number
  target_value: number
  self_sufficiency_percentage: number
  trending?: number | null
  last_updated?: string | null
  notes?: string | null
}

interface Dependency {
  id: string
  category: string
  dependency_name: string
  status: string
  risk_level: string
  criticality: string
}

interface TimelineEvent {
  id: string
  event_date: string
  event_type: string
  title: string
  description: string
  impact_area: string
  before_percentage: number
  after_percentage: number
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Energy: <Zap className="h-5 w-5" />,
  Food: <Leaf className="h-5 w-5" />,
  Water: <Droplets className="h-5 w-5" />,
  People: <Users className="h-5 w-5" />,
  Software: <Code className="h-5 w-5" />,
  Assets: <Wrench className="h-5 w-5" />,
}

const CATEGORY_COLORS: Record<string, string> = {
  Energy: "#fbbf24",
  Food: "#34d399",
  Water: "#60a5fa",
  People: "#a78bfa",
  Software: "#f87171",
  Assets: "#94a3b8",
}

function MetricCard({ metric }: { metric: SovereigntyMetric }) {
  const [expanded, setExpanded] = useState(false)
  const target = Number(metric.target_value || 0)
  const progress = target > 0 ? Math.min((Number(metric.current_value || 0) / target) * 100, 100) : 0
  const trend = Number(metric.trending || 0)
  const color = CATEGORY_COLORS[metric.category] ?? "#94a3b8"

  return (
    <Card className="border transition-shadow hover:shadow-md">
      <button type="button" className="w-full text-left" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="shrink-0 rounded-lg p-2" style={{ backgroundColor: `${color}20` }}>{CATEGORY_ICONS[metric.category]}</div>
              <div className="min-w-0"><CardTitle className="truncate text-sm">{metric.metric_name}</CardTitle><CardDescription className="mt-1 text-xs">{metric.category}</CardDescription></div>
            </div>
            {trend !== 0 && <div className={`flex items-center gap-1 text-xs font-semibold ${trend > 0 ? "text-green-500" : "text-red-500"}`}>{trend > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}{Math.abs(trend)}%</div>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Progress</span><span className="font-semibold">{Number(metric.current_value || 0).toLocaleString()} / {Number(metric.target_value || 0).toLocaleString()} {metric.unit}</span></div><Progress value={progress} className="h-2" /></div>
          <div className="rounded-lg p-3" style={{ backgroundColor: `${color}10` }}><div className="text-3xl font-bold" style={{ color }}>{Number(metric.self_sufficiency_percentage || 0).toFixed(0)}%</div><p className="mt-1 text-xs text-muted-foreground">Self-sufficient</p></div>
          {expanded && <div className="space-y-2 border-t pt-4"><p className="text-sm text-muted-foreground">{metric.description}</p>{metric.last_updated && <p className="text-xs text-muted-foreground">Last updated: {new Date(metric.last_updated).toLocaleString()}</p>}{metric.notes && <p className="rounded-md border-l-2 border-amber-400/50 bg-muted/30 p-2 text-xs text-muted-foreground">{metric.notes}</p>}</div>}
        </CardContent>
      </button>
    </Card>
  )
}

async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export default function SovereigntyPage() {
  const { t } = useLanguage()
  const [metrics, setMetrics] = useState<SovereigntyMetric[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [metricsResponse, dependenciesResponse, timelineResponse] = await Promise.all([
        fetch("/api/sovereignty/metrics", { cache: "no-store" }),
        fetch("/api/sovereignty/dependencies", { cache: "no-store" }),
        fetch("/api/sovereignty/timeline", { cache: "no-store" }),
      ])
      const [nextMetrics, nextDependencies, nextTimeline] = await Promise.all([
        readJson<SovereigntyMetric[]>(metricsResponse, "metrics"),
        readJson<Dependency[]>(dependenciesResponse, "dependencies"),
        readJson<TimelineEvent[]>(timelineResponse, "timeline"),
      ])
      setMetrics(nextMetrics)
      setDependencies(nextDependencies)
      setTimeline(nextTimeline)
    } catch (loadError) {
      console.error("[Sovereignty] Failed to load dashboard:", loadError)
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar Sovereignty.")
      setMetrics([])
      setDependencies([])
      setTimeline([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const overallSovereignty = useMemo(() => metrics.length ? Math.round(metrics.reduce((sum, metric) => sum + Number(metric.self_sufficiency_percentage || 0), 0) / metrics.length) : 0, [metrics])
  const categories = useMemo(() => Array.from(new Set(metrics.map((metric) => metric.category))), [metrics])
  const filteredMetrics = selectedCategory ? metrics.filter((metric) => metric.category === selectedCategory) : metrics
  const riskDependencies = dependencies.filter((dependency) => dependency.status === "active" && dependency.risk_level === "high")
  const categoryAverages = categories.map((category) => {
    const rows = metrics.filter((metric) => metric.category === category)
    return { name: category, value: rows.length ? Math.round(rows.reduce((sum, metric) => sum + Number(metric.self_sufficiency_percentage || 0), 0) / rows.length) : 0 }
  })

  return (
    <AppLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
          <Crown className="absolute -right-6 -top-8 h-40 w-40 text-primary opacity-10" />
          <div className="relative flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20"><TrendingUp className="h-6 w-6 text-primary" /></div><div><h1 className="text-3xl font-bold text-accent">{t("sovereignty.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("sovereignty.description")}</p></div></div>
        </div>

        {error && <Card className="border-destructive/50"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void fetchData()}>Reintentar</Button></CardContent></Card>}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/30 md:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />{t("sovereignty.self_sufficiency")}</CardTitle></CardHeader><CardContent><div className="mb-3 text-5xl font-bold text-primary">{loading ? "—" : `${overallSovereignty}%`}</div><Progress value={overallSovereignty} className="h-3" /></CardContent></Card>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1"><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("sovereignty.dependencies")}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{dependencies.filter((dependency) => dependency.status === "active").length}</div><p className="text-xs text-muted-foreground">{riskDependencies.length} high risk</p></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("sovereignty.categories_tracked")}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{categories.length}</div></CardContent></Card></div>
        </div>

        {categoryAverages.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Sovereignty by category</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={categoryAverages}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{categoryAverages.map((entry) => <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#94a3b8"} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-xl font-bold">{t("sovereignty.metrics")}</h2>{categories.length > 0 && <Tabs value={selectedCategory ?? "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? null : value)}><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="all">All</TabsTrigger>{categories.map((category) => <TabsTrigger key={category} value={category} className="gap-1.5">{CATEGORY_ICONS[category]}{category}</TabsTrigger>)}</TabsList></Tabs>}</div>
          {loading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading metrics…</CardContent></Card> : filteredMetrics.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No sovereignty metrics registered.</CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>}
        </section>

        {riskDependencies.length > 0 && <Card className="border-destructive/30"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Critical dependencies</CardTitle><CardDescription>Active high-risk dependencies recorded in the system.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{riskDependencies.map((dependency) => <div key={dependency.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{dependency.dependency_name}</p><p className="text-xs text-muted-foreground">{dependency.category}</p></div><span className="rounded-full border px-2 py-1 text-xs">{dependency.criticality}</span></div></div>)}</CardContent></Card>}

        <Card><CardHeader><CardTitle>Progress timeline</CardTitle><CardDescription>Recorded sovereignty changes.</CardDescription></CardHeader><CardContent>{timeline.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No timeline events registered.</p> : <div className="space-y-3">{timeline.map((event) => { const impact = Number(event.after_percentage) - Number(event.before_percentage); return <div key={event.id} className="border-l-2 border-primary/30 pl-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{event.event_date} · {event.impact_area}</p></div><span className={`flex items-center gap-1 text-sm font-semibold ${impact >= 0 ? "text-green-500" : "text-red-500"}`}>{impact >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}{Math.abs(impact).toFixed(1)}%</span></div></div>})}</div>}</CardContent></Card>

        <div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" asChild><Link href="/energy-dashboard"><Zap className="mr-2 h-4 w-4" />Energy operations</Link></Button><Button asChild><Link href="/sovereignty/coach"><Crown className="mr-2 h-4 w-4" />Sovereignty Coach</Link></Button></div>
      </div>
    </AppLayout>
  )
}

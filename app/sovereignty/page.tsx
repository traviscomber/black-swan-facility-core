"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Zap,
  Droplets,
  Leaf,
  Users,
  Code,
  Wrench,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Target,
  AlertCircle,
  Crown,
} from "lucide-react"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface SovereigntyMetric {
  id: string
  category: string
  metric_name: string
  description: string
  unit: string
  current_value: number
  target_value: number
  self_sufficiency_percentage: number
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

export default function SovereigntyPage() {
  const [metrics, setMetrics] = useState<SovereigntyMetric[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [overallSovereignty, setOverallSovereignty] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [metricsRes, depsRes, timelineRes] = await Promise.all([
        fetch("/api/sovereignty/metrics"),
        fetch("/api/sovereignty/dependencies"),
        fetch("/api/sovereignty/timeline"),
      ])

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data)
        if (data.length > 0) {
          const avg =
            data.reduce((sum: number, m: SovereigntyMetric) => sum + (m.self_sufficiency_percentage || 0), 0) /
            data.length
          setOverallSovereignty(Math.round(avg))
        }
      }

      if (depsRes.ok) {
        setDependencies(await depsRes.json())
      }

      if (timelineRes.ok) {
        setTimeline(await timelineRes.json())
      }
    } catch (error) {
      console.error("Error fetching sovereignty data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMetrics = selectedCategory ? metrics.filter((m) => m.category === selectedCategory) : metrics
  const riskDependencies = dependencies.filter((d) => d.status === "active" && d.risk_level === "high")
  const categories = Array.from(new Set(metrics.map((m) => m.category)))
  const categoryAverages = categories.map((cat) => ({
    name: cat,
    value:
      Math.round(
        metrics.filter((m) => m.category === cat).reduce((sum, m) => sum + (m.self_sufficiency_percentage || 0), 0) /
          metrics.filter((m) => m.category === cat).length,
      ) || 0,
  }))

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8">
          <div className="absolute top-0 right-0 opacity-10">
            <Crown className="h-48 w-48 text-primary" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-lg bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-accent">Sovereignty Dashboard</h1>
                <p className="text-muted-foreground mt-1">Multi-system autonomy tracking and independence roadmap</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Sovereignty Score - Hero Metric */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/30 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Overall Sovereignty Score
              </CardTitle>
              <CardDescription>Facility self-sufficiency across all categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-6xl font-bold text-primary mb-2">{overallSovereignty}%</div>
                <Progress value={overallSovereignty} className="h-3" />
                <p className="text-sm text-muted-foreground mt-3">
                  {overallSovereignty < 30 && "🔴 High dependency on external systems. Focus on critical areas first."}
                  {overallSovereignty >= 30 &&
                    overallSovereignty < 60 &&
                    "🟡 Moderate independence. Opportunities for significant improvement."}
                  {overallSovereignty >= 60 &&
                    overallSovereignty < 80 &&
                    "🟢 Strong self-sufficiency. Continue momentum in weaker areas."}
                  {overallSovereignty >= 80 && "🟢 Excellent autonomy achieved. Focus on optimization."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key Stats */}
          <div className="space-y-4">
            <Card className="border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Active Dependencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {dependencies.filter((d) => d.status === "active").length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{riskDependencies.length} high-risk</p>
              </CardContent>
            </Card>
            <Card className="border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Categories Tracked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{categories.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Energy, Food, Water, People, Software, Assets</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Category Comparison */}
        <Card className="border-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Self-Sufficiency by Category
            </CardTitle>
            <CardDescription>Compare sovereignty levels across all facility systems</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryAverages} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(15,15,15,0.95)", border: "1px solid rgba(114,102,88,0.3)" }}
                  formatter={(value) => `${value}%`}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {categoryAverages.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || "#726658"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Detailed Metrics with Filtering */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-bold text-accent">Sovereignty Metrics</h2>
            <Tabs value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
              <TabsList className="bg-secondary border border-secondary">
                <TabsTrigger value="all">All Categories</TabsTrigger>
                {categories.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="gap-2">
                    {CATEGORY_ICONS[cat]} {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMetrics.map((metric) => (
              <Card key={metric.id} className="border-secondary hover:border-primary/40 transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="text-primary">{CATEGORY_ICONS[metric.category]}</div>
                      <div className="flex-1">
                        <CardTitle className="text-sm leading-tight">{metric.metric_name}</CardTitle>
                        <CardDescription className="text-xs mt-1">{metric.category}</CardDescription>
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 ${metric.self_sufficiency_percentage && metric.self_sufficiency_percentage > 50 ? "text-green-400" : "text-yellow-400"}`}
                    >
                      {metric.self_sufficiency_percentage && metric.self_sufficiency_percentage > 50 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Current / Target</span>
                      <span className="text-sm font-bold text-accent">
                        {metric.current_value.toFixed(1)}/{metric.target_value} {metric.unit}
                      </span>
                    </div>
                    <Progress value={(metric.current_value / metric.target_value) * 100} className="h-2" />
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <div className="text-3xl font-bold text-primary">{metric.self_sufficiency_percentage || 0}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Self-Sufficient</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Risk Dependencies */}
        {riskDependencies.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Critical Dependencies Requiring Action
              </CardTitle>
              <CardDescription>High-risk external dependencies affecting sovereignty</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {riskDependencies.slice(0, 6).map((dep) => (
                  <div key={dep.id} className="border border-destructive/20 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-sm text-destructive">{dep.dependency_name}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-destructive/20 text-destructive">
                        {dep.criticality}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{dep.category}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Timeline */}
        <Card className="border-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Sovereignty Progress Timeline
            </CardTitle>
            <CardDescription>Historical improvements and impact on independence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {timeline.length > 0 ? (
                timeline.map((event) => {
                  const impact = event.after_percentage - event.before_percentage
                  return (
                    <div key={event.id} className="border-l-2 border-primary/30 pl-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{event.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.event_date} • {event.impact_area}
                          </p>
                        </div>
                        <div
                          className={`flex items-center gap-1 font-bold ${impact > 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {impact > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          <span>{Math.abs(impact).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No timeline events yet. Start documenting your sovereignty journey.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Links */}
        <div className="bg-secondary/40 border border-secondary rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-bold text-accent">Improve Sovereignty</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/energy-dashboard" className="inline-block relative z-10">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                <Zap className="h-4 w-4" /> Energy Independence
              </Button>
            </Link>
            <Link href="/employees" className="inline-block relative z-10">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                <Users className="h-4 w-4" /> Build Team Skills
              </Button>
            </Link>
            <Link href="/asset-management" className="inline-block relative z-10">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                <Wrench className="h-4 w-4" /> Manage Assets
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
              <TrendingUp className="h-4 w-4" /> View Reports
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

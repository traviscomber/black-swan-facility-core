"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { useLanguage } from "@/lib/hooks/use-language"
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
  trending?: number // percentage change
  last_updated?: string
  notes?: string
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState(metric)

  const progress = (metric.current_value / metric.target_value) * 100
  const isOnTrack = metric.self_sufficiency_percentage >= 50
  const trending = metric.trending || 0

  return (
    <>
      <Card
        className={`border-2 transition-all hover:shadow-lg cursor-pointer ${isExpanded ? "ring-2" : ""}`}
        style={{
          borderColor: isOnTrack ? `${CATEGORY_COLORS[metric.category]}60` : `${CATEGORY_COLORS[metric.category]}40`,
          backgroundColor: isExpanded ? `${CATEGORY_COLORS[metric.category]}08` : "transparent",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="p-2 rounded-lg flex-shrink-0"
                style={{ backgroundColor: `${CATEGORY_COLORS[metric.category]}20` }}
              >
                {CATEGORY_ICONS[metric.category]}
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm leading-tight line-clamp-1">{metric.metric_name}</CardTitle>
                <CardDescription className="text-xs mt-1">{metric.category}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {trending !== 0 && (
                <div className={`flex items-center gap-1 ${trending > 0 ? "text-green-400" : "text-red-400"}`}>
                  {trending > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <span className="text-xs font-bold">{Math.abs(trending)}%</span>
                </div>
              )}
              {!isOnTrack && <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Section */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-sm font-bold text-accent">
                {metric.current_value.toFixed(1)}/{metric.target_value} {metric.unit}
              </span>
            </div>
            <Progress value={Math.min(progress, 100)} className="h-2" />
          </div>

          {/* Main Metric Display */}
          <div
            className="rounded-lg bg-gradient-to-br"
            style={{ backgroundColor: `${CATEGORY_COLORS[metric.category]}10` }}
            style={{ padding: "12px" }}
          >
            <div className="text-3xl font-bold text-primary" style={{ color: CATEGORY_COLORS[metric.category] }}>
              {metric.self_sufficiency_percentage || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Self-Sufficient</p>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="space-y-4 border-t border-secondary pt-4 animate-in fade-in">
              {/* Status & Context */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{metric.description}</p>
                {metric.last_updated && (
                  <p className="text-xs text-muted-foreground">Last updated: {metric.last_updated}</p>
                )}
              </div>

              {/* Achievement Status */}
              <div className="grid grid-cols-2 gap-2 bg-secondary/30 p-3 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground">Current</span>
                  <div className="font-bold text-sm mt-1">{metric.current_value.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Target</span>
                  <div className="font-bold text-sm mt-1">{metric.target_value}</div>
                </div>
              </div>

              {/* Notes Section */}
              {metric.notes && (
                <div className="border-l-2 border-amber-400/30 pl-3 py-1">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Notes</p>
                  <p className="text-xs text-muted-foreground">{metric.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                  }}
                  className="text-xs"
                >
                  Update Value
                </Button>
                <Button size="sm" variant="outline" className="text-xs bg-transparent">
                  View History
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Update {metric.metric_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Current Value ({metric.unit})</label>
                <input
                  type="number"
                  value={editData.current_value}
                  onChange={(e) => setEditData({ ...editData, current_value: Number.parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-secondary rounded border border-secondary"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Target Value ({metric.unit})</label>
                <input
                  type="number"
                  value={editData.target_value}
                  onChange={(e) => setEditData({ ...editData, target_value: Number.parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-secondary rounded border border-secondary"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setIsEditing(false)
                    // TODO: Save to API
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

export default function SovereigntyPage() {
  const [metrics, setMetrics] = useState<SovereigntyMetric[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [overallSovereignty, setOverallSovereignty] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { t } = useLanguage() // Use the useLanguage hook to get the t function

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
                <h1 className="text-4xl font-bold text-accent">{t("sovereignty.title")}</h1>
                <p className="text-muted-foreground mt-1">{t("sovereignty.description")}</p>
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
                {t("sovereignty.self_sufficiency")}
              </CardTitle>
              <CardDescription>{t("sovereignty.description")}</CardDescription>
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
                <CardTitle className="text-sm">{t("sovereignty.dependencies")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {dependencies.filter((d) => d.status === "active").length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{riskDependencies.length} {t("sovereignty.high")}</p>
              </CardContent>
            </Card>
            <Card className="border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("sovereignty.categories_tracked")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{categories.length}</div>
                <p className="text-xs text-muted-foreground mt-1">{t("sovereignty.energy")}, {t("sovereignty.food")}, {t("sovereignty.water")}, {t("sovereignty.people")}, {t("sovereignty.software")}, {t("sovereignty.assets")}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Category Comparison */}
        <Card className="border-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t("sovereignty.self_sufficiency")} {t("sovereignty.by_category")}
            </CardTitle>
            <CardDescription>{t("sovereignty.compare_systems")}</CardDescription>
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

        {/* Detailed Metrics with Enhanced Cards */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-bold text-accent">{t("sovereignty.metrics")}</h2>
            <Tabs value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
              <TabsList className="bg-secondary border border-secondary">
                <TabsTrigger value="all">{t("sovereignty.all_categories")}</TabsTrigger>
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
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </div>

        {/* Risk Dependencies */}
        {riskDependencies.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t("sovereignty.critical_dependencies")}
              </CardTitle>
              <CardDescription>{t("sovereignty.high_risk_external")}</CardDescription>
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
              {t("sovereignty.timeline")}
            </CardTitle>
            <CardDescription>{t("sovereignty.timeline_description")}</CardDescription>
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
                  {t("sovereignty.no_timeline_events")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Links */}
        <div className="bg-secondary/40 border border-secondary rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-bold text-accent">{t("sovereignty.improve_sovereignty")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/energy-dashboard" className="inline-block relative z-10">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                <Zap className="h-4 w-4" /> {t("sovereignty.energy_independence")}
              </Button>
            </Link>
            <Link href="/employees" className="inline-block relative z-10">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                <Users className="h-4 w-4" /> {t("sovereignty.build_team_skills")}
              </Button>
            </Link>
            <Link href="/asset-management" className="inline-block relative z-10">
              <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
                <Wrench className="h-4 w-4" /> {t("sovereignty.manage_assets")}
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="w-full gap-2 bg-transparent">
              <TrendingUp className="h-4 w-4" /> {t("sovereignty.view_reports")}
            </Button>
          </div>
        </div>

        {/* Comprehensive Achievement Roadmap and Guidance */}
        <div className="space-y-4">
          <Card className="border-secondary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5 text-primary" />
                {t("sovereignty.achievement_roadmap")}
              </CardTitle>
              <CardDescription>{t("sovereignty.guidance_higher_levels")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="border border-primary/20 rounded-lg p-3">
                  <h4 className="font-semibold text-sm">{t("sovereignty.step1_title")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sovereignty.step1_desc")}
                  </p>
                </div>
                <div className="border border-primary/20 rounded-lg p-3">
                  <h4 className="font-semibold text-sm">{t("sovereignty.step2_title")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sovereignty.step2_desc")}
                  </p>
                </div>
                <div className="border border-primary/20 rounded-lg p-3">
                  <h4 className="font-semibold text-sm">{t("sovereignty.step3_title")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sovereignty.step3_desc")}
                  </p>
                </div>
                <div className="border border-primary/20 rounded-lg p-3">
                  <h4 className="font-semibold text-sm">{t("sovereignty.step4_title")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sovereignty.step4_desc")}
                  </p>
                </div>
                <div className="border border-primary/20 rounded-lg p-3">
                  <h4 className="font-semibold text-sm">{t("sovereignty.step5_title")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sovereignty.step5_desc")}
                  </p>
                </div>
                <div className="border border-primary/20 rounded-lg p-3">
                  <h4 className="font-semibold text-sm">{t("sovereignty.step6_title")}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sovereignty.step6_desc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

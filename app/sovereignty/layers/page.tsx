"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sprout,
  Network,
  Users,
  Music,
  Brain,
  ArrowDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  TrendingUp,
  Target,
  ChevronDown,
} from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

interface Layer {
  id: string
  layer_number: number
  layer_name: string
  description: string
  color_code: string
  icon_name: string
  dependencies: string[]
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
  target_completion_date: string
  impact_score?: number
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  sprout: <Sprout className="h-6 w-6" />,
  network: <Network className="h-6 w-6" />,
  users: <Users className="h-6 w-6" />,
  music: <Music className="h-6 w-6" />,
  brain: <Brain className="h-6 w-6" />,
}

const LAYER_SECTIONS = {
  1: {
    title: "Foundation",
    emoji: "🌱",
    modules: ["Cattle", "Farm/Food Production", "Employees"],
    quickWins: [
      "Document current cattle operations",
      "Establish feed sourcing plan",
      "Create employee scheduling system",
    ],
    actionItems: [
      "Audit existing cattle inventory and health status",
      "Develop sustainable feed production plan",
      "Establish baseline employee skills inventory",
    ],
    targetMilestones: [
      { percentage: 25, description: "Basic cattle operations documented" },
      { percentage: 50, description: "Food production partially self-sufficient" },
      { percentage: 75, description: "Strong local food sources established" },
      { percentage: 100, description: "Complete foundation independence achieved" },
    ],
  },
  2: {
    title: "Infrastructure",
    emoji: "🔧",
    modules: ["Energy Systems", "Communications", "Landscaping", "GIS Map"],
    quickWins: ["Audit energy consumption patterns", "Map communication dependencies", "Plan renewable energy pilot"],
    actionItems: [
      "Install solar panels for basic power needs",
      "Establish backup communication systems",
      "Create renewable energy transition plan",
    ],
    targetMilestones: [
      { percentage: 25, description: "Energy audit completed" },
      { percentage: 50, description: "Renewable energy 25% of supply" },
      { percentage: 75, description: "Renewable energy 75% of supply" },
      { percentage: 100, description: "Off-grid capable infrastructure" },
    ],
  },
  3: {
    title: "Services",
    emoji: "👥",
    modules: ["Bookings", "Guests", "Hospitality", "Tasks"],
    quickWins: [
      "Implement online booking system",
      "Create guest onboarding process",
      "Develop task management workflow",
    ],
    actionItems: [
      "Build self-service guest portal",
      "Train staff on hospitality standards",
      "Automate routine task assignments",
    ],
    targetMilestones: [
      { percentage: 25, description: "Booking system operational" },
      { percentage: 50, description: "Guest services 50% automated" },
      { percentage: 75, description: "Most tasks digitized" },
      { percentage: 100, description: "Autonomous hospitality operations" },
    ],
  },
  4: {
    title: "Culture",
    emoji: "🎨",
    modules: ["Music & Performance", "Art Spaces", "Entertainment Events"],
    quickWins: ["Host monthly cultural event", "Create artist residency program", "Establish art exhibition space"],
    actionItems: [
      "Develop cultural programming calendar",
      "Partner with local artists",
      "Create performance venue infrastructure",
    ],
    targetMilestones: [
      { percentage: 25, description: "Initial cultural events launched" },
      { percentage: 50, description: "Regular cultural programming" },
      { percentage: 75, description: "Artist community established" },
      { percentage: 100, description: "Vibrant cultural hub" },
    ],
  },
  5: {
    title: "Mind",
    emoji: "🧠",
    modules: ["Wellness Programs", "Education", "Philosophy", "Mental Health"],
    quickWins: ["Launch wellness workshops", "Create learning library", "Start meditation groups"],
    actionItems: ["Build wellness center", "Establish educational programs", "Create philosophy discussion groups"],
    targetMilestones: [
      { percentage: 25, description: "Basic wellness programs active" },
      { percentage: 50, description: "Structured education curriculum" },
      { percentage: 75, description: "Integrated wellness ecosystem" },
      { percentage: 100, description: "Complete mind-body integration" },
    ],
  },
}

function LayerActionItems({ layer }: { layer: Layer }) {
  const sectionInfo = LAYER_SECTIONS[layer.layer_number as keyof typeof LAYER_SECTIONS]
  if (!sectionInfo) return null

  return (
    <Card className="border-2" style={{ borderColor: layer.color_code + "40" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: layer.color_code }} />
          How to Achieve This Layer
        </CardTitle>
        <CardDescription>Concrete steps and milestones to reach independence</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Quick Wins */}
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Quick Wins (High Impact, Low Effort)
          </h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {sectionInfo.quickWins.map((win, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>{win}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-400" />
            Key Action Items
          </h3>
          <div className="space-y-2">
            {sectionInfo.actionItems.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-secondary/50 border border-secondary/100 text-sm flex gap-3">
                <span className="font-semibold text-amber-400 flex-shrink-0">{idx + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Target Milestones */}
        <div>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Completion Milestones
          </h3>
          <div className="space-y-3">
            {sectionInfo.targetMilestones.map((milestone, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">
                    {milestone.percentage}% - {milestone.description}
                  </span>
                  <span className="text-xs text-muted-foreground">{milestone.percentage}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${milestone.percentage}%`,
                      backgroundColor: layer.color_code,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ROI Impact */}
        <div className="bg-gradient-to-r from-accent/10 to-transparent p-4 rounded-lg border border-accent/20">
          <h4 className="font-semibold mb-2 text-accent">Impact of Achieving This Layer</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✓ Reduced external dependency by ~20%</li>
            <li>✓ Improved operational resilience</li>
            <li>✓ Cost savings through self-sufficiency</li>
            <li>✓ Increased community value and appeal</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SovereigntyLayersPage() {
  const [expandedLayer, setExpandedLayer] = useState<number | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null)
  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(new Set([1]))

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [layersRes, objectivesRes] = await Promise.all([
        fetch("/api/sovereignty/layers"),
        fetch("/api/sovereignty/objectives"),
      ])

      if (layersRes.ok) {
        const data = await layersRes.json()
        setLayers(data)
        if (data.length > 0) setSelectedLayer(data[0].layer_number)
      }

      if (objectivesRes.ok) {
        setObjectives(await objectivesRes.json())
      }
    } catch (error) {
      console.error("Error fetching layers:", error)
    } finally {
      setLoading(false)
    }
  }

  const currentLayer = layers.find((l) => l.layer_number === selectedLayer)
  const layerObjectives = currentLayer ? objectives.filter((o) => o.layer_id === currentLayer.id) : []

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-accent">{t("sovereignty.layers_title")}</h1>
          <p className="text-muted-foreground max-w-2xl">
            {t("sovereignty.layers_description")}
          </p>
        </div>

        {/* Overall Progress */}
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">{t("sovereignty.overall_progress")}</span>
              <span className="text-xl font-bold text-accent">
                {layers.length > 0
                  ? Math.round(layers.reduce((sum, l) => sum + l.completion_percentage, 0) / layers.length)
                  : 0}
                %
              </span>
            </div>
            <Progress
              value={
                layers.length > 0 ? layers.reduce((sum, l) => sum + l.completion_percentage, 0) / layers.length : 0
              }
              className="h-3"
            />
          </CardContent>
        </Card>

        {/* Pyramid Visualization */}
        <div className="space-y-3">
          {layers.map((layer, idx) => {
            const isSelected = layer.layer_number === selectedLayer
            const isExpanded = expandedLayers.has(layer.layer_number)
            const sectionInfo = LAYER_SECTIONS[layer.layer_number as keyof typeof LAYER_SECTIONS]

            return (
              <div key={layer.id} className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedLayer(layer.layer_number)
                    setExpandedLayers((prev) => {
                      const newSet = new Set(prev)
                      if (newSet.has(layer.layer_number)) {
                        newSet.delete(layer.layer_number)
                      } else {
                        newSet.add(layer.layer_number)
                      }
                      return newSet
                    })
                  }}
                  className={`w-full transition-all text-left`}
                >
                  <Card
                    className={`border-2 transition-all hover:shadow-lg cursor-pointer ${isSelected ? `ring-2` : ""}`}
                    style={{
                      borderColor: isSelected ? layer.color_code : layer.color_code + "40",
                      backgroundColor: isSelected ? layer.color_code + "08" : "transparent",
                      ringColor: layer.color_code,
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div
                            className="p-2 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${layer.color_code}20` }}
                          >
                            {LAYER_ICONS[layer.icon_name]}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-xl font-bold text-accent">
                              {sectionInfo?.emoji} {t("sovereignty.layer")} {layer.layer_number}: {sectionInfo?.title}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{layer.description}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-4">
                          <div>
                            <div className="text-3xl font-bold" style={{ color: layer.color_code }}>
                              {Math.round(layer.completion_percentage)}%
                            </div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {layer.status}
                            </Badge>
                          </div>
                          <ChevronDown
                            className={`h-5 w-5 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                            style={{ color: layer.color_code }}
                          />
                        </div>
                      </div>
                      <Progress value={layer.completion_percentage} className="mt-4" />
                    </CardContent>
                  </Card>
                </button>

                {/* Expanded Layer Details */}
                {isExpanded && (
                  <div className="ml-6 space-y-4 animate-in fade-in">
                    {/* Layer Details Card */}
                    <Card className="border-2" style={{ borderColor: layer.color_code + "40" }}>
                      <CardHeader>
                        <CardTitle>{t("sovereignty.related_modules")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 md:grid-cols-2">
                          {sectionInfo?.modules.map((module) => (
                            <div
                              key={module}
                              className="p-3 rounded-lg bg-secondary/50 text-sm flex items-center gap-2"
                            >
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: layer.color_code }} />
                              {module}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Objectives Card */}
                    <Card className="border-2" style={{ borderColor: layer.color_code + "40" }}>
                      <CardHeader>
                        <CardTitle>{t("sovereignty.key_objectives")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {layerObjectives.length > 0 ? (
                          <div className="space-y-2">
                            {layerObjectives.map((obj) => (
                              <div key={obj.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                                {obj.status === "completed" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                ) : obj.status === "in_progress" ? (
                                  <Clock className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm">{obj.objective_name}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">{obj.description}</p>
                                  {obj.target_completion_date && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {t("sovereignty.target")}: {obj.target_completion_date}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {obj.priority}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("sovereignty.no_objectives")}</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Action Items */}
                    {isSelected && <LayerActionItems layer={layer} />}
                  </div>
                )}

                {idx < layers.length - 1 && (
                  <div className="flex justify-center py-2 opacity-30">
                    <ArrowDown className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dependencies Overview */}
        {currentLayer && currentLayer.dependencies.length > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning">{t("sovereignty.dependencies_to_eliminate")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {currentLayer.dependencies.map((dep) => (
                  <div key={dep} className="p-3 rounded-lg bg-secondary/50 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
                    {dep}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

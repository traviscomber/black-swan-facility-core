"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Sprout, Network, Users, Music, Brain, ArrowDown, CheckCircle2, Clock, AlertCircle } from "lucide-react"

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
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  sprout: <Sprout className="h-6 w-6" />,
  network: <Network className="h-6 w-6" />,
  users: <Users className="h-6 w-6" />,
  music: <Music className="h-6 w-6" />,
  brain: <Brain className="h-6 w-6" />,
}

const LAYER_SECTIONS = {
  1: { title: "Foundation", emoji: "🌱", modules: ["Cattle", "Farm/Food Production", "Employees"] },
  2: { title: "Infrastructure", emoji: "🔧", modules: ["Energy Systems", "Communications", "Landscaping", "GIS Map"] },
  3: { title: "Services", emoji: "👥", modules: ["Bookings", "Guests", "Hospitality", "Tasks"] },
  4: { title: "Culture", emoji: "🎨", modules: ["Music & Performance", "Art Spaces", "Entertainment Events"] },
  5: { title: "Mind", emoji: "🧠", modules: ["Wellness Programs", "Education", "Philosophy", "Mental Health"] },
}

export default function SovereigntyLayersPage() {
  const [layers, setLayers] = useState<Layer[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null)

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
        {/* Pyramid Visualization */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-accent">Sovereignty Hierarchy</h1>
          <p className="text-muted-foreground">
            5-layer pyramid of facility independence - each layer depends on the foundation below
          </p>
        </div>

        {/* Pyramid Structure */}
        <div className="flex flex-col-reverse gap-4 items-center max-w-2xl mx-auto w-full">
          {layers.map((layer, idx) => {
            const isSelected = layer.layer_number === selectedLayer
            const sectionInfo = LAYER_SECTIONS[layer.layer_number as keyof typeof LAYER_SECTIONS]
            return (
              <div key={layer.id} className="w-full">
                <button
                  onClick={() => setSelectedLayer(layer.layer_number)}
                  className={`w-full transition-all ${isSelected ? "ring-2 ring-primary rounded-lg" : ""}`}
                >
                  <Card
                    className={`border-2 transition-all hover:shadow-lg ${
                      isSelected ? `border-[${layer.color_code}]` : "border-secondary"
                    }`}
                    style={{
                      borderColor: isSelected ? layer.color_code : undefined,
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: `${layer.color_code}20` }}>
                            {LAYER_ICONS[layer.icon_name]}
                          </div>
                          <div className="text-left">
                            <div className="text-2xl font-bold text-accent">
                              {sectionInfo.emoji} Layer {layer.layer_number}: {sectionInfo.title}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{layer.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold" style={{ color: layer.color_code }}>
                            {layer.completion_percentage}%
                          </div>
                          <Badge variant="outline">{layer.status}</Badge>
                        </div>
                      </div>
                      <Progress value={layer.completion_percentage} className="mt-4" />
                    </CardContent>
                  </Card>
                </button>
                {idx < layers.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Selected Layer Details */}
        {currentLayer && (
          <div className="space-y-6">
            <Card className="border-2" style={{ borderColor: currentLayer.color_code + "40" }}>
              <CardHeader>
                <CardTitle>
                  Layer {currentLayer.layer_number}: {currentLayer.layer_name}
                </CardTitle>
                <CardDescription>{currentLayer.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Module Links */}
                <div>
                  <h3 className="font-semibold mb-3 text-accent">Related Modules</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {LAYER_SECTIONS[currentLayer.layer_number as keyof typeof LAYER_SECTIONS]?.modules.map((module) => (
                      <div key={module} className="p-3 rounded-lg bg-secondary/50 text-sm">
                        {module}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Objectives */}
                <div>
                  <h3 className="font-semibold mb-3 text-accent">Key Objectives</h3>
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
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{obj.objective_name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{obj.description}</p>
                            {obj.target_completion_date && (
                              <p className="text-xs text-muted-foreground mt-1">Target: {obj.target_completion_date}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {obj.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No objectives defined yet</p>
                  )}
                </div>

                {/* Dependencies */}
                {currentLayer.dependencies.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-accent">Depends On</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentLayer.dependencies.map((dep) => (
                        <Badge key={dep} variant="secondary">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

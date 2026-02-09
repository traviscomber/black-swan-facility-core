"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Leaf, Droplet, Sun, TrendingUp, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/language-context"

interface Plot {
  id: string
  name: string
  plot_type: string
  size_sqm: number
  status: string
  soil_type: string
  ph_level: number
  sunlight_hours: number
  irrigation_type: string
  description: string
}

export default function OrchardFarmPage() {
  const [plots, setPlots] = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchPlots()
  }, [])

  const fetchPlots = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("orchard_plots")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPlots(data || [])
    } catch (error) {
      console.error("[v0] Error fetching plots:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPlotTypeLabel = (type: string) => {
    if (type === "vegetable_garden") return t("orchard.vegetable_garden")
    if (type === "herb_garden") return t("orchard.herb_garden")
    if (type === "fruit_garden") return t("orchard.fruit_garden")
    return type
  }

  const getStatusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-800"
    if (status === "inactive") return "bg-gray-100 text-gray-800"
    return "bg-yellow-100 text-yellow-800"
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t("orchard.loading")}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("orchard.title")}
          description={t("orchard.description")}
          actions={
            <div className="flex gap-2">
              <Button variant="outline">
                <Droplet className="mr-2 h-4 w-4" />
                {t("orchard.care_logs")}
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("orchard.add_plot")}
              </Button>
            </div>
          }
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                {t("orchard.plots")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{plots.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("orchard.active")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sun className="h-4 w-4" />
                {t("orchard.vegetable_garden")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {plots.filter((p) => p.plot_type === "vegetable_garden").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("orchard.plots")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                {t("orchard.herb_garden")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {plots.filter((p) => p.plot_type === "herb_garden").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("orchard.plots")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("orchard.total_yield")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">kg</p>
            </CardContent>
          </Card>
        </div>

        {/* Garden Plots */}
        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.plots")}</CardTitle>
            <CardDescription>{t("orchard.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {plots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t("common.no_items")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plots.map((plot) => (
                  <div
                    key={plot.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{plot.name}</h3>
                          <Badge className={getStatusColor(plot.status)}>
                            {plot.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {getPlotTypeLabel(plot.plot_type)} • {plot.size_sqm} m² •{" "}
                          {plot.soil_type}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">{t("orchard.ph_level")}</p>
                            <p className="font-semibold">{plot.ph_level}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {t("orchard.sunlight_hours")}
                            </p>
                            <p className="font-semibold">{plot.sunlight_hours}h</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t("orchard.irrigation")}</p>
                            <p className="font-semibold text-xs">{plot.irrigation_type}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{t("orchard.plot_size")}</p>
                            <p className="font-semibold">{plot.size_sqm} m²</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive bg-transparent">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

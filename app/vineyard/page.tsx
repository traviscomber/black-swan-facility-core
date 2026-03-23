"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Grape, Leaf, Droplet, Sun, TrendingUp, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface VineyardPlot {
  id: string
  name: string
  location: string
  area_hectares: number
  vine_variety: string
  planted_year: number
  rootstock: string
  spacing_meters: number
  vine_density_per_hectare: number
  trellis_system: string
  status: string
  ph_level: number
  soil_type: string
}

export default function VineyardPage() {
  const [plots, setPlots] = useState<VineyardPlot[]>([])
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
        .from("vineyard_plots")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPlots(data || [])
    } catch (error) {
      console.error("[v0] Error fetching vineyard plots:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    if (status === "active") return "bg-green-100 text-green-800"
    if (status === "inactive") return "bg-gray-100 text-gray-800"
    return "bg-yellow-100 text-yellow-800"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("vineyard.loading")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        <PageHeader
          title={t("vineyard.title") || "Vineyard Management"}
          description={t("vineyard.description") || "Manage your vineyard plots, vines, and harvest records"}
          actions={
            <div className="flex gap-2">
              <Button variant="outline">
                <Droplet className="mr-2 h-4 w-4" />
                {t("vineyard.care_logs") || "Care Logs"}
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("vineyard.add_plot") || "Add Plot"}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_plots") || "Total Plots"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plots.length}</div>
              <p className="text-xs text-muted-foreground">Active vineyard sections</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_area") || "Total Area"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {plots.reduce((sum, p) => sum + (p.area_hectares || 0), 0).toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">hectares</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.active_plots") || "Active"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {plots.filter(p => p.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">Ready for production</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.avg_density") || "Avg Density"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {plots.length > 0 
                  ? Math.round(plots.reduce((sum, p) => sum + (p.vine_density_per_hectare || 0), 0) / plots.length)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">vines/hectare</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.plots") || "Vineyard Plots"}</CardTitle>
            <CardDescription>{t("vineyard.plots_description") || "View and manage all vineyard sections"}</CardDescription>
          </CardHeader>
          <CardContent>
            {plots.length === 0 ? (
              <div className="text-center py-8">
                <Grape className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("vineyard.no_plots") || "No vineyard plots yet"}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plots.map((plot) => (
                  <div
                    key={plot.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{plot.name}</h3>
                        <Badge className={getStatusColor(plot.status)}>
                          {plot.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{plot.location}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground pt-2">
                        <div className="flex items-center gap-1">
                          <Leaf className="w-4 h-4" />
                          {plot.vine_variety}
                        </div>
                        <div className="flex items-center gap-1">
                          <Sun className="w-4 h-4" />
                          {plot.area_hectares} ha
                        </div>
                        <div className="flex items-center gap-1">
                          <Droplet className="w-4 h-4" />
                          pH {plot.ph_level}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          {plot.vine_density_per_hectare} vines/ha
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
}

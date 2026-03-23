"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Grape, TrendingUp, Calendar, AlertCircle, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface HarvestRecord {
  id: string
  plot_id: string
  harvest_date: string
  quantity_kg: number
  quantity_tons: number
  sugar_level_brix: number
  acidity_ph: number
  alcohol_potential: number
  color_analysis: string
  maturity_assessment: string
  yield_per_hectare: number
  quality_rating: number
}

export default function VineyardHarvestPage() {
  const [harvests, setHarvests] = useState<HarvestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchHarvests()
  }, [])

  const fetchHarvests = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_harvest_records")
        .select("*")
        .order("harvest_date", { ascending: false })

      if (error) throw error
      setHarvests(data || [])
    } catch (error) {
      console.error("[v0] Error fetching harvest records:", error)
    } finally {
      setLoading(false)
    }
  }

  const getQualityColor = (rating: number) => {
    if (rating >= 90) return "bg-emerald-100 text-emerald-800"
    if (rating >= 80) return "bg-green-100 text-green-800"
    if (rating >= 70) return "bg-yellow-100 text-yellow-800"
    return "bg-orange-100 text-orange-800"
  }

  const totalYield = harvests.reduce((sum, h) => sum + (h.quantity_tons || 0), 0)
  const avgBrix = harvests.length > 0 ? (harvests.reduce((sum, h) => sum + (h.sugar_level_brix || 0), 0) / harvests.length).toFixed(1) : 0
  const avgQuality = harvests.length > 0 ? Math.round(harvests.reduce((sum, h) => sum + (h.quality_rating || 0), 0) / harvests.length) : 0

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
          title={t("vineyard.harvest") || "Harvest Management"}
          description={t("vineyard.harvest_description") || "Record and track grape harvest with quality metrics"}
          action={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("vineyard.record_harvest") || "Record Harvest"}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_yield") || "Total Yield"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalYield.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">metric tons</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.harvests_count") || "Harvest Records"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{harvests.length}</div>
              <p className="text-xs text-muted-foreground">Total harvests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.avg_brix") || "Average Brix"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgBrix}°</div>
              <p className="text-xs text-muted-foreground">Sugar content</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.avg_quality") || "Average Quality"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgQuality}</div>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.harvest_records") || "Harvest Records"}</CardTitle>
            <CardDescription>{t("vineyard.harvest_records_description") || "View all recorded harvests with quality analysis"}</CardDescription>
          </CardHeader>
          <CardContent>
            {harvests.length === 0 ? (
              <div className="text-center py-8">
                <Grape className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("vineyard.no_harvests") || "No harvest records yet"}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {harvests.map((harvest) => (
                  <div
                    key={harvest.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">
                            {new Date(harvest.harvest_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                          {harvest.quantity_tons.toFixed(2)} tons
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Sugar (Brix)</span>
                          <p className="font-semibold">{harvest.sugar_level_brix}°</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Acidity (pH)</span>
                          <p className="font-semibold">{harvest.acidity_ph}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Alcohol Potential</span>
                          <p className="font-semibold">{harvest.alcohol_potential}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Yield/hectare</span>
                          <p className="font-semibold">{harvest.yield_per_hectare} kg</p>
                        </div>
                      </div>

                      <div className="flex gap-4 text-sm pt-2">
                        {harvest.color_analysis && (
                          <div className="flex items-center gap-1">
                            <Grape className="w-4 h-4" />
                            Color: {harvest.color_analysis}
                          </div>
                        )}
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getQualityColor(harvest.quality_rating)}`}>
                          Quality: {harvest.quality_rating}
                        </div>
                      </div>

                      {harvest.maturity_assessment && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground pt-1">
                          <AlertCircle className="w-4 h-4" />
                          {harvest.maturity_assessment}
                        </div>
                      )}
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

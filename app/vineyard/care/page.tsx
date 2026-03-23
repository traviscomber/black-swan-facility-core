"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Leaf, Droplet, Scissors, DollarSign, Clock, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface CareLog {
  id: string
  plot_id: string
  care_type: string
  activity_date: string
  description: string
  pruning_method: string
  fertilizer_type: string
  fertilizer_amount_kg: number
  irrigation_mm: number
  labor_hours: number
  cost: number
  effectiveness_rating: number
}

export default function VineyardCarePage() {
  const [careLogs, setCareLogs] = useState<CareLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchCareLogs()
  }, [])

  const fetchCareLogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_care_logs")
        .select("*")
        .order("activity_date", { ascending: false })

      if (error) throw error
      setCareLogs(data || [])
    } catch (error) {
      console.error("[v0] Error fetching care logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCareTypeIcon = (type: string) => {
    if (type === "pruning") return <Scissors className="w-4 h-4" />
    if (type === "fertilizing") return <Leaf className="w-4 h-4" />
    if (type === "irrigation") return <Droplet className="w-4 h-4" />
    return <Leaf className="w-4 h-4" />
  }

  const getCareTypeColor = (type: string) => {
    if (type === "pruning") return "bg-blue-100 text-blue-800"
    if (type === "fertilizing") return "bg-green-100 text-green-800"
    if (type === "irrigation") return "bg-cyan-100 text-cyan-800"
    return "bg-gray-100 text-gray-800"
  }

  const totalCost = careLogs.reduce((sum, log) => sum + (log.cost || 0), 0)
  const totalLaborHours = careLogs.reduce((sum, log) => sum + (log.labor_hours || 0), 0)
  const totalFertilizer = careLogs.reduce((sum, log) => sum + (log.fertilizer_amount_kg || 0), 0)

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">{t("vineyard.loading")}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("vineyard.care") || "Vineyard Care"}
          description={t("vineyard.care_description") || "Track pruning, fertilizing, and irrigation activities"}
          action={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("vineyard.log_activity") || "Log Activity"}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_activities") || "Activities"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{careLogs.length}</div>
              <p className="text-xs text-muted-foreground">Care logs recorded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_cost") || "Total Cost"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">All activities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.labor_hours") || "Labor Hours"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLaborHours.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Total labor</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.fertilizer") || "Fertilizer"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFertilizer.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">kg applied</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.care_activities") || "Care Activities"}</CardTitle>
            <CardDescription>{t("vineyard.care_activities_description") || "All pruning, fertilizing, and maintenance logs"}</CardDescription>
          </CardHeader>
          <CardContent>
            {careLogs.length === 0 ? (
              <div className="text-center py-8">
                <Leaf className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("vineyard.no_care_logs") || "No care activities logged yet"}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {careLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <Badge className={getCareTypeColor(log.care_type)}>
                          <div className="flex items-center gap-1">
                            {getCareTypeIcon(log.care_type)}
                            {log.care_type.charAt(0).toUpperCase() + log.care_type.slice(1)}
                          </div>
                        </Badge>
                        <span className="text-sm font-medium">
                          {new Date(log.activity_date).toLocaleDateString()}
                        </span>
                      </div>

                      {log.description && (
                        <p className="text-sm text-muted-foreground">{log.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm pt-2">
                        {log.pruning_method && (
                          <div>
                            <span className="text-muted-foreground text-xs">Method</span>
                            <p className="font-semibold">{log.pruning_method}</p>
                          </div>
                        )}
                        {log.fertilizer_type && (
                          <div>
                            <span className="text-muted-foreground text-xs">Fertilizer</span>
                            <p className="font-semibold">{log.fertilizer_type}</p>
                          </div>
                        )}
                        {log.fertilizer_amount_kg > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Amount</span>
                            <p className="font-semibold">{log.fertilizer_amount_kg} kg</p>
                          </div>
                        )}
                        {log.irrigation_mm > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Irrigation</span>
                            <p className="font-semibold">{log.irrigation_mm} mm</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground text-xs">Effectiveness</span>
                          <p className="font-semibold">{log.effectiveness_rating}/10</p>
                        </div>
                      </div>

                      <div className="flex gap-4 text-sm pt-2 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {log.labor_hours} hours
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${log.cost || 0}
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
    </AppLayout>
  }
}

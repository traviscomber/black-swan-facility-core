"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Bug, AlertTriangle, Calendar, DollarSign, TrendingDown, Trash2, Pencil } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface PestLog {
  id: string
  plot_id: string
  pest_disease_name: string
  detection_date: string
  severity_level: string
  affected_area_percent: number
  treatment_applied: string
  treatment_date: string
  active_ingredient: string
  dosage: string
  effectiveness_rating: number
  cost: number
  labor_hours: number
}

export default function VineyardPestsPage() {
  const [pestLogs, setPestLogs] = useState<PestLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchPestLogs()
  }, [])

  const fetchPestLogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("vineyard_pest_logs")
        .select("*")
        .order("detection_date", { ascending: false })

      if (error) throw error
      setPestLogs(data || [])
    } catch (error) {
      console.error("[v0] Error fetching pest logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    if (severity === "critical") return "bg-red-100 text-red-800"
    if (severity === "high") return "bg-orange-100 text-orange-800"
    if (severity === "medium") return "bg-yellow-100 text-yellow-800"
    return "bg-green-100 text-green-800"
  }

  const totalCost = pestLogs.reduce((sum, log) => sum + (log.cost || 0), 0)
  const activePests = pestLogs.filter(log => {
    if (!log.treatment_date) return true
    const treatmentDate = new Date(log.treatment_date)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return treatmentDate > thirtyDaysAgo
  }).length

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
          title={t("vineyard.pests") || "Pest & Disease Management"}
          description={t("vineyard.pests_description") || "Track pest and disease occurrences and treatments"}
          action={
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("vineyard.log_pest") || "Log Issue"}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.total_incidents") || "Incidents"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pestLogs.length}</div>
              <p className="text-xs text-muted-foreground">Recorded issues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.active_issues") || "Active Issues"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{activePests}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.treatment_cost") || "Treatment Cost"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">Total spent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("vineyard.critical") || "Critical"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {pestLogs.filter(p => p.severity_level === "critical").length}
              </div>
              <p className="text-xs text-muted-foreground">Severe cases</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("vineyard.pest_records") || "Pest & Disease Records"}</CardTitle>
            <CardDescription>{t("vineyard.pest_records_description") || "View all recorded pests and treatments"}</CardDescription>
          </CardHeader>
          <CardContent>
            {pestLogs.length === 0 ? (
              <div className="text-center py-8">
                <Bug className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("vineyard.no_pest_records") || "No pest records yet"}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pestLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{log.pest_disease_name}</h3>
                        <Badge className={getSeverityColor(log.severity_level)}>
                          {log.severity_level}
                        </Badge>
                      </div>

                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Detected: {new Date(log.detection_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          {log.affected_area_percent}% affected
                        </div>
                      </div>

                      {log.treatment_applied && (
                        <div className="pt-2 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Treatment Applied</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Method</span>
                              <p className="font-semibold">{log.treatment_applied}</p>
                            </div>
                            {log.active_ingredient && (
                              <div>
                                <span className="text-muted-foreground text-xs">Active Ingredient</span>
                                <p className="font-semibold">{log.active_ingredient}</p>
                              </div>
                            )}
                            {log.dosage && (
                              <div>
                                <span className="text-muted-foreground text-xs">Dosage</span>
                                <p className="font-semibold">{log.dosage}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground text-xs">Effectiveness</span>
                              <p className="font-semibold">{log.effectiveness_rating}/10</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-4 text-sm pt-2 text-muted-foreground">
                        {log.treatment_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Treated: {new Date(log.treatment_date).toLocaleDateString()}
                          </div>
                        )}
                        {log.cost > 0 && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${log.cost}
                          </div>
                        )}
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
  )
}

"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Zap, AlertTriangle } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/language-context-client"

interface PestLog {
  id: string
  crop_id: string
  pest_type: string
  disease_name: string
  severity: string
  affected_area: number
  detected_date: string
  treatment_applied: string
  treatment_date: string
  effectiveness: string
  description: string
}

interface Crop {
  id: string
  crop_name: string
}

export default function OrchardPestsPage() {
  const [pestLogs, setPestLogs] = useState<PestLog[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: logsData } = await supabase
        .from("orchard_pest_logs")
        .select("*")
        .order("detected_date", { ascending: false })

      const { data: cropsData } = await supabase
        .from("orchard_crops")
        .select("id, crop_name")

      setPestLogs(logsData || [])
      setCrops(cropsData || [])
    } catch (error) {
      console.error("[v0] Error fetching pest logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCropName = (cropId: string) => {
    return crops.find((c) => c.id === cropId)?.crop_name || "Unknown"
  }

  const getSeverityColor = (severity: string) => {
    if (severity === "low") return "bg-yellow-100 text-yellow-800"
    if (severity === "medium") return "bg-orange-100 text-orange-800"
    if (severity === "high") return "bg-red-100 text-red-800"
    return "bg-gray-100 text-gray-800"
  }

  const getEffectivenessColor = (effectiveness: string) => {
    if (effectiveness === "very_effective") return "bg-green-100 text-green-800"
    if (effectiveness === "effective") return "bg-green-50 text-green-700"
    if (effectiveness === "partially_effective") return "bg-yellow-50 text-yellow-700"
    return "bg-red-50 text-red-700"
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
          title={t("orchard.pest_logs")}
          description="Monitor and track pests and diseases affecting your crops"
          actions={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("orchard.pest_type")}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Total Incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pestLogs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {pestLogs.filter((l) => l.severity === "high").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Treated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {pestLogs.filter((l) => l.treatment_date).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Effectiveness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {pestLogs.filter((l) => l.effectiveness).length > 0
                  ? `${Math.round((pestLogs.filter((l) => l.effectiveness === "very_effective").length / pestLogs.filter((l) => l.effectiveness).length) * 100)}%`
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.pest_logs")}</CardTitle>
            <CardDescription>Pest and disease monitoring records</CardDescription>
          </CardHeader>
          <CardContent>
            {pestLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No pest logs found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pestLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{log.pest_type || log.disease_name}</h3>
                          <Badge className={getSeverityColor(log.severity)}>
                            {log.severity}
                          </Badge>
                          {log.effectiveness && (
                            <Badge className={getEffectivenessColor(log.effectiveness)}>
                              {log.effectiveness.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{log.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Crop</p>
                            <p className="font-semibold">{getCropName(log.crop_id)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Detected</p>
                            <p className="font-semibold">
                              {new Date(log.detected_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Affected Area</p>
                            <p className="font-semibold">{log.affected_area}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Treatment</p>
                            <p className="font-semibold text-xs">{log.treatment_applied}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Treated Date</p>
                            <p className="font-semibold">
                              {log.treatment_date ? new Date(log.treatment_date).toLocaleDateString() : "-"}
                            </p>
                          </div>
                        </div>
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

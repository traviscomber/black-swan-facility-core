"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Heart, Droplet, Cloud, Thermometer } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

interface CareLog {
  id: string
  crop_id: string
  activity_date: string
  activity_type: string
  hours_spent: number
  description: string
  weather_conditions: string
  temperature_c: number
  humidity_percent: number
  observations: string
}

interface Crop {
  id: string
  crop_name: string
}

export default function OrchardCarePage() {
  const [careLogs, setCareLogs] = useState<CareLog[]>([])
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
        .from("orchard_care_logs")
        .select("*")
        .order("activity_date", { ascending: false })

      const { data: cropsData } = await supabase
        .from("orchard_crops")
        .select("id, crop_name")

      setCareLogs(logsData || [])
      setCrops(cropsData || [])
    } catch (error) {
      console.error("[v0] Error fetching care logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCropName = (cropId: string) => {
    return crops.find((c) => c.id === cropId)?.crop_name || t("orchard.unknown")
  }

  const getActivityIcon = (type: string) => {
    if (type === "watering") return <Droplet className="h-4 w-4 text-blue-500" />
    if (type === "fertilizing") return <Heart className="h-4 w-4 text-green-500" />
    if (type === "pest_control") return <Heart className="h-4 w-4 text-red-500" />
    return <Heart className="h-4 w-4" />
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
          title={t("orchard.care_logs")}
          description="Track watering, fertilizing, and plant care activities"
          actions={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("orchard.add_care_log")}
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Droplet className="h-4 w-4" />
                Watering Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {careLogs.filter((l) => l.activity_type === "watering").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Total Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{careLogs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Avg Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {careLogs.length > 0
                  ? (careLogs.reduce((sum, l) => sum + l.temperature_c, 0) / careLogs.length).toFixed(1)
                  : 0}
                °C
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("orchard.care_logs")}</CardTitle>
            <CardDescription>Recent plant care activities</CardDescription>
          </CardHeader>
          <CardContent>
            {careLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No care logs found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {careLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getActivityIcon(log.activity_type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold capitalize">{log.activity_type.replace("_", " ")}</h3>
                          <Badge variant="outline" className="text-xs">
                            {getCropName(log.crop_id)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{log.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p className="font-semibold">{new Date(log.activity_date).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Hours</p>
                            <p className="font-semibold">{log.hours_spent}h</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Temp</p>
                            <p className="font-semibold">{log.temperature_c}°C</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Humidity</p>
                            <p className="font-semibold">{log.humidity_percent}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Weather</p>
                            <p className="font-semibold text-xs">{log.weather_conditions}</p>
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
